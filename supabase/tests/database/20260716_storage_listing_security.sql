-- Run after `supabase db reset` with psql ON_ERROR_STOP enabled.
begin;
select plan(1);

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'place-photos-public'
      and public = true
  ) then
    raise exception 'public place photo bucket is missing';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Public can read app photo objects',
        'Public can read place photos'
      )
  ) then
    raise exception 'public place photo bucket still allows object listing';
  end if;
end;
$$;

select pass('public place photo URLs work without storage object listing policies');
select * from finish();

rollback;
