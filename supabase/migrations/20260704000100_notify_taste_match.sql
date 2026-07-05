create table if not exists public.notify_taste_results (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  choices jsonb not null,
  character_key text not null,
  character_name text not null,
  share_slug text not null unique,
  referrer_share_slug text references public.notify_taste_results(share_slug) on delete set null,
  compatibility_score integer,
  compatibility_summary text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now(),
  constraint notify_taste_results_email_valid
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  constraint notify_taste_results_choices_array
    check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 10),
  constraint notify_taste_results_choices_values_valid
    check (not jsonb_path_exists(choices, '$[*] ? (@ != "A" && @ != "B")')),
  constraint notify_taste_results_character_key_valid
    check (character_key in ('quiet_collector', 'route_planner')),
  constraint notify_taste_results_score_valid
    check (compatibility_score is null or compatibility_score between 0 and 100)
);

create index if not exists notify_taste_results_referrer_share_slug_idx
  on public.notify_taste_results(referrer_share_slug);

create index if not exists notify_taste_results_created_at_idx
  on public.notify_taste_results(created_at desc);

create index if not exists notify_taste_results_email_idx
  on public.notify_taste_results(email);

alter table public.notify_taste_results enable row level security;

create table if not exists public.notify_taste_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  share_slug text,
  referrer_share_slug text,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now(),
  constraint notify_taste_events_name_valid
    check (event_name in (
      'page_view',
      'choice_complete',
      'email_submit',
      'result_view',
      'share_click',
      'compatibility_view'
    )),
  constraint notify_taste_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists notify_taste_events_name_created_at_idx
  on public.notify_taste_events(event_name, created_at desc);

create index if not exists notify_taste_events_share_slug_idx
  on public.notify_taste_events(share_slug);

create index if not exists notify_taste_events_referrer_share_slug_idx
  on public.notify_taste_events(referrer_share_slug);

alter table public.notify_taste_events enable row level security;
