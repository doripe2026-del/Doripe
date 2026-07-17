-- Forward-only EXPAND migration. Roll back with a new migration.

alter table public.public_profiles
  add column if not exists follower_count integer not null default 0
  check (follower_count >= 0);

alter table public.places
  add column if not exists region_id text references public.regions(id) on update cascade on delete set null;

create index if not exists places_region_ready_idx
  on public.places(region_id, updated_at desc, id)
  where status = 'ready';

comment on column public.places.region_id is
  'Nullable canonical region. Legacy deck membership backfill only assigns a value when exactly one region is observed.';

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  mime_type text not null check (btrim(mime_type) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  duration_seconds numeric,
  source_type text not null default 'user' check (source_type in ('user', 'curator', 'partner')),
  storage_bucket text not null default 'media-quarantine'
    check (storage_bucket in ('media-quarantine', 'media-approved')),
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'uploaded', 'approved', 'rejected', 'deleted')),
  rights_status text not null default 'pending'
    check (rights_status in ('pending', 'approved', 'rejected')),
  version integer not null default 1 check (version > 0),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  check (storage_path = owner_user_id::text || '/' || id::text || '/' || original_filename),
  check ((kind = 'image' and duration_seconds is null) or (kind = 'video' and duration_seconds >= 0)),
  check ((status = 'pending' and completed_at is null) or status <> 'pending'),
  check ((status = 'deleted' and deleted_at is not null) or status <> 'deleted')
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.user_accounts(user_id) on delete cascade,
  type text not null check (type in ('place', 'course')),
  caption text not null default '' check (char_length(caption) <= 2000),
  course_id uuid references public.courses(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'reviewing', 'published', 'rejected', 'hidden')),
  version integer not null default 1 check (version > 0),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  submitted_at timestamptz,
  published_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'place' and course_id is null) or (type = 'course' and course_id is not null)),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.content_places (
  content_id uuid not null references public.contents(id) on delete cascade,
  place_id text not null references public.places(id) on delete restrict,
  position integer not null check (position >= 0 and position < 30),
  created_at timestamptz not null default now(),
  primary key (content_id, place_id),
  unique (content_id, position)
);

create table public.content_media (
  content_id uuid not null references public.contents(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  position integer not null check (position >= 0 and position < 5),
  created_at timestamptz not null default now(),
  primary key (content_id, media_asset_id),
  unique (content_id, position)
);

create table public.profile_follows (
  id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  followed_user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_user_id, followed_user_id),
  check (follower_user_id <> followed_user_id)
);

create table public.content_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, content_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  author_id uuid not null references public.user_accounts(user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  version integer not null default 1 check (version > 0),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('hidden', 'deleted') and hidden_at is not null) or status = 'visible')
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  category text not null check (category in ('bug', 'feedback', 'account', 'content', 'other')),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  status text not null default 'received' check (status in ('received', 'reviewing', 'resolved', 'closed')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  target_type text not null check (target_type in ('user', 'place', 'content')),
  target_id text not null check (char_length(target_id) between 1 and 96),
  reason_code text not null check (reason_code in ('spam', 'abuse', 'rights', 'incorrect', 'unsafe', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'received' check (status in ('received', 'reviewing', 'resolved', 'closed')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_assets_owner_created_idx
  on public.media_assets(owner_user_id, created_at desc, id desc);
create index media_assets_status_created_idx
  on public.media_assets(status, created_at desc, id desc);
create index contents_author_updated_idx
  on public.contents(author_id, updated_at desc, id desc);
create index contents_published_idx
  on public.contents(published_at desc, id desc) where status = 'published';
create index content_places_place_idx
  on public.content_places(place_id, content_id);
create index content_media_asset_idx
  on public.content_media(media_asset_id, content_id);
create index profile_follows_follower_created_idx
  on public.profile_follows(follower_user_id, created_at desc, id desc);
create index profile_follows_followed_idx
  on public.profile_follows(followed_user_id, created_at desc);
create index content_likes_content_idx
  on public.content_likes(content_id, created_at desc);
create index comments_content_created_idx
  on public.comments(content_id, created_at, id) where status = 'visible';
create index comments_author_created_idx
  on public.comments(author_id, created_at desc);
create index inquiries_user_created_idx
  on public.inquiries(user_id, created_at desc, id desc);
create index reports_user_created_idx
  on public.reports(reporter_user_id, created_at desc, id desc);
create index reports_target_created_idx
  on public.reports(target_type, target_id, created_at desc);

alter table public.media_assets enable row level security;
alter table public.contents enable row level security;
alter table public.content_places enable row level security;
alter table public.content_media enable row level security;
alter table public.profile_follows enable row level security;
alter table public.content_likes enable row level security;
alter table public.comments enable row level security;
alter table public.inquiries enable row level security;
alter table public.reports enable row level security;

comment on table public.media_assets is 'Private user-owned upload metadata; object delivery uses short-lived server-issued URLs.';
comment on table public.contents is 'User-authored content lifecycle. Only published rows are public.';
comment on table public.reports is 'Reporter-visible status only; moderation notes belong in operator-only storage.';
