-- Forward-only analytics/idempotency/sharing EXPAND migration.

create table public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_accounts(user_id) on delete set null,
  anonymous_id text,
  domain text not null check (btrim(domain) <> ''),
  source text not null check (btrim(source) <> ''),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  entry_path text not null default '',
  referrer text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (user_id is not null or nullif(btrim(anonymous_id), '') is not null),
  check (ended_at is null or ended_at >= started_at),
  check (last_seen_at >= started_at)
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  session_id uuid references public.analytics_sessions(id) on delete set null,
  user_id uuid references public.user_accounts(user_id) on delete set null,
  anonymous_id text,
  domain text not null check (btrim(domain) <> ''),
  source text not null check (btrim(source) <> ''),
  event_name text not null check (btrim(event_name) <> ''),
  schema_version integer not null check (schema_version > 0),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  client_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  check (user_id is not null or nullif(btrim(anonymous_id), '') is not null)
);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'anonymous', 'system')),
  actor_id_hash text not null check (btrim(actor_id_hash) <> ''),
  http_method text not null check (http_method in ('POST', 'PUT', 'PATCH', 'DELETE')),
  normalized_route text not null check (normalized_route like '/%'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 255),
  request_hash text not null check (btrim(request_hash) <> ''),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  response_status integer check (response_status between 100 and 599),
  response_body jsonb check (response_body is null or jsonb_typeof(response_body) = 'object'),
  locked_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_type, actor_id_hash, http_method, normalized_route, idempotency_key),
  check ((status = 'processing' and completed_at is null) or status <> 'processing'),
  check (expires_at is null or expires_at > created_at)
);

create index analytics_sessions_user_started_idx
  on public.analytics_sessions(user_id, started_at desc, id);
create index analytics_sessions_anonymous_started_idx
  on public.analytics_sessions(anonymous_id, started_at desc, id)
  where anonymous_id is not null;
create index analytics_events_session_received_idx
  on public.analytics_events(session_id, received_at desc, id);
create index analytics_events_name_received_idx
  on public.analytics_events(domain, event_name, received_at desc, id);
create index idempotency_records_expiry_idx
  on public.idempotency_records(expires_at)
  where expires_at is not null;

alter table public.shared_links
  add column if not exists target_type text,
  add column if not exists target_place_id text references public.places(id) on delete set null,
  add column if not exists target_course_id uuid references public.courses(id) on delete set null,
  add column if not exists target_content_id uuid,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists revocation_reason text,
  add column if not exists updated_at timestamptz;

alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.idempotency_records enable row level security;

comment on column public.analytics_events.properties is
  'Allowlisted non-PII event properties only; free-text inquiries and contact data are forbidden by the API contract.';
comment on column public.shared_links.target_content_id is
  'A future FK to canonical contents; content shares remain unavailable until that migration exists.';
