import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, ensureDbConfigured } from "../../lib/db.js";
import { ADMIN_COOKIE, parseCookies, verifyAdminCookie } from "../../lib/auth.js";
import { CAMPAIGN_CODES, ensureCampaignColumns } from "../../lib/campaign.js";
import { ensureNotifyV2Tables } from "../../lib/notify-v2.js";
import { ensureNotifyV2CampaignLabelTable } from "../../lib/notify-v2-campaign-labels.js";
import {
  DEFAULT_NOTIFY_QUESTION_CONFIG,
  NotifyQuestionConfigSchema,
  ensureNotifyQuestionConfigTable,
  getNotifyQuestionConfig,
} from "../../lib/notify-v2-questions.js";

const KST = "Asia/Seoul";
const V2_CUTOFF = "2026-05-11 15:00:00+00";
const AGE_ORDER = ["20-24", "25-29", "30-34", "35+"];
const GENDER_ORDER = ["여", "남", "응답 안 함"];
const REGION_ORDER = ["서울", "경기·인천", "강원·충청", "전라·제주", "경상", "해외"];
const COMPANION_ORDER = ["혼자", "연인", "친구", "가족", "여행객 동반"];
const TIME_SLOT_ORDER = ["아침(6-11)", "점심(11-14)", "오후(14-18)", "저녁(18-22)", "심야(22-2)", "새벽(2-6)"];
const FREQUENCY_ORDER = ["주 3회+", "주 1-2회", "월 2-3회", "월 1회 이하"];
const BUDGET_ORDER = ["2만원 이하", "2-5만원", "5-10만원", "10만원 이상"];

interface CountRow { count: string }
interface DistRow { label: string; count: string }
interface RecentRow {
  id: number; submitted_at: string; email: string; region: string; age_range: string;
  moods: string[] | null; time_slots: string[] | null; frequency: string; opinion: string | null;
}
interface BusinessLeadRow {
  id: number; submitted_at: string; store_name: string; store_url: string; contact: string;
  phone: string | null; space_type: string | null; message: string | null; consent_privacy: boolean | null;
}
interface CampaignRow {
  campaign_code: string; views: string; notify_arrivals: string; signups: string;
}
interface DailyRow {
  day: string; home_views: string; notify_arrivals: string; signups: string; business_leads: string;
}
interface V2RecentRow {
  id: number; submitted_at: string; email: string; age_range: string; gender: string; region: string;
  pain_point: string; desired_features: string[] | null; use_cases: string[] | null;
  recent_search_methods: string[] | null; save_locations: string[] | null;
  beta_result: string; beta_commitment: string; campaign_code: string | null; opinion: string | null;
}
interface V2CampaignRow {
  campaign_code: string; label: string; views: string; arrivals: string; step1: string; step2: string; step3: string; step7: string; signups: string;
}
interface V2TimelineRow {
  bucket: string; page_views: string; notify_arrivals: string; signups: string;
}

type V2Range = "24h" | "7d" | "30d";

const V2_RANGES: Record<V2Range, {
  label: string;
  interval: string;
  bucketUnit: "hour" | "day";
  lookback: string;
  step: string;
  format: string;
}> = {
  "24h": { label: "24시간", interval: "24 hours", bucketUnit: "hour", lookback: "23 hours", step: "1 hour", format: "YYYY-MM-DD HH24:00" },
  "7d": { label: "7일", interval: "7 days", bucketUnit: "day", lookback: "6 days", step: "1 day", format: "YYYY-MM-DD" },
  "30d": { label: "한달", interval: "30 days", bucketUnit: "day", lookback: "29 days", step: "1 day", format: "YYYY-MM-DD" },
};

const parseV2Range = (value: unknown): V2Range => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "7d" || raw === "30d" ? raw : "24h";
};

const toInt = (rows: CountRow[]) => Number(rows[0]?.count ?? 0);
const distMap = (rows: DistRow[], order: readonly string[]) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.label, Number(r.count));
  return order.map((label) => ({ label, value: m.get(label) ?? 0 }));
};
const toDistArray = (rows: DistRow[]) => rows.map((r) => ({ label: r.label, value: Number(r.count) }));

async function ensureBusinessLeadsTable() {
  await sql`
    create table if not exists business_leads (
      id bigserial primary key,
      store_name text not null,
      store_url text not null,
      contact text not null,
      phone text,
      space_type text,
      message text,
      consent_privacy boolean not null default false,
      submitted_at timestamptz not null default now(),
      user_agent text,
      referrer text
    )
  `;
  await sql`alter table business_leads add column if not exists phone text`;
  await sql`alter table business_leads add column if not exists consent_privacy boolean not null default false`;
  await sql`create index if not exists business_leads_submitted_at_idx on business_leads (submitted_at desc)`;
}

async function buildV2Timeline(range: V2Range) {
  await ensureNotifyV2Tables();

  const rangeConfig = V2_RANGES[range];
  const timelineRows = await sql.query(`
    with buckets as (
      select generate_series(
        date_trunc('${rangeConfig.bucketUnit}', now() at time zone '${KST}') - interval '${rangeConfig.lookback}',
        date_trunc('${rangeConfig.bucketUnit}', now() at time zone '${KST}'),
        interval '${rangeConfig.step}'
      ) as bucket
    )
    select
      to_char(b.bucket, '${rangeConfig.format}') as bucket,
      (
        select count(*)::text
        from events e
        where e.type = 'page_view'
          and e.route = '/'
          and e.timestamp >= '${V2_CUTOFF}'::timestamptz
          and date_trunc('${rangeConfig.bucketUnit}', e.timestamp at time zone '${KST}') = b.bucket
      ) as page_views,
      (
        select count(*)::text
        from notify_v2_events e
        where e.type = 'page_view'
          and e.route = '/notify'
          and date_trunc('${rangeConfig.bucketUnit}', e.timestamp at time zone '${KST}') = b.bucket
      ) as notify_arrivals,
      (
        select count(*)::text
        from notify_v2_signups s
        where date_trunc('${rangeConfig.bucketUnit}', s.submitted_at at time zone '${KST}') = b.bucket
      ) as signups
    from buckets b
    order by b.bucket
  `);

  return {
    range: {
      key: range,
      label: rangeConfig.label,
    },
    timeline: (timelineRows.rows as V2TimelineRow[]).map((r) => ({
      bucket: r.bucket,
      pageViews: Number(r.page_views),
      notifyArrivals: Number(r.notify_arrivals),
      signups: Number(r.signups),
    })),
  };
}

async function buildV2Stats(range: V2Range) {
  await ensureNotifyV2Tables();
  await ensureNotifyV2CampaignLabelTable();

  const campaignValues = CAMPAIGN_CODES.map((code) => `('${code}')`).join(", ");
  const [
    pageViewsTotal, pageViewsToday, arrivalsTotal, arrivalsToday, signupsTotal, signupsToday,
    stepBasic, stepPain, stepFeature, stepUseCase, stepSearch, stepSave, stepBetaResult, stepBetaCommitment,
    painRows, featureRows, useCaseRows, searchRows, saveRows, betaRows, betaCommitmentRows, opinionRows, recentRows, campaignRows, timelineStats,
  ] = await Promise.all([
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp >= ${V2_CUTOFF}`,
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp >= ${V2_CUTOFF} and timestamp >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='page_view' and route='/notify'`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='page_view' and route='/notify' and timestamp >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from notify_v2_signups`,
    sql<CountRow>`select count(*)::text as count from notify_v2_signups where submitted_at >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=1`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=2`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=3`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=4`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=5`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=6`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=7`,
    sql<CountRow>`select count(*)::text as count from notify_v2_events where type='step_complete' and step=8`,
    sql<DistRow>`select pain_point as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(desired_features) elem group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(use_cases) elem group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(recent_search_methods) elem group by 1 order by 2 desc`,
    sql<DistRow>`select elem as label, count(*)::text as count from notify_v2_signups, jsonb_array_elements_text(save_locations) elem group by 1 order by 2 desc`,
    sql<DistRow>`select beta_result as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select beta_commitment as label, count(*)::text as count from notify_v2_signups group by 1 order by 2 desc`,
    sql<DistRow>`select trim(opinion) as label, count(*)::text as count from notify_v2_signups where nullif(trim(opinion), '') is not null group by 1 order by 2 desc, 1 asc limit 30`,
    sql<V2RecentRow>`
      select id, submitted_at, email, age_range, gender, region, pain_point,
             (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(desired_features) value) as desired_features,
             (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(use_cases) value) as use_cases,
             (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(recent_search_methods) value) as recent_search_methods,
             (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(save_locations) value) as save_locations,
             beta_result, beta_commitment, campaign_code, opinion
      from notify_v2_signups
      order by submitted_at desc
      limit 100
    `,
    sql.query(`
      with codes(campaign_code) as (values ${campaignValues})
      select
        c.campaign_code,
        coalesce(l.label, '') as label,
        (select count(*)::text from events e where e.campaign_code = c.campaign_code and e.type = 'page_view' and e.route = '/' and e.timestamp >= '${V2_CUTOFF}'::timestamptz) as views,
        (select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'page_view' and e.route = '/notify') as arrivals,
        (select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 1) as step1,
        (select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 2) as step2,
        (select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 3) as step3,
        (select count(*)::text from notify_v2_events e where e.campaign_code = c.campaign_code and e.type = 'step_complete' and e.step = 8) as step7,
        (select count(*)::text from notify_v2_signups s where s.campaign_code = c.campaign_code) as signups
      from codes c
      left join notify_v2_campaign_labels l on l.campaign_code = c.campaign_code
      order by c.campaign_code
    `),
    buildV2Timeline(range),
  ]);

  const pageViews = toInt(pageViewsTotal.rows);
  const arrivals = toInt(arrivalsTotal.rows as CountRow[]);
  const signups = toInt(signupsTotal.rows as CountRow[]);

  return {
    version: "v2",
    range: timelineStats.range,
    kpi: {
      pageViews,
      todayPageViews: toInt(pageViewsToday.rows),
      arrivals,
      todayArrivals: toInt(arrivalsToday.rows),
      signups,
      todaySignups: toInt(signupsToday.rows),
      conversionRate: pageViews > 0 ? Number(((signups / pageViews) * 100).toFixed(1)) : 0,
    },
    funnel: [
      { label: "도착", value: arrivals },
      { label: "기본 인적사항", value: toInt(stepBasic.rows as CountRow[]) },
      { label: "불편 선택", value: toInt(stepPain.rows as CountRow[]) },
      { label: "기능 선택", value: toInt(stepFeature.rows as CountRow[]) },
      { label: "사용 상황", value: toInt(stepUseCase.rows as CountRow[]) },
      { label: "탐색 방식", value: toInt(stepSearch.rows as CountRow[]) },
      { label: "저장 위치", value: toInt(stepSave.rows as CountRow[]) },
      { label: "받고 싶은 결과물", value: toInt(stepBetaResult.rows as CountRow[]) },
      { label: "참여 의향", value: toInt(stepBetaCommitment.rows as CountRow[]) },
      { label: "제출", value: signups },
    ],
    insights: {
      painPoints: toDistArray(painRows.rows as DistRow[]),
      features: toDistArray(featureRows.rows as DistRow[]),
      useCases: toDistArray(useCaseRows.rows as DistRow[]),
      recentSearchMethods: toDistArray(searchRows.rows as DistRow[]),
      saveLocations: toDistArray(saveRows.rows as DistRow[]),
      betaResults: toDistArray(betaRows.rows as DistRow[]),
      betaCommitments: toDistArray(betaCommitmentRows.rows as DistRow[]),
      opinions: toDistArray(opinionRows.rows as DistRow[]),
    },
    campaigns: (campaignRows.rows as V2CampaignRow[]).map((r) => ({
      code: r.campaign_code,
      label: r.label || "",
      link: `https://doripe.vercel.app/notify?c=${r.campaign_code}`,
      views: Number(r.views),
      arrivals: Number(r.arrivals),
      step1: Number(r.step1),
      step2: Number(r.step2),
      step3: Number(r.step3),
      step7: Number(r.step7),
      signups: Number(r.signups),
    })),
    timeline: timelineStats.timeline,
    recentSignups: (recentRows.rows as V2RecentRow[]).map((r) => ({
      id: Number(r.id),
      date: new Date(r.submitted_at),
      email: r.email,
      age: r.age_range,
      gender: r.gender,
      region: r.region,
      painPoint: r.pain_point,
      desiredFeatures: r.desired_features ?? [],
      useCases: r.use_cases ?? [],
      recentSearchMethods: r.recent_search_methods ?? [],
      saveLocations: r.save_locations ?? [],
      betaResult: r.beta_result,
      betaCommitment: r.beta_commitment,
      campaignCode: r.campaign_code ?? "",
      opinion: r.opinion ?? "",
    })),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const cookies = parseCookies(req.headers.cookie);
  if (!(await verifyAdminCookie(cookies[ADMIN_COOKIE]))) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  try {
    ensureDbConfigured();
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }

  if (req.query.notifyConfig === "1") {
    await ensureNotifyQuestionConfigTable();
    if (req.method === "GET") {
      const config = await getNotifyQuestionConfig();
      return res.status(200).json({ ok: true, config, defaults: DEFAULT_NOTIFY_QUESTION_CONFIG });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method not allowed" });
    const parsed = NotifyQuestionConfigSchema.safeParse(req.body?.config);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid config" });
    }
    await sql`
      insert into notify_v2_question_config (id, config, updated_at)
      values ('active', ${JSON.stringify(parsed.data)}::jsonb, now())
      on conflict (id)
      do update set config = excluded.config, updated_at = now()
    `;
    return res.status(200).json({ ok: true, config: parsed.data });
  }

  if (req.query.version === "v2") {
    const range = parseV2Range(req.query.range);
    if (req.query.timelineOnly === "1") {
      return res.status(200).json({
        version: "v2",
        ...(await buildV2Timeline(range)),
      });
    }
    return res.status(200).json(await buildV2Stats(range));
  }
  await ensureBusinessLeadsTable();
  await ensureCampaignColumns();

  const [
    homeViewsTotal, homeViewsToday, homeViewsYesterday,
    notifyArrivalsTotal, notifyArrivalsToday,
    signupsTotal, signupsToday,
    funnelStep1, funnelStep2, funnelStep3,
    ageRows, genderRows, regionRows,
    companionRows, moodRows, timeSlotRows,
    frequencyRows, budgetRows,
    seoulCount, quietIndieCount, highIntentCount,
    recentRows,
    businessLeadsTotal, businessLeadsToday, recentBusinessLeads,
    campaignRows,
    dailyRows,
  ] = await Promise.all([
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp < ${V2_CUTOFF}`,
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp < ${V2_CUTOFF} and timestamp >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/' and timestamp < ${V2_CUTOFF} and timestamp >= (date_trunc('day', now() at time zone ${KST}) - interval '1 day') at time zone ${KST} and timestamp < date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/notify' and timestamp < ${V2_CUTOFF}`,
    sql<CountRow>`select count(*)::text as count from events where type='page_view' and route='/notify' and timestamp < ${V2_CUTOFF} and timestamp >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from signups where submitted_at < ${V2_CUTOFF}`,
    sql<CountRow>`select count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} and submitted_at >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<CountRow>`select count(*)::text as count from events where type='step_complete' and step=1 and timestamp < ${V2_CUTOFF}`,
    sql<CountRow>`select count(*)::text as count from events where type='step_complete' and step=2 and timestamp < ${V2_CUTOFF}`,
    sql<CountRow>`select count(*)::text as count from events where type='step_complete' and step=3 and timestamp < ${V2_CUTOFF}`,
    sql<DistRow>`select age_range as label, count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<DistRow>`select gender as label, count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<DistRow>`select region as label, count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<DistRow>`select elem as label, count(*)::text as count from signups, jsonb_array_elements_text(partners) elem where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<DistRow>`select elem as label, count(*)::text as count from signups, jsonb_array_elements_text(moods) elem where submitted_at < ${V2_CUTOFF} group by 1 order by 2 desc limit 5`,
    sql<DistRow>`select elem as label, count(*)::text as count from signups, jsonb_array_elements_text(time_slots) elem where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<DistRow>`select frequency as label, count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<DistRow>`select budget as label, count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} group by 1`,
    sql<CountRow>`select count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} and region = '서울'`,
    sql<CountRow>`select count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} and moods @> '["조용함"]'::jsonb and moods @> '["인디·로컬"]'::jsonb`,
    sql<CountRow>`select count(*)::text as count from signups where submitted_at < ${V2_CUTOFF} and expected_usage >= 6`,
    sql<RecentRow>`
      select id, submitted_at, email, region, age_range,
             (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(moods) value) as moods,
             (select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(time_slots) value) as time_slots,
             frequency, opinion
      from signups where submitted_at < ${V2_CUTOFF} order by submitted_at desc limit 100
    `,
    sql<CountRow>`select count(*)::text as count from business_leads`,
    sql<CountRow>`select count(*)::text as count from business_leads where submitted_at >= date_trunc('day', now() at time zone ${KST}) at time zone ${KST}`,
    sql<BusinessLeadRow>`
      select id, submitted_at, store_name, store_url, contact, phone, space_type, message, consent_privacy
      from business_leads order by submitted_at desc limit 50
    `,
    sql<CampaignRow>`
      with codes(campaign_code) as (
        values
          ('dori-001'), ('dori-002'), ('dori-003'), ('dori-004'), ('dori-005'),
          ('dori-006'), ('dori-007'), ('dori-008'), ('dori-009'), ('dori-010'),
          ('dori-011'), ('dori-012'), ('dori-013'), ('dori-014'), ('dori-015'),
          ('dori-016'), ('dori-017'), ('dori-018'), ('dori-019'), ('dori-020')
      )
      select
        c.campaign_code,
        (select count(*)::text from events e where e.campaign_code = c.campaign_code and e.type = 'page_view' and e.route = '/' and e.timestamp < ${V2_CUTOFF}) as views,
        (select count(*)::text from events e where e.campaign_code = c.campaign_code and e.type = 'page_view' and e.route = '/notify' and e.timestamp < ${V2_CUTOFF}) as notify_arrivals,
        (select count(*)::text from signups s where s.campaign_code = c.campaign_code and s.submitted_at < ${V2_CUTOFF}) as signups
      from codes c
      order by c.campaign_code
    `,
    sql<DailyRow>`
      with days as (
        select generate_series(
          (date_trunc('day', now() at time zone ${KST}) - interval '13 days')::date,
          (date_trunc('day', now() at time zone ${KST}))::date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as day,
        (
          select count(*)::text
          from events e
          where e.type = 'page_view'
            and e.route = '/'
            and e.timestamp < ${V2_CUTOFF}
            and (e.timestamp at time zone ${KST})::date = d.day
        ) as home_views,
        (
          select count(*)::text
          from events e
          where e.type = 'page_view'
            and e.route = '/notify'
            and e.timestamp < ${V2_CUTOFF}
            and (e.timestamp at time zone ${KST})::date = d.day
        ) as notify_arrivals,
        (
          select count(*)::text
          from signups s
          where s.submitted_at < ${V2_CUTOFF}
            and (s.submitted_at at time zone ${KST})::date = d.day
        ) as signups,
        (
          select count(*)::text
          from business_leads b
          where (b.submitted_at at time zone ${KST})::date = d.day
        ) as business_leads
      from days d
      order by d.day
    `,
  ]);

  const totalViews = toInt(homeViewsTotal.rows);
  const totalSignups = toInt(signupsTotal.rows);
  const notifyArrivals = toInt(notifyArrivalsTotal.rows);
  const seoulN = toInt(seoulCount.rows);
  const seoulPct = totalSignups > 0 ? ((seoulN / totalSignups) * 100).toFixed(1) : "0.0";

  return res.status(200).json({
    kpi: {
      totalViews, todayViews: toInt(homeViewsToday.rows), yesterdayViews: toInt(homeViewsYesterday.rows),
      notifyArrivals, todayArrivals: toInt(notifyArrivalsToday.rows),
      signups: totalSignups, todaySignups: toInt(signupsToday.rows),
    },
    funnel: [
      { label: "메인 조회", value: totalViews },
      { label: "/notify 도착", value: notifyArrivals },
      { label: "Step 1 완료", value: toInt(funnelStep1.rows) },
      { label: "Step 2 완료", value: toInt(funnelStep2.rows) },
      { label: "Step 3 완료", value: toInt(funnelStep3.rows) },
      { label: "제출", value: totalSignups },
    ],
    distributions: {
      age: distMap(ageRows.rows, AGE_ORDER),
      gender: distMap(genderRows.rows, GENDER_ORDER),
      region: distMap(regionRows.rows, REGION_ORDER),
      companion: distMap(companionRows.rows, COMPANION_ORDER),
      mood: toDistArray(moodRows.rows),
      timeSlot: distMap(timeSlotRows.rows, TIME_SLOT_ORDER),
      frequency: distMap(frequencyRows.rows, FREQUENCY_ORDER),
      budget: distMap(budgetRows.rows, BUDGET_ORDER),
    },
    insights: [
      [`서울 거주자 ${seoulN}명 (전체의 ${seoulPct}%)`, "첫 시드 페르소나"],
      [`조용함 + 인디·로컬 선호자 ${toInt(quietIndieCount.rows)}명`, "핵심 페르소나"],
      [`월 6회 이상 쓸 것 같다고 응답한 사람 ${toInt(highIntentCount.rows)}명`, ""],
    ],
    business: {
      leads: toInt(businessLeadsTotal.rows),
      todayLeads: toInt(businessLeadsToday.rows),
      recentLeads: recentBusinessLeads.rows.map((r) => ({
        id: Number(r.id),
        date: new Date(r.submitted_at),
        storeName: r.store_name,
        storeUrl: r.store_url,
        contact: r.contact,
        phone: r.phone ?? r.contact,
        spaceType: r.space_type ?? "",
        message: r.message ?? "",
        consentPrivacy: r.consent_privacy === true,
      })),
    },
    campaigns: campaignRows.rows.map((r) => ({
      code: r.campaign_code,
      link: `https://doripe.vercel.app/?c=${r.campaign_code}`,
      views: Number(r.views),
      notifyArrivals: Number(r.notify_arrivals),
      signups: Number(r.signups),
    })),
    daily: dailyRows.rows.map((r) => {
      const homeViews = Number(r.home_views);
      const notifyArrivals = Number(r.notify_arrivals);
      const signups = Number(r.signups);
      return {
        date: r.day,
        homeViews,
        notifyArrivals,
        signups,
        businessLeads: Number(r.business_leads),
        conversionRate: homeViews > 0 ? Number(((signups / homeViews) * 100).toFixed(1)) : 0,
      };
    }),
    recentSignups: recentRows.rows.map((r) => ({
      id: Number(r.id),
      date: new Date(r.submitted_at),
      email: r.email,
      region: r.region,
      age: r.age_range,
      mood: (r.moods ?? []).join(", "),
      timeSlot: (r.time_slots ?? []).join(", "),
      frequency: r.frequency,
      opinion: r.opinion ?? "",
    })),
  });
}
