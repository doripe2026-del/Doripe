import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { sql } from "@vercel/postgres";
import { createSupabaseAdminClient } from "./supabaseAdmin.js";

const KST = "Asia/Seoul";
const V2_CUTOFF = "2026-05-11 15:00:00+00";
const campaignCodes = Array.from({ length: 20 }, (_, index) => `dori-${String(index + 1).padStart(3, "0")}`);

type CountRow = { count: string };
type DistRow = { label: string | null; count: string };
type V2RecentRow = {
  age_range: string;
  beta_commitment: string;
  beta_result: string;
  campaign_code: string | null;
  desired_features: string[] | null;
  email: string;
  gender: string;
  id: number;
  opinion: string | null;
  pain_point: string;
  phone: string | null;
  recent_search_methods: string[] | null;
  region: string;
  save_locations: string[] | null;
  submitted_at: string;
};
type V2CampaignRow = {
  ad_views: string;
  arrivals: string;
  campaign_code: string;
  label: string | null;
  signups: string;
  step1: string;
  step2: string;
  step3: string;
  step7: string;
  views: string;
};
type V2TimelineRow = {
  bucket: string;
  notify_arrivals: string;
  page_views: string;
  signups: string;
};
type NotifyTasteRecentRow = {
  character_name: string;
  compatibility_score: number | null;
  created_at: string;
  email: string;
  id: string;
  referrer_share_slug: string | null;
  share_slug: string;
};
type NotifyTasteStats = {
  recentSignups: AdminRecentSignup[];
  todaySignups: number;
  totalSignups: number;
};
type AdminRecentSignup = {
  age: string;
  betaCommitment: string;
  betaResult: string;
  campaignCode: string;
  date: string;
  desiredFeatures: string[];
  email: string;
  gender: string;
  id: number;
  opinion: string;
  painPoint: string;
  phone: string;
  recentSearchMethods: string[];
  region: string;
  saveLocations: string[];
};

export type LegacyAdminStats = Awaited<ReturnType<typeof getLegacyAdminStats>>;

function loadLegacyEnvFallback() {
  if (process.env.POSTGRES_URL || process.env.DATABASE_URL) return;

  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!["POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"].includes(key)) continue;
    const value = rawValue.replace(/^"|"$/g, "");
    if (value && !process.env[key]) process.env[key] = value;
  }
}

export function ensureLegacyDbConfigured() {
  loadLegacyEnvFallback();
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error("Legacy admin database is not configured.");
  }
}

function toInt(rows: CountRow[]) {
  return Number(rows[0]?.count ?? 0);
}

function dist(rows: DistRow[]) {
  return rows
    .filter((row) => row.label)
    .map((row) => ({ label: row.label ?? "", value: Number(row.count) }))
    .filter((row) => row.value > 0);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function dedupeLatestByEmail(rows: AdminRecentSignup[]) {
  const byEmail = new Map<string, AdminRecentSignup>();

  for (const row of rows) {
    const key = normalizeEmail(row.email);
    if (!key) continue;

    const existing = byEmail.get(key);
    if (!existing || new Date(row.date).getTime() > new Date(existing.date).getTime()) {
      byEmail.set(key, row);
    }
  }

  return [...byEmail.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

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

function getKstDayStartIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: KST,
    year: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day, -9, 0, 0)).toISOString();
}

async function fetchNotifyTasteRows() {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  const maxRows = 10000;
  const rows: NotifyTasteRecentRow[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await supabase
      .from("notify_taste_results")
      .select("id,email,character_name,share_slug,referrer_share_slug,compatibility_score,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const page = (data || []) as NotifyTasteRecentRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function getNotifyTasteAdminStats(): Promise<NotifyTasteStats> {
  try {
    const todayStart = getKstDayStartIso();
    const rows = await fetchNotifyTasteRows();
    const latestRows = dedupeLatestByEmail(rows.map((row, index) => ({
      age: "취향 테스트",
      betaCommitment: row.compatibility_score === null ? "단독 결과" : `${row.compatibility_score}점`,
      betaResult: row.character_name,
      campaignCode: row.referrer_share_slug ? "shared-link" : "notify-taste",
      date: row.created_at,
      desiredFeatures: [row.character_name],
      email: row.email,
      gender: "-",
      id: -(index + 1),
      opinion: row.share_slug,
      painPoint: row.character_name,
      phone: "",
      recentSearchMethods: row.referrer_share_slug ? ["공유 링크"] : ["직접 진입"],
      region: "-",
      saveLocations: [],
    })));

    return {
      recentSignups: latestRows.slice(0, 200),
      todaySignups: latestRows.filter((row) => row.date >= todayStart).length,
      totalSignups: latestRows.length,
    };
  } catch (error) {
    console.warn("Notify taste admin stats unavailable", error);
    return {
      recentSignups: [] as AdminRecentSignup[],
      todaySignups: 0,
      totalSignups: 0,
    };
  }
}

export async function ensureCampaignLabelStorage() {
  await sql`
    create table if not exists notify_v2_campaign_labels (
      campaign_code text primary key,
      label text not null default '',
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table notify_v2_campaign_labels add column if not exists ad_views integer not null default 0`;
}

export async function getLegacyAdminStats() {
  ensureLegacyDbConfigured();

  const hasNotifyV2 = await tableExists("notify_v2_signups");
  const hasNotifyV2Events = await tableExists("notify_v2_events");
  const hasEvents = await tableExists("events");
  let hasCampaignLabels = await tableExists("notify_v2_campaign_labels");

  if (!hasNotifyV2) {
    return {
      campaigns: [],
      error: null,
      funnel: [],
      insights: {
        betaCommitments: [],
        betaResults: [],
        features: [],
        opinions: [],
        painPoints: [],
        recentSearchMethods: [],
        saveLocations: [],
      },
      kpi: {
        arrivals: 0,
        conversionRate: 0,
        pageViews: 0,
        signups: 0,
        todayArrivals: 0,
        todayPageViews: 0,
        todaySignups: 0,
      },
      recentSignups: [],
      timeline: [],
      version: "v2",
    };
  }

  await ensureCampaignLabelStorage();
  hasCampaignLabels = true;
  const notifyTasteStats = await getNotifyTasteAdminStats();

  const [
    pageViewsTotal,
    pageViewsToday,
    arrivalsTotal,
    arrivalsToday,
    signupsTotal,
    signupsToday,
    stepBasic,
    stepPain,
    stepFeature,
    stepSearch,
    stepSave,
    stepBetaResult,
    stepBetaCommitment,
    ageRows,
    genderRows,
    regionRows,
    painRows,
    featureRows,
    searchRows,
    saveRows,
    betaRows,
    betaCommitmentRows,
    opinionRows,
    recentRows,
    campaignRows,
    timelineRows,
  ] = await Promise.all([
    hasEvents
      ? sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp >= ${V2_CUTOFF}`
      : Promise.resolve({ rows: [{ count: "0" }] }),
    hasEvents
      ? sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp >= ${V2_CUTOFF} and timestamp >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`
      : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events
      ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='page_view' and route='/notify'`
      : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events
      ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='page_view' and route='/notify' and timestamp >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`
      : Promise.resolve({ rows: [{ count: "0" }] }),
    sql<CountRow>`
      select count(*)::text as count
      from (
        select lower(trim(email)) as email_key
        from notify_v2_signups
        where nullif(trim(email), '') is not null
        group by 1
      ) deduped
    `,
    sql<CountRow>`
      select count(*)::text as count
      from (
        select lower(trim(email)) as email_key, max(submitted_at) as latest_at
        from notify_v2_signups
        where nullif(trim(email), '') is not null
        group by 1
      ) deduped
      where latest_at >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}
    `,
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=1` : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=2` : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=3` : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=4` : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=5` : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=6` : Promise.resolve({ rows: [{ count: "0" }] }),
    hasNotifyV2Events ? sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=7` : Promise.resolve({ rows: [{ count: "0" }] }),
    sql<DistRow>`select age_range as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select gender as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select region as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select pain_point as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(desired_features) elem group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(recent_search_methods) elem group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(save_locations) elem group by 1 order by 2 desc`,
    sql<DistRow>`select beta_result as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select beta_commitment as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select trim(opinion) as label, count(*)::text as count from notify_v2_signups where nullif(trim(opinion), '') is not null group by 1 order by 2 desc, 1 asc limit 50`,
    sql<V2RecentRow>`
      select *
      from (
        select distinct on (lower(trim(email)))
               id, submitted_at, email, phone, age_range, gender, region, pain_point,
               (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(desired_features) value) as desired_features,
               (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(recent_search_methods) value) as recent_search_methods,
               (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(save_locations) value) as save_locations,
               beta_result, beta_commitment, campaign_code, opinion
        from notify_v2_signups
        where nullif(trim(email), '') is not null
        order by lower(trim(email)), submitted_at desc
      ) latest
      order by submitted_at desc
      limit 200
    `,
    sql.query(`
      with codes(campaign_code) as (values ${campaignCodes.map((code) => `('${code}')`).join(", ")})
      select
        c.campaign_code,
        ${hasCampaignLabels ? `coalesce(l.label, '')` : `''`} as label,
        ${hasCampaignLabels ? `coalesce(l.ad_views, 0)::text` : `'0'`} as ad_views,
        ${hasEvents ? `(select count(*)::text from events e where e.campaign_code = c.campaign_code and e.type = 'page_view' and e.route = '/' and e.timestamp >= '${V2_CUTOFF}'::timestamptz)` : `'0'`} as views,
        ${hasNotifyV2Events ? `(select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'page_view' and e.route = '/notify')` : `'0'`} as arrivals,
        ${hasNotifyV2Events ? `(select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 1)` : `'0'`} as step1,
        ${hasNotifyV2Events ? `(select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 2)` : `'0'`} as step2,
        ${hasNotifyV2Events ? `(select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 3)` : `'0'`} as step3,
        ${hasNotifyV2Events ? `(select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 7)` : `'0'`} as step7,
        (select count(*)::text from notify_v2_signups s where s.campaign_code = c.campaign_code) as signups
      from codes c
      ${hasCampaignLabels ? `left join notify_v2_campaign_labels l on l.campaign_code = c.campaign_code` : ``}
      order by c.campaign_code
    `),
    sql.query(`
      with days as (
        select generate_series(
          (date_trunc('day', now() at time zone '${KST}') - interval '89 days')::date,
          (date_trunc('day', now() at time zone '${KST}'))::date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as bucket,
        ${hasEvents ? `(select count(*)::text from events e where e.type = 'page_view' and e.route = '/' and e.timestamp >= '${V2_CUTOFF}'::timestamptz and (e.timestamp at time zone '${KST}')::date = d.day)` : `'0'`} as page_views,
        ${hasNotifyV2Events ? `(select count(*)::text from notify_v2_events e where e.type = 'page_view' and e.route = '/notify' and (e.timestamp at time zone '${KST}')::date = d.day)` : `'0'`} as notify_arrivals,
        (
          select count(*)::text
          from (
            select lower(trim(s.email)) as email_key, max(s.submitted_at) as latest_at
            from notify_v2_signups s
            where nullif(trim(s.email), '') is not null
            group by 1
          ) latest
          where (latest.latest_at at time zone '${KST}')::date = d.day
        ) as signups
      from days d
      order by d.day
    `),
  ]);

  const pageViews = toInt(pageViewsTotal.rows);
  const arrivals = toInt(arrivalsTotal.rows);
  const signups = toInt(signupsTotal.rows) + notifyTasteStats.totalSignups;
  const todaySignups = toInt(signupsToday.rows) + notifyTasteStats.todaySignups;
  const legacyRecentSignups: AdminRecentSignup[] = (recentRows.rows as V2RecentRow[]).map((row) => ({
    age: row.age_range,
    betaCommitment: row.beta_commitment,
    betaResult: row.beta_result,
    campaignCode: row.campaign_code ?? "",
    date: row.submitted_at,
    desiredFeatures: row.desired_features ?? [],
    email: row.email,
    gender: row.gender,
    id: Number(row.id),
    opinion: row.opinion ?? "",
    painPoint: row.pain_point,
    phone: row.phone ?? "",
    recentSearchMethods: row.recent_search_methods ?? [],
    region: row.region,
    saveLocations: row.save_locations ?? [],
  }));
  const recentSignups = dedupeLatestByEmail([...notifyTasteStats.recentSignups, ...legacyRecentSignups])
    .slice(0, 200);

  return {
    campaigns: (campaignRows.rows as V2CampaignRow[]).map((row) => ({
      adViews: Number(row.ad_views),
      code: row.campaign_code,
      label: row.label ?? "",
      link: `https://doripe.kr/?c=${row.campaign_code}`,
      notifyArrivals: Number(row.arrivals),
      signups: Number(row.signups),
      step1: Number(row.step1),
      step2: Number(row.step2),
      step3: Number(row.step3),
      step7: Number(row.step7),
      views: Number(row.views),
    })),
    funnel: [
      { label: "조회수", value: pageViews },
      { label: "알림신청 클릭", value: arrivals },
      { label: "기본 정보", value: toInt(stepBasic.rows) },
      { label: "불편 선택", value: toInt(stepPain.rows) },
      { label: "기능 선택", value: toInt(stepFeature.rows) },
      { label: "탐색 방식", value: toInt(stepSearch.rows) },
      { label: "저장 위치", value: toInt(stepSave.rows) },
      { label: "베타 결과", value: toInt(stepBetaResult.rows) },
      { label: "참여 의향", value: toInt(stepBetaCommitment.rows) },
      { label: "알림신청 완료", value: signups },
    ],
    insights: {
      age: dist(ageRows.rows),
      betaCommitments: dist(betaCommitmentRows.rows),
      betaResults: dist(betaRows.rows),
      features: dist(featureRows.rows),
      gender: dist(genderRows.rows),
      opinions: dist(opinionRows.rows),
      painPoints: dist(painRows.rows),
      recentSearchMethods: dist(searchRows.rows),
      region: dist(regionRows.rows),
      saveLocations: dist(saveRows.rows),
    },
    kpi: {
      arrivals,
      conversionRate: pageViews > 0 ? Number(((signups / pageViews) * 100).toFixed(1)) : 0,
      pageViews,
      signups,
      todayArrivals: toInt(arrivalsToday.rows),
      todayPageViews: toInt(pageViewsToday.rows),
      todaySignups,
    },
    recentSignups,
    timeline: (timelineRows.rows as V2TimelineRow[]).map((row) => ({
      bucket: row.bucket,
      notifyArrivals: Number(row.notify_arrivals),
      pageViews: Number(row.page_views),
      signups: Number(row.signups),
    })),
    version: "v2",
  };
}
