-- Forward-only analytics/idempotency/sharing constraints and access control.

alter table public.shared_links
  add constraint shared_links_canonical_target_shape_check
  check (
    (
      target_type is null
      and target_place_id is null
      and target_course_id is null
      and target_content_id is null
    )
    or (
      target_type = 'place'
      and target_place_id is not null
      and target_course_id is null
      and target_content_id is null
    )
    or (
      target_type = 'course'
      and target_place_id is null
      and target_course_id is not null
      and target_content_id is null
    )
    or (
      target_type = 'content'
      and target_place_id is null
      and target_course_id is null
      and target_content_id is not null
    )
  ) not valid,
  add constraint shared_links_revocation_shape_check
  check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (
      revoked_at is not null
      and revocation_reason is not null
      and btrim(revocation_reason) <> ''
    )
  ) not valid;

revoke all on public.analytics_sessions, public.analytics_events, public.idempotency_records
  from anon, authenticated;
grant select, insert, update, delete
  on public.analytics_sessions, public.analytics_events, public.idempotency_records
  to service_role;

alter function public.doripe_shared_link_has_ready_content(text, text, text[]) set search_path = '';
revoke all on function public.doripe_shared_link_has_ready_content(text, text, text[]) from public;
grant execute on function public.doripe_shared_link_has_ready_content(text, text, text[])
  to anon, authenticated, service_role;

create or replace function public.doripe_share_target_is_public(
  input_target_type text,
  input_target_place_id text,
  input_target_course_id uuid,
  input_target_content_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when input_target_type = 'place' then exists (
      select 1
      from public.places
      where places.id = input_target_place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
        and places.merged_into_place_id is null
    )
    when input_target_type = 'course' then exists (
      select 1
      from public.courses
      where courses.id = input_target_course_id
        and courses.status = 'active'
        and courses.is_public
        and public.doripe_account_is_active(courses.user_id)
    )
    when input_target_type = 'content' then false
    else false
  end;
$$;

revoke all on function public.doripe_share_target_is_public(text, text, uuid, uuid) from public;
grant execute on function public.doripe_share_target_is_public(text, text, uuid, uuid)
  to anon, authenticated, service_role;

drop policy if exists "Public can read valid shared links" on public.shared_links;
drop policy if exists "Users can create own ready shared links" on public.shared_links;
drop policy if exists "Users can read own shared links" on public.shared_links;

create policy "Public can read valid nonrevoked canonical or legacy shared links"
  on public.shared_links for select
  to anon, authenticated
  using (
    revoked_at is null
    and expires_at > now()
    and (
      (
        target_type is not null
        and public.doripe_share_target_is_public(
          target_type,
          target_place_id,
          target_course_id,
          target_content_id
        )
      )
      or (
        target_type is null
        and public.doripe_shared_link_has_ready_content(content_type, place_id, place_ids)
      )
    )
  );

create policy "Active users can create own public target shared links"
  on public.shared_links for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and public.doripe_account_is_active(created_by)
    and revoked_at is null
    and expires_at > now()
    and expires_at <= now() + interval '365 days'
    and (
      (
        target_type is not null
        and public.doripe_share_target_is_public(
          target_type,
          target_place_id,
          target_course_id,
          target_content_id
        )
      )
      or (
        target_type is null
        and public.doripe_shared_link_has_ready_content(content_type, place_id, place_ids)
      )
    )
  );

create policy "Users can read own shared links"
  on public.shared_links for select
  to authenticated
  using (
    (select auth.uid()) = created_by
    and public.doripe_account_is_active(created_by)
  );

create policy "Active owners can revoke own shared links"
  on public.shared_links for update
  to authenticated
  using (
    (select auth.uid()) = created_by
    and public.doripe_account_is_active(created_by)
    and revoked_at is null
  )
  with check (
    (select auth.uid()) = created_by
    and revoked_at is not null
    and revoked_by = (select auth.uid())
    and revocation_reason is not null
    and btrim(revocation_reason) <> ''
  );

grant select on public.shared_links to anon, authenticated;
grant insert on public.shared_links to authenticated;
revoke update on public.shared_links from authenticated;
grant update (revoked_at, revoked_by, revocation_reason, updated_at)
  on public.shared_links to authenticated;
