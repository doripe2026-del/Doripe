drop policy if exists "Users can insert own saved places" on public.saved_places;
drop policy if exists "Users can update own saved places" on public.saved_places;

create policy "Users can insert own ready saved places"
  on public.saved_places for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.places
      where places.id = saved_places.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
    )
  );

create policy "Users can update own ready saved places"
  on public.saved_places for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.places
      where places.id = saved_places.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
    )
  );

alter table public.event_logs
  drop constraint if exists event_logs_event_name_check;

alter table public.event_logs
  add constraint event_logs_event_name_check
  check (
    event_name in (
      'code_verified',
      'region_selected',
      'deck_selected',
      'deck_finished',
      'place_seen',
      'place_saved',
      'place_skipped',
      'place_gallery_opened',
      'place_selection_confirmed',
      'saved_list_opened',
      'route_opened',
      'route_order_confirmed',
      'route_shared',
      'route_navigation_started',
      'route_segment_clicked'
    )
  );
