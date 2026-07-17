-- Forward-only saves/courses EXPAND migration.

alter table public.saved_places
  add column if not exists source_surface text,
  add column if not exists source_content_id uuid,
  add column if not exists saved_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists updated_at timestamptz;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  is_public boolean not null default false,
  start_place_id text references public.places(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_places (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  place_id text not null references public.places(id) on delete restrict,
  position integer not null check (position >= 0),
  stay_duration_minutes integer check (stay_duration_minutes is null or stay_duration_minutes >= 0),
  travel_duration_from_previous_minutes integer
    check (travel_duration_from_previous_minutes is null or travel_duration_from_previous_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position),
  unique (course_id, place_id)
);

create table public.course_place_replacements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  course_place_id uuid references public.course_places(id) on delete set null,
  old_place_id text not null references public.places(id) on delete restrict,
  new_place_id text not null references public.places(id) on delete restrict,
  replaced_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  expected_version integer not null check (expected_version > 0),
  created_at timestamptz not null default now(),
  check (old_place_id <> new_place_id)
);

create table public.saved_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  source_surface text,
  source_content_id uuid,
  saved_at timestamptz not null default now(),
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index courses_user_updated_idx on public.courses(user_id, updated_at desc, id desc);
create index courses_public_updated_idx
  on public.courses(updated_at desc, id desc)
  where is_public and status = 'active';
create index course_places_course_position_idx on public.course_places(course_id, position, id);
create index course_place_replacements_course_created_idx
  on public.course_place_replacements(course_id, created_at desc);
create index saved_courses_user_saved_idx on public.saved_courses(user_id, saved_at desc, course_id);

alter table public.courses enable row level security;
alter table public.course_places enable row level security;
alter table public.course_place_replacements enable row level security;
alter table public.saved_courses enable row level security;

comment on column public.saved_places.source_content_id is
  'A future FK to canonical contents; remains nullable until the content migration exists.';
comment on column public.saved_courses.source_content_id is
  'A future FK to canonical contents; remains nullable until the content migration exists.';
