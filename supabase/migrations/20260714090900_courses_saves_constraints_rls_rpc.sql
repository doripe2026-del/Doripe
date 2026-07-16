-- Forward-only saves/courses constraints, access control, and atomic RPCs.

alter table public.saved_places
  add constraint saved_places_removed_after_saved_check
  check (removed_at is null or saved_at is null or removed_at >= saved_at) not valid;

alter table public.saved_places
  alter column saved_at set default now(),
  alter column updated_at set default now();

create or replace function public.doripe_all_ready_place_ids(input_place_ids text[])
returns boolean
language sql
stable
set search_path = ''
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
          and places.merged_into_place_id is null
      )
    );
$$;
revoke all on function public.doripe_all_ready_place_ids(text[]) from public;
grant execute on function public.doripe_all_ready_place_ids(text[]) to anon, authenticated, service_role;

drop policy if exists "Users can read own saved routes" on public.saved_routes;
drop policy if exists "Users can insert own ready saved routes" on public.saved_routes;
drop policy if exists "Users can update own ready saved routes" on public.saved_routes;
drop policy if exists "Users can delete own saved routes" on public.saved_routes;

create policy "Active users can read own legacy saved routes"
  on public.saved_routes for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );
create policy "Active users can insert own ready legacy saved routes"
  on public.saved_routes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and public.doripe_all_ready_place_ids(place_ids)
  );
create policy "Active users can update own ready legacy saved routes"
  on public.saved_routes for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and public.doripe_all_ready_place_ids(place_ids)
  );
create policy "Active users can delete own legacy saved routes"
  on public.saved_routes for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

drop policy if exists "Users can read own saved places" on public.saved_places;
drop policy if exists "Users can insert own ready saved places" on public.saved_places;
drop policy if exists "Users can update own ready saved places" on public.saved_places;
drop policy if exists "Users can delete own saved places" on public.saved_places;

create policy "Active users can read own saved places"
  on public.saved_places for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

create policy "Active users can insert own ready saved places"
  on public.saved_places for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and exists (
      select 1
      from public.places
      where places.id = saved_places.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
        and places.merged_into_place_id is null
    )
  );

create policy "Active users can update own ready saved places"
  on public.saved_places for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and exists (
      select 1
      from public.places
      where places.id = saved_places.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
        and places.merged_into_place_id is null
    )
  );

create policy "Active users can delete own saved places for legacy compatibility"
  on public.saved_places for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

create policy "Public or owner can read active courses"
  on public.courses for select
  to anon, authenticated
  using (
    status = 'active'
    and public.doripe_account_is_active(user_id)
    and (
      is_public
      or (select auth.uid()) = user_id
    )
  );

create policy "Public or owner can read course places"
  on public.course_places for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.courses
      where courses.id = course_places.course_id
        and courses.status = 'active'
        and public.doripe_account_is_active(courses.user_id)
        and (courses.is_public or courses.user_id = (select auth.uid()))
    )
  );

create policy "Owners can read course replacement history"
  on public.course_place_replacements for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses
      where courses.id = course_place_replacements.course_id
        and courses.user_id = (select auth.uid())
    )
  );

create policy "Active users can read own saved courses"
  on public.saved_courses for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

create policy "Active users can insert visible saved courses"
  on public.saved_courses for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and exists (
      select 1
      from public.courses
      where courses.id = saved_courses.course_id
        and courses.status = 'active'
        and (courses.is_public or courses.user_id = user_id)
    )
  );

create policy "Active users can update own saved courses"
  on public.saved_courses for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

create policy "Active users can delete own saved courses for compatibility"
  on public.saved_courses for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

grant select on public.courses, public.course_places to anon, authenticated;
revoke insert, update, delete on public.courses, public.course_places from anon, authenticated;
grant select on public.course_place_replacements to authenticated;
grant select, insert, update, delete on public.saved_courses to authenticated;

create or replace function public.doripe_validate_course_places(input_place_ids text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(input_place_ids), 0) < 2 then
    raise exception 'a course requires at least two places' using errcode = '22023';
  end if;
  if cardinality(input_place_ids) > 30 then
    raise exception 'a course supports at most thirty places' using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct candidate.place_id)
    from unnest(input_place_ids) as candidate(place_id)
  ) then
    raise exception 'course places must be unique' using errcode = '22023';
  end if;

  if not public.doripe_all_ready_place_ids(input_place_ids) then
    raise exception 'all course places must be public and ready' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.doripe_validate_course_places(text[]) from public, anon, authenticated;

create or replace function public.upsert_course_with_places(
  p_course_id uuid,
  p_name text,
  p_is_public boolean,
  p_start_place_id text,
  p_expected_version integer,
  p_place_ids text[]
)
returns public.courses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  changed_course public.courses;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'course name is required' using errcode = '22023';
  end if;

  perform public.doripe_validate_course_places(p_place_ids);

  if p_start_place_id is not null and not exists (
    select 1
    from public.places
    where places.id = p_start_place_id
      and places.status = 'ready'
      and places.photo_qa_status = 'approved'
      and places.qa_status = 'ready'
      and places.merged_into_place_id is null
  ) then
    raise exception 'start place must be public and ready' using errcode = '22023';
  end if;
  if p_start_place_id is null or not (p_start_place_id = any(p_place_ids)) then
    raise exception 'start place must occur in the course' using errcode = '22023';
  end if;

  if p_course_id is null or p_expected_version = 0 then
    insert into public.courses (id, user_id, name, is_public, start_place_id)
    values (coalesce(p_course_id, gen_random_uuid()), actor_id, btrim(p_name), p_is_public, p_start_place_id)
    returning * into changed_course;
  else
    if p_expected_version is null then
      raise exception 'expected version is required' using errcode = '23502';
    end if;

    update public.courses
    set
      name = btrim(p_name),
      is_public = p_is_public,
      start_place_id = p_start_place_id,
      version = version + 1,
      updated_at = now()
    where id = p_course_id
      and user_id = actor_id
      and status = 'active'
      and version = p_expected_version
    returning * into changed_course;

    if changed_course.id is null then
      raise exception 'course not found or version conflict' using errcode = '40001';
    end if;

    delete from public.course_places where course_id = changed_course.id;
  end if;

  insert into public.course_places (course_id, place_id, position)
  select changed_course.id, item.place_id, (item.ordinality - 1)::integer
  from unnest(p_place_ids) with ordinality as item(place_id, ordinality);

  return changed_course;
end;
$$;

create or replace function public.replace_course_places(
  p_course_id uuid,
  p_expected_version integer,
  p_place_ids text[]
)
returns public.courses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  changed_course public.courses;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;

  perform public.doripe_validate_course_places(p_place_ids);

  update public.courses
  set version = version + 1, updated_at = now()
  where id = p_course_id
    and user_id = actor_id
    and status = 'active'
    and version = p_expected_version
  returning * into changed_course;

  if changed_course.id is null then
    raise exception 'course not found or version conflict' using errcode = '40001';
  end if;

  delete from public.course_places where course_id = changed_course.id;
  insert into public.course_places (course_id, place_id, position)
  select changed_course.id, item.place_id, (item.ordinality - 1)::integer
  from unnest(p_place_ids) with ordinality as item(place_id, ordinality);

  return changed_course;
end;
$$;

create or replace function public.replace_course_place(
  p_course_id uuid,
  p_course_place_id uuid,
  p_new_place_id text,
  p_reason text,
  p_expected_version integer
)
returns public.courses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_course public.courses;
  current_course_place public.course_places;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'replacement reason is required' using errcode = '22023';
  end if;

  select * into current_course
  from public.courses
  where id = p_course_id
    and user_id = actor_id
    and status = 'active'
  for update;

  if current_course.id is null or current_course.version <> p_expected_version then
    raise exception 'course not found or version conflict' using errcode = '40001';
  end if;

  select * into current_course_place
  from public.course_places
  where id = p_course_place_id
    and course_id = p_course_id
  for update;

  if current_course_place.id is null then
    raise exception 'course place not found' using errcode = 'P0002';
  end if;
  if current_course_place.place_id = p_new_place_id then
    raise exception 'replacement place must differ' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.course_places
    where course_id = p_course_id
      and place_id = p_new_place_id
      and id <> p_course_place_id
  ) then
    raise exception 'course places must be unique' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.places
    where places.id = p_new_place_id
      and places.status = 'ready'
      and places.photo_qa_status = 'approved'
      and places.qa_status = 'ready'
      and places.merged_into_place_id is null
  ) then
    raise exception 'replacement place must be public and ready' using errcode = '22023';
  end if;

  update public.course_places
  set place_id = p_new_place_id, updated_at = now()
  where id = p_course_place_id;

  insert into public.course_place_replacements (
    course_id,
    course_place_id,
    old_place_id,
    new_place_id,
    replaced_by,
    reason,
    expected_version
  ) values (
    p_course_id,
    p_course_place_id,
    current_course_place.place_id,
    p_new_place_id,
    actor_id,
    btrim(p_reason),
    p_expected_version
  );

  update public.courses
  set version = version + 1, updated_at = now()
  where id = p_course_id
  returning * into current_course;

  return current_course;
end;
$$;

create or replace function public.archive_course(
  p_course_id uuid,
  p_expected_version integer
)
returns public.courses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  changed_course public.courses;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;

  update public.courses
  set status = 'archived', is_public = false, version = version + 1, updated_at = now()
  where id = p_course_id
    and user_id = actor_id
    and status = 'active'
    and version = p_expected_version
  returning * into changed_course;

  if changed_course.id is null then
    raise exception 'course not found or version conflict' using errcode = '40001';
  end if;

  return changed_course;
end;
$$;

revoke all on function public.upsert_course_with_places(uuid, text, boolean, text, integer, text[]) from public, anon;
revoke all on function public.replace_course_places(uuid, integer, text[]) from public, anon;
revoke all on function public.replace_course_place(uuid, uuid, text, text, integer) from public, anon;
revoke all on function public.archive_course(uuid, integer) from public, anon;
grant execute on function public.upsert_course_with_places(uuid, text, boolean, text, integer, text[]) to authenticated;
grant execute on function public.replace_course_places(uuid, integer, text[]) to authenticated;
grant execute on function public.replace_course_place(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.archive_course(uuid, integer) to authenticated;
