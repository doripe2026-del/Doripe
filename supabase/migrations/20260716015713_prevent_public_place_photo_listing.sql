-- Public bucket object URLs do not require a SELECT policy. These policies
-- expose bucket contents through the Storage listing API.
drop policy if exists "Public can read app photo objects" on storage.objects;
drop policy if exists "Public can read place photos" on storage.objects;
