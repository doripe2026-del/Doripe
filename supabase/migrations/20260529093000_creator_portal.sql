create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null default '',
  instagram_url text not null default '',
  payout_status text not null default 'not_configured' check (payout_status in ('not_configured', 'pending', 'verified', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_place_submissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'approved', 'published', 'rejected')),
  provider text not null default 'naver' check (provider in ('naver', 'admin_manual')),
  provider_place_url text not null default '',
  provider_raw jsonb not null default '{}',
  place_name text not null,
  place_category text not null default '',
  place_address text not null default '',
  place_road_address text not null default '',
  place_lat double precision,
  place_lng double precision,
  creator_note text not null default '',
  instagram_url text not null default '',
  rights_accepted_at timestamptz,
  admin_note text not null default '',
  linked_place_id text references public.places(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_place_submissions_creator_created_idx
  on public.creator_place_submissions(creator_id, created_at desc);

create index if not exists creator_place_submissions_status_created_idx
  on public.creator_place_submissions(status, created_at desc);

create table if not exists public.creator_submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.creator_place_submissions(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  file_name text not null default '',
  mime_type text not null default '',
  file_size bigint not null default 0,
  display_order integer not null default 0,
  review_status text not null default 'pending' check (review_status in ('pending', 'selected', 'rejected')),
  selected_for_card boolean not null default false,
  place_photo_id uuid references public.place_photos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists creator_submission_photos_submission_order_idx
  on public.creator_submission_photos(submission_id, display_order);

create unique index if not exists creator_submission_photos_storage_path_idx
  on public.creator_submission_photos(bucket_id, storage_path);

create table if not exists public.creator_card_metrics (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.creator_place_submissions(id) on delete cascade,
  place_id text references public.places(id) on delete set null,
  impressions integer not null default 0 check (impressions >= 0),
  saves integer not null default 0 check (saves >= 0),
  taps integer not null default 0 check (taps >= 0),
  estimated_revenue_krw integer not null default 0 check (estimated_revenue_krw >= 0),
  measured_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (submission_id, measured_at)
);

create index if not exists creator_card_metrics_place_measured_idx
  on public.creator_card_metrics(place_id, measured_at desc);

create table if not exists public.creator_payout_estimates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  estimated_amount_krw integer not null default 0 check (estimated_amount_krw >= 0),
  status text not null default 'estimated' check (status in ('estimated', 'confirmed', 'paid', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_payout_estimates_creator_period_idx
  on public.creator_payout_estimates(creator_id, period_start desc, period_end desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-submission-originals',
  'creator-submission-originals',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.creator_profiles enable row level security;
alter table public.creator_place_submissions enable row level security;
alter table public.creator_submission_photos enable row level security;
alter table public.creator_card_metrics enable row level security;
alter table public.creator_payout_estimates enable row level security;

create policy "Service role manages creator profiles"
  on public.creator_profiles for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "Service role manages creator submissions"
  on public.creator_place_submissions for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "Service role manages creator submission photos"
  on public.creator_submission_photos for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "Service role manages creator card metrics"
  on public.creator_card_metrics for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "Service role manages creator payout estimates"
  on public.creator_payout_estimates for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
