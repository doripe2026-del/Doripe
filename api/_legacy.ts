import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export type JsonBody = Record<string, unknown>;

export function jsonBody(request: VercelRequest): JsonBody {
  if (request.body && typeof request.body === "object") return request.body as JsonBody;
  if (typeof request.body === "string" && request.body.trim()) {
    try {
      const parsed = JSON.parse(request.body);
      if (parsed && typeof parsed === "object") return parsed as JsonBody;
    } catch {
      return {};
    }
  }
  return {};
}

export function sendJson(response: VercelResponse, status: number, body: unknown) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.status(status).send(JSON.stringify(body));
}

export function badRequest(response: VercelResponse, error: string) {
  sendJson(response, 400, { ok: false, error });
}

export function stringValue(body: JsonBody, key: string) {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid input: expected string, received ${value === undefined ? "undefined" : typeof value}`);
  }
  return value.trim();
}

export function optionalString(body: JsonBody, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export function optionalNullableString(body: JsonBody, key: string) {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function booleanValue(body: JsonBody, key: string) {
  return body[key] === true;
}

export function stringArray(body: JsonBody, key: string) {
  const value = body[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export async function ensureHomepageEventTables() {
  await sql`
    create table if not exists events (
      id bigserial primary key,
      type text not null,
      route text not null,
      step integer,
      campaign_code text,
      metadata jsonb not null default '{}',
      timestamp timestamptz not null default now()
    )
  `;
  await sql`alter table events add column if not exists campaign_code text`;
  await sql`alter table events add column if not exists metadata jsonb not null default '{}'`;
  await sql`alter table events add column if not exists timestamp timestamptz not null default now()`;

  await sql`
    create table if not exists notify_v2_events (
      id bigserial primary key,
      type text not null,
      route text not null,
      step integer,
      campaign_code text,
      metadata jsonb not null default '{}',
      timestamp timestamptz not null default now()
    )
  `;
  await sql`alter table notify_v2_events add column if not exists campaign_code text`;
  await sql`alter table notify_v2_events add column if not exists metadata jsonb not null default '{}'`;
  await sql`alter table notify_v2_events add column if not exists timestamp timestamptz not null default now()`;
}

export async function ensureNotifyV2Tables() {
  await ensureHomepageEventTables();
  await sql`
    create table if not exists notify_v2_signups (
      id bigserial primary key,
      email text not null default '',
      age_range text not null,
      gender text not null,
      region text not null,
      pain_point text not null,
      desired_features jsonb not null default '[]',
      use_cases jsonb not null default '[]',
      recent_search_methods jsonb not null default '[]',
      save_locations jsonb not null default '[]',
      beta_result text not null,
      beta_commitment text not null,
      opinion text,
      phone text,
      consent_privacy boolean not null default false,
      consent_terms boolean not null default false,
      consent_age boolean not null default false,
      consent_marketing boolean not null default false,
      consent_analytics boolean not null default false,
      campaign_code text,
      submitted_at timestamptz not null default now()
    )
  `;
  await sql`alter table notify_v2_signups add column if not exists email text not null default ''`;
  await sql`alter table notify_v2_signups add column if not exists use_cases jsonb not null default '[]'`;
  await sql`alter table notify_v2_signups add column if not exists consent_privacy boolean not null default false`;
  await sql`alter table notify_v2_signups add column if not exists consent_terms boolean not null default false`;
  await sql`alter table notify_v2_signups add column if not exists consent_age boolean not null default false`;
  await sql`alter table notify_v2_signups add column if not exists consent_marketing boolean not null default false`;
  await sql`alter table notify_v2_signups add column if not exists consent_analytics boolean not null default false`;
  await sql`alter table notify_v2_signups add column if not exists campaign_code text`;
  await sql`alter table notify_v2_signups add column if not exists submitted_at timestamptz not null default now()`;
}

