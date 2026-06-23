create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  region_id text not null references public.regions(id) on update cascade,
  place_ids text[] not null,
  cover_image_url text not null default '',
  created_at timestamptz not null default now(),
  check (array_length(place_ids, 1) >= 2)
);

create index if not exists saved_routes_user_created_idx
  on public.saved_routes(user_id, created_at desc);

create unique index if not exists saved_routes_user_region_places_idx
  on public.saved_routes(user_id, region_id, place_ids);

alter table public.saved_routes enable row level security;

create or replace function public.doripe_all_ready_place_ids(input_place_ids text[])
returns boolean
language sql
stable
as $$
  select
    coalesce(array_length(input_place_ids, 1), 0) >= 2
    and not exists (
      select 1
      from unnest(input_place_ids) as candidate(place_id)
      where not exists (
        select 1
        from public.places
        where places.id = candidate.place_id
          and places.status = 'ready'
          and places.photo_qa_status = 'approved'
          and places.qa_status = 'ready'
      )
    );
$$;

drop policy if exists "Users can read own saved routes" on public.saved_routes;
drop policy if exists "Users can insert own ready saved routes" on public.saved_routes;
drop policy if exists "Users can update own ready saved routes" on public.saved_routes;
drop policy if exists "Users can delete own saved routes" on public.saved_routes;

create policy "Users can read own saved routes"
  on public.saved_routes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own ready saved routes"
  on public.saved_routes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.doripe_all_ready_place_ids(place_ids)
  );

create policy "Users can update own ready saved routes"
  on public.saved_routes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.doripe_all_ready_place_ids(place_ids)
  );

create policy "Users can delete own saved routes"
  on public.saved_routes for delete
  to authenticated
  using (auth.uid() = user_id);
