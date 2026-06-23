create table if not exists public.shared_links (
  id text primary key,
  created_by uuid references auth.users(id) on delete set null,
  content_type text not null check (content_type in ('place', 'route')),
  region_id text not null references public.regions(id) on update cascade,
  title text not null,
  cover_image_url text not null default '',
  place_id text references public.places(id) on delete set null,
  place_ids text[] not null default '{}',
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  check (
    (content_type = 'place' and place_id is not null and array_length(place_ids, 1) is null)
    or
    (content_type = 'route' and place_id is null and array_length(place_ids, 1) >= 2)
  )
);

create index if not exists shared_links_created_by_created_idx
  on public.shared_links(created_by, created_at desc);

create index if not exists shared_links_expires_idx
  on public.shared_links(expires_at);

alter table public.shared_links enable row level security;

create or replace function public.doripe_shared_link_has_ready_content(
  input_content_type text,
  input_place_id text,
  input_place_ids text[]
)
returns boolean
language sql
stable
as $$
  select
    case
      when input_content_type = 'place' then exists (
        select 1
        from public.places
        where places.id = input_place_id
          and places.status = 'ready'
          and places.photo_qa_status = 'approved'
          and places.qa_status = 'ready'
      )
      when input_content_type = 'route' then public.doripe_all_ready_place_ids(input_place_ids)
      else false
    end;
$$;

drop policy if exists "Public can read valid shared links" on public.shared_links;
drop policy if exists "Users can create own ready shared links" on public.shared_links;
drop policy if exists "Users can read own shared links" on public.shared_links;

create policy "Public can read valid shared links"
  on public.shared_links for select
  using (
    expires_at > now()
    and public.doripe_shared_link_has_ready_content(content_type, place_id, place_ids)
  );

create policy "Users can create own ready shared links"
  on public.shared_links for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and expires_at <= now() + interval '365 days'
    and public.doripe_shared_link_has_ready_content(content_type, place_id, place_ids)
  );

create policy "Users can read own shared links"
  on public.shared_links for select
  to authenticated
  using (auth.uid() = created_by);
