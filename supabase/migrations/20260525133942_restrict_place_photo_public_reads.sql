drop policy if exists "Public can read approved place photos" on public.place_photos;

create policy "Public can read approved place photos for ready places"
  on public.place_photos for select
  using (
    permission_status = 'approved'
    and photo_type in ('cover', 'gallery')
    and exists (
      select 1
      from public.places
      where places.id = place_photos.place_id
        and places.status = 'ready'
        and places.photo_qa_status = 'approved'
        and places.qa_status = 'ready'
    )
  );
