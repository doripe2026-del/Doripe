import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, ensureDbConfigured } from "../lib/db.js";
import { BusinessLeadPayloadSchema } from "../lib/schema.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method not allowed" });
  try {
    ensureDbConfigured();
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }

  const parsed = BusinessLeadPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ ok: false, error: first?.message ?? "validation failed" });
  }

  const p = parsed.data;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
  const referrer = (req.headers["referer"] as string | undefined) ?? null;

  try {
    await ensureBusinessLeadsTable();
    await sql`
      insert into business_leads (
        store_name, store_url, contact, phone, space_type, message, consent_privacy, user_agent, referrer
      ) values (
        ${"전화 상담 요청"}, ${""}, ${p.phone}, ${p.phone}, ${null}, ${"개인정보 수집 및 이용 동의"},
        ${p.consentPrivacy}, ${userAgent}, ${referrer}
      )
    `;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
}
