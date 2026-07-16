-- Forward-only EXPAND migration. Roll back with a new migration.
-- The legacy public bucket remains unchanged until the separately gated cutover.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'media-quarantine',
    'media-quarantine',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'media-approved',
    'media-approved',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can manage own media quarantine objects" on storage.objects;
create policy "Users can manage own media quarantine objects"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'media-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'media-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read own approved media objects" on storage.objects;
create policy "Users can read own approved media objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media-approved'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

comment on policy "Users can manage own media quarantine objects" on storage.objects is
  'Object names must begin with the authenticated user UUID. Public delivery uses server-issued URLs.';
comment on policy "Users can read own approved media objects" on storage.objects is
  'Published delivery remains server-controlled; this policy only permits an owner to read their own path.';
