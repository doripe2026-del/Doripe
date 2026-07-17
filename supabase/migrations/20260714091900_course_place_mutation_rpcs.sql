-- Atomic course-place mutations used by the v1 API.

alter table public.course_places
  add column if not exists note text;

alter table public.course_places
  add constraint course_places_note_length_check
  check (note is null or char_length(note) <= 500) not valid;

alter table public.course_places validate constraint course_places_note_length_check;

create or replace function public.add_course_place(
  p_course_id uuid,
  p_place_id text,
  p_position integer,
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
  place_count integer;
  insert_position integer;
begin
  select * into current_course from public.courses
  where id = p_course_id and user_id = actor_id and status = 'active'
  for update;
  if current_course.id is null then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if current_course.version <> p_expected_version then
    raise exception 'course version conflict' using errcode = '40001';
  end if;
  if not public.doripe_all_ready_place_ids(array[current_course.start_place_id, p_place_id]) then
    raise exception 'place must be public and ready' using errcode = '22023';
  end if;
  if exists (select 1 from public.course_places where course_id = p_course_id and place_id = p_place_id) then
    raise exception 'course places must be unique' using errcode = '23505';
  end if;
  select count(*) into place_count from public.course_places where course_id = p_course_id;
  if place_count >= 30 then
    raise exception 'course place limit reached' using errcode = '22023';
  end if;
  insert_position := coalesce(p_position, place_count);
  if insert_position < 0 or insert_position > place_count then
    raise exception 'invalid course position' using errcode = '22023';
  end if;

  update public.course_places set position = position + 1000 where course_id = p_course_id;
  update public.course_places
  set position = case
    when position - 1000 >= insert_position then position - 999
    else position - 1000
  end
  where course_id = p_course_id;
  insert into public.course_places(course_id, place_id, position)
  values (p_course_id, p_place_id, insert_position);

  update public.courses set version = version + 1, updated_at = now()
  where id = p_course_id returning * into current_course;
  return current_course;
end;
$$;

create or replace function public.update_course_place_metadata(
  p_course_id uuid,
  p_course_place_id uuid,
  p_stay_minutes integer,
  p_note text,
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
begin
  select * into current_course from public.courses
  where id = p_course_id and user_id = actor_id and status = 'active'
  for update;
  if current_course.id is null then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if current_course.version <> p_expected_version then
    raise exception 'course version conflict' using errcode = '40001';
  end if;
  if p_stay_minutes is not null and (p_stay_minutes < 0 or p_stay_minutes > 1440) then
    raise exception 'invalid stay duration' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note is too long' using errcode = '22023';
  end if;

  update public.course_places
  set stay_duration_minutes = p_stay_minutes, note = nullif(btrim(p_note), ''), updated_at = now()
  where id = p_course_place_id and course_id = p_course_id;
  if not found then
    raise exception 'course place not found' using errcode = 'P0002';
  end if;
  update public.courses set version = version + 1, updated_at = now()
  where id = p_course_id returning * into current_course;
  return current_course;
end;
$$;

create or replace function public.delete_course_place(
  p_course_id uuid,
  p_course_place_id uuid
)
returns public.courses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_course public.courses;
  place_count integer;
  deleted_place_id text;
begin
  select * into current_course from public.courses
  where id = p_course_id and user_id = actor_id and status = 'active'
  for update;
  if current_course.id is null then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
  if not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  select count(*) into place_count from public.course_places where course_id = p_course_id;
  select place_id into deleted_place_id from public.course_places
  where id = p_course_place_id and course_id = p_course_id;
  if deleted_place_id is null then
    return current_course;
  end if;
  if place_count <= 2 then
    raise exception 'a course requires at least two places' using errcode = '22023';
  end if;

  delete from public.course_places where id = p_course_place_id and course_id = p_course_id;
  update public.course_places set position = position + 1000 where course_id = p_course_id;
  update public.course_places as target
  set position = ordered.new_position
  from (
    select id, (row_number() over (order by position, id) - 1)::integer as new_position
    from public.course_places where course_id = p_course_id
  ) as ordered
  where target.id = ordered.id;
  if current_course.start_place_id = deleted_place_id then
    select place_id into current_course.start_place_id
    from public.course_places where course_id = p_course_id order by position limit 1;
  end if;
  update public.courses
  set start_place_id = current_course.start_place_id, version = version + 1, updated_at = now()
  where id = p_course_id returning * into current_course;
  return current_course;
end;
$$;

revoke all on function public.add_course_place(uuid, text, integer, integer) from public, anon;
revoke all on function public.update_course_place_metadata(uuid, uuid, integer, text, integer) from public, anon;
revoke all on function public.delete_course_place(uuid, uuid) from public, anon;
grant execute on function public.add_course_place(uuid, text, integer, integer) to authenticated;
grant execute on function public.update_course_place_metadata(uuid, uuid, integer, text, integer) to authenticated;
grant execute on function public.delete_course_place(uuid, uuid) to authenticated;
