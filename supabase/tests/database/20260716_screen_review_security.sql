-- Run after `supabase db reset` with psql ON_ERROR_STOP enabled.
begin;

create table if not exists public.screen_review_screens (
  screen_id text primary key,
  status text not null default 'in_progress'
);

create table if not exists public.screen_review_tasks (
  id text primary key,
  screen_id text not null,
  body text not null,
  status text not null default 'queued'
);

alter table public.screen_review_screens enable row level security;
alter table public.screen_review_tasks enable row level security;

grant all on table public.screen_review_screens to anon, authenticated;
grant all on table public.screen_review_tasks to anon, authenticated;

drop policy if exists "screen review update screens" on public.screen_review_screens;
create policy "screen review update screens"
  on public.screen_review_screens for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "screen review update tasks" on public.screen_review_tasks;
create policy "screen review update tasks"
  on public.screen_review_tasks for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "screen review delete tasks" on public.screen_review_tasks;
create policy "screen review delete tasks"
  on public.screen_review_tasks for delete
  to anon, authenticated
  using (true);

\ir ../../migrations/20260716015253_harden_screen_review_public_writes.sql

select plan(1);

do $$
declare
  review_table text;
begin
  foreach review_table in array array[
    'screen_review_screens',
    'screen_review_tasks'
  ] loop
    if not has_table_privilege('anon', 'public.' || review_table, 'select')
      or not has_table_privilege('anon', 'public.' || review_table, 'insert')
      or not has_table_privilege('authenticated', 'public.' || review_table, 'select')
      or not has_table_privilege('authenticated', 'public.' || review_table, 'insert') then
      raise exception 'screen review public read/insert grants are missing on %', review_table;
    end if;

    if has_table_privilege('anon', 'public.' || review_table, 'update')
      or has_table_privilege('anon', 'public.' || review_table, 'delete')
      or has_table_privilege('anon', 'public.' || review_table, 'truncate')
      or has_table_privilege('anon', 'public.' || review_table, 'references')
      or has_table_privilege('anon', 'public.' || review_table, 'trigger')
      or has_table_privilege('authenticated', 'public.' || review_table, 'update')
      or has_table_privilege('authenticated', 'public.' || review_table, 'delete')
      or has_table_privilege('authenticated', 'public.' || review_table, 'truncate')
      or has_table_privilege('authenticated', 'public.' || review_table, 'references')
      or has_table_privilege('authenticated', 'public.' || review_table, 'trigger') then
      raise exception 'screen review destructive client grant remains on %', review_table;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('screen_review_screens', 'screen_review_tasks')
      and cmd in ('UPDATE', 'DELETE')
      and roles && array['anon'::name, 'authenticated'::name]
  ) then
    raise exception 'screen review destructive client policy remains';
  end if;
end;
$$;

select pass('screen review tables reject destructive public writes');
select * from finish();

rollback;
