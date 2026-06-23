create table if not exists public.app_anonymous_users (
  id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  session_count integer not null default 0,
  first_referrer text not null default '',
  first_user_agent text not null default '',
  check (char_length(id) between 12 and 80)
);

create table if not exists public.app_sessions (
  id text primary key,
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_path text not null default '/app',
  referrer text not null default '',
  user_agent text not null default '',
  check (char_length(id) between 12 and 120)
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  session_id text references public.app_sessions(id) on delete set null,
  event_name text not null,
  screen text not null default '',
  place_id text references public.places(id) on delete set null,
  route_id uuid,
  share_id text,
  neighborhood_id text references public.neighborhoods(id) on delete set null,
  category_id text references public.categories(id) on delete set null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_saved_places (
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  state text not null check (state in ('saved', 'skipped', 'unsaved')),
  saved_count integer not null default 0,
  skipped_count integer not null default 0,
  first_saved_at timestamptz,
  last_action_at timestamptz not null default now(),
  primary key (anonymous_user_id, place_id)
);

create table if not exists public.app_routes (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  region_id text references public.regions(id) on update cascade,
  neighborhood_id text references public.neighborhoods(id) on update cascade,
  title text not null,
  place_ids text[] not null,
  status text not null default 'draft' check (status in ('draft', 'blocked', 'saved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(place_ids, 1) >= 2)
);

alter table public.shared_links
  add column if not exists anonymous_user_id text references public.app_anonymous_users(id) on delete set null;

alter table public.shared_links
  add column if not exists open_count integer not null default 0;

create index if not exists app_anonymous_users_last_seen_idx
  on public.app_anonymous_users(last_seen_at desc);

create index if not exists app_sessions_user_started_idx
  on public.app_sessions(anonymous_user_id, started_at desc);

create index if not exists app_events_user_created_idx
  on public.app_events(anonymous_user_id, created_at desc);

create index if not exists app_events_name_created_idx
  on public.app_events(event_name, created_at desc);

create index if not exists app_events_place_created_idx
  on public.app_events(place_id, created_at desc);

create index if not exists app_saved_places_state_updated_idx
  on public.app_saved_places(state, last_action_at desc);

create index if not exists app_routes_user_created_idx
  on public.app_routes(anonymous_user_id, created_at desc);

create index if not exists shared_links_anonymous_user_idx
  on public.shared_links(anonymous_user_id, created_at desc);

alter table public.app_anonymous_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_events enable row level security;
alter table public.app_saved_places enable row level security;
alter table public.app_routes enable row level security;
