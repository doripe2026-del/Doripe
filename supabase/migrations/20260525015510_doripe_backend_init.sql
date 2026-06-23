create extension if not exists pgcrypto;

create table public.regions (
  id text primary key,
  name text not null,
  short_name text not null,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  map_pin_x numeric,
  map_pin_y numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.neighborhoods (
  id text primary key,
  name text not null,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  name text not null,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decks (
  id text primary key,
  region_id text not null references public.regions(id) on update cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  title text not null,
  short_copy text not null default '',
  tags text[] not null default '{}',
  tone text not null default 'lane' check (tone in ('sunset', 'lane', 'night', 'lookout')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.places (
  id text primary key,
  status text not null default 'draft' check (status in ('draft', 'ready', 'inactive')),
  neighborhood_id text not null references public.neighborhoods(id) on update cascade,
  sub_area text not null default '',
  category_id text not null references public.categories(id) on update cascade,
  name text not null,
  short_copy text not null default '',
  mood_tags text[] not null default '{}',
  best_for text[] not null default '{}',
  time_tags text[] not null default '{}',
  route_role text not null default 'middle' check (route_role in ('start', 'middle', 'finish', 'pause')),
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  nearest_station text not null default '',
  naver_place_url text not null default '',
  cover_image_url text not null default '',
  image_urls text[] not null default '{}',
  image_credit text not null default 'team' check (image_credit in ('team', 'owner', 'creator', 'licensed', 'unsplash')),
  photo_qa_status text not null default 'pending' check (photo_qa_status in ('pending', 'approved', 'rejected')),
  hours_text text not null default '',
  price_hint text not null default '',
  stay_time_minutes integer not null default 45,
  editorial_note text not null default '',
  qa_status text not null default 'draft' check (qa_status in ('draft', 'ready', 'needs_fix')),
  last_checked_at date,
  cover_photo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  public_url text not null default '',
  display_order integer not null default 0,
  photo_type text not null default 'gallery' check (photo_type in ('cover', 'gallery', 'original', 'rights')),
  source_type text not null default 'team' check (source_type in ('team', 'owner', 'creator', 'licensed')),
  rights_holder_name text not null default '',
  credit_text text not null default '',
  permission_status text not null default 'pending' check (permission_status in ('pending', 'approved', 'rejected')),
  usage_scope text not null default '',
  license_note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.places
  add constraint places_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.place_photos(id) on delete set null;

create table public.deck_places (
  deck_id text not null references public.decks(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  display_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (deck_id, place_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  provider text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  saved_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index saved_places_user_order_idx on public.saved_places(user_id, saved_order);

create table public.event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  place_id text references public.places(id) on delete set null,
  segment_from_place_id text references public.places(id) on delete set null,
  segment_to_place_id text references public.places(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index event_logs_user_created_idx on public.event_logs(user_id, created_at desc);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_label text not null default 'shared-admin',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('place-photos-public', 'place-photos-public', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('place-photo-originals', 'place-photo-originals', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.regions enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.categories enable row level security;
alter table public.decks enable row level security;
alter table public.places enable row level security;
alter table public.place_photos enable row level security;
alter table public.deck_places enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_places enable row level security;
alter table public.event_logs enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "Public can read active regions"
  on public.regions for select
  using (status = 'active');

create policy "Public can read active neighborhoods"
  on public.neighborhoods for select
  using (status = 'active');

create policy "Public can read active categories"
  on public.categories for select
  using (status = 'active');

create policy "Public can read active decks"
  on public.decks for select
  using (status = 'active');

create policy "Public can read ready places"
  on public.places for select
  using (status = 'ready' and photo_qa_status = 'approved' and qa_status = 'ready');

create policy "Public can read approved place photos"
  on public.place_photos for select
  using (permission_status = 'approved' and photo_type in ('cover', 'gallery'));

create policy "Public can read deck places for ready content"
  on public.deck_places for select
  using (
    exists (select 1 from public.decks where decks.id = deck_places.deck_id and decks.status = 'active')
    and exists (
      select 1
      from public.places
      where places.id = deck_places.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
    )
  );

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own saved places"
  on public.saved_places for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own saved places"
  on public.saved_places for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own saved places"
  on public.saved_places for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own saved places"
  on public.saved_places for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.event_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own events"
  on public.event_logs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Public can read app photo objects"
  on storage.objects for select
  using (bucket_id = 'place-photos-public');
