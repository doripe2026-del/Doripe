import { sql } from "@vercel/postgres";
import { NextResponse } from "../../admin-server/response.js";
import { z } from "zod";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { ensureCampaignLabelStorage, ensureLegacyDbConfigured } from "../../admin-server/legacyStats.js";

export const runtime = "nodejs";

const campaignCodes = Array.from({ length: 20 }, (_, index) => `dori-${String(index + 1).padStart(3, "0")}`);
const campaignCodeSet = new Set(campaignCodes);

const campaignPayloadSchema = z.object({
  adViews: z.coerce.number().int().min(0).max(1_000_000_000).optional().default(0),
  code: z.string().trim().optional(),
  label: z.string().trim().min(1).max(80),
});

type CampaignCodeRow = {
  campaign_code: string | null;
};

async function tableExists(tableName: string) {
  const result = await sql<{ exists: boolean }>`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = ${tableName}
    ) as exists
  `;
  return result.rows[0]?.exists === true;
}

async function loadUsedCampaignCodes() {
  const used = new Set<string>();
  const sources = ["notify_v2_campaign_labels", "notify_v2_signups", "notify_v2_events", "events"];

  for (const source of sources) {
    if (!(await tableExists(source))) continue;
    try {
      const rows = await sql.query<CampaignCodeRow>(`
        select distinct campaign_code
        from ${source}
        where campaign_code is not null
          and campaign_code <> ''
      `);
      for (const row of rows.rows) {
        if (row.campaign_code && campaignCodeSet.has(row.campaign_code)) used.add(row.campaign_code);
      }
    } catch {
      // Older legacy tables can exist without campaign_code. They should not block new ad setup.
    }
  }

  return used;
}

function campaignLink(code: string) {
  return `https://doripe.kr/?c=${encodeURIComponent(code)}`;
}

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  ensureLegacyDbConfigured();
  await ensureCampaignLabelStorage();

  const rows = await sql<{ campaign_code: string; label: string; ad_views: number; updated_at: string }>`
    select campaign_code, label, ad_views, updated_at::text as updated_at
    from notify_v2_campaign_labels
    order by campaign_code
  `;

  return NextResponse.json({
    campaigns: rows.rows.map((row) => ({
      adViews: Number(row.ad_views),
      code: row.campaign_code,
      label: row.label,
      link: campaignLink(row.campaign_code),
      updatedAt: row.updated_at,
    })),
    ok: true,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = campaignPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  ensureLegacyDbConfigured();
  await ensureCampaignLabelStorage();

  let code = parsed.data.code;
  if (!code) {
    const usedCampaignCodes = await loadUsedCampaignCodes();
    code = campaignCodes.find((candidate) => !usedCampaignCodes.has(candidate));
  }

  if (!code || !campaignCodeSet.has(code)) {
    return NextResponse.json({
      message: "사용 가능한 광고 코드가 없습니다. 랜딩/알림신청 쪽 캠페인 코드 범위를 먼저 늘려야 합니다.",
    }, { status: 409 });
  }

  await sql`
    insert into notify_v2_campaign_labels (campaign_code, label, ad_views, updated_at)
    values (${code}, ${parsed.data.label}, ${parsed.data.adViews}, now())
    on conflict (campaign_code)
    do update set
      label = excluded.label,
      ad_views = excluded.ad_views,
      updated_at = now()
  `;

  return NextResponse.json({
    campaign: {
      adViews: parsed.data.adViews,
      code,
      label: parsed.data.label,
      link: campaignLink(code),
    },
    ok: true,
  });
}
