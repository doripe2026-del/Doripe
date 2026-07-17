-- Forward-only place/taxonomy constraints and access control.

alter table public.places
  add constraint places_operating_hours_object_check
  check (operating_hours is null or jsonb_typeof(operating_hours) = 'object') not valid,
  add constraint places_duplicate_not_self_check
  check (duplicate_of_place_id is null or duplicate_of_place_id <> id) not valid,
  add constraint places_merge_not_self_check
  check (merged_into_place_id is null or merged_into_place_id <> id) not valid;

create policy "Public can read active content tags"
  on public.content_tags for select
  to anon, authenticated
  using (status = 'active');

create policy "Public can read tags on ready places"
  on public.place_tags for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.places
      where places.id = place_tags.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
        and places.merged_into_place_id is null
    )
    and exists (
      select 1
      from public.content_tags
      where content_tags.id = place_tags.tag_id
        and content_tags.status = 'active'
    )
  );

grant select on public.content_tags, public.place_tags to anon, authenticated;
revoke all on public.place_external_ids, public.place_merge_history from anon, authenticated;
grant select, insert, update, delete
  on public.content_tags, public.place_tags, public.place_external_ids, public.place_merge_history
  to service_role;
