-- Forward-only place/taxonomy EXPAND migration.

create table public.content_tags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  group_key text not null default 'general' check (btrim(group_key) <> ''),
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_tags (
  place_id text not null references public.places(id) on delete cascade,
  tag_id uuid not null references public.content_tags(id) on delete restrict,
  source text not null default 'operator' check (btrim(source) <> ''),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (place_id, tag_id)
);

create table public.place_external_ids (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  provider text not null check (btrim(provider) <> ''),
  external_id text not null check (btrim(external_id) <> ''),
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  unique (place_id, provider, external_id)
);

create table public.place_merge_history (
  id uuid primary key default gen_random_uuid(),
  source_place_id text not null references public.places(id) on delete restrict,
  target_place_id text not null references public.places(id) on delete restrict,
  merged_by uuid not null references public.operator_accounts(user_id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  before_data jsonb check (before_data is null or jsonb_typeof(before_data) = 'object'),
  created_at timestamptz not null default now(),
  check (source_place_id <> target_place_id)
);

create index content_tags_group_status_order_idx
  on public.content_tags(group_key, status, display_order, id);
create index place_tags_tag_place_idx
  on public.place_tags(tag_id, place_id);
create index place_external_ids_place_provider_idx
  on public.place_external_ids(place_id, provider);
create index place_merge_history_source_created_idx
  on public.place_merge_history(source_place_id, created_at desc);
create index place_merge_history_target_created_idx
  on public.place_merge_history(target_place_id, created_at desc);

alter table public.places
  add column if not exists operating_hours jsonb,
  add column if not exists source_last_verified_at timestamptz,
  add column if not exists duplicate_of_place_id text references public.places(id) on delete set null,
  add column if not exists merged_into_place_id text references public.places(id) on delete set null;

alter table public.content_tags enable row level security;
alter table public.place_tags enable row level security;
alter table public.place_external_ids enable row level security;
alter table public.place_merge_history enable row level security;

comment on column public.content_tags.group_key is
  'Configurable taxonomy group; the final product taxonomy remains a product decision.';
comment on table public.place_external_ids is
  'Provider-neutral external identifiers used for duplicate detection and reconciliation.';
