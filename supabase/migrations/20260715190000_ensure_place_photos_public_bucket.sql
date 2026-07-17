insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-photos-public',
  'place-photos-public',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read place photos" on storage.objects;

create policy "Public can read place photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'place-photos-public');
