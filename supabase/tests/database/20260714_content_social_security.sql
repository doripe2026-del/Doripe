-- Run after `supabase db reset` with psql ON_ERROR_STOP enabled.
begin;
select plan(1);

do $$
declare
  expected_table text;
begin
  foreach expected_table in array array[
    'media_assets',
    'contents',
    'content_places',
    'content_media',
    'profile_follows',
    'content_likes',
    'comments',
    'inquiries',
    'reports'
  ] loop
    if to_regclass('public.' || expected_table) is null then
      raise exception 'missing content/social table: %', expected_table;
    end if;
    if not exists (
      select 1 from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = expected_table
        and pg_class.relrowsecurity
    ) then
      raise exception 'RLS is not enabled: %', expected_table;
    end if;
  end loop;
end;
$$;

do $$
begin
  if to_regprocedure('public.upsert_content_draft(uuid,text,text,uuid,integer,text[],uuid[])') is null
    or to_regprocedure('public.submit_content(uuid,integer)') is null
    or to_regprocedure('public.update_owned_comment(uuid,text,integer)') is null
    or to_regprocedure('public.hide_owned_comment(uuid)') is null
    or to_regprocedure('public.complete_media_upload(uuid,text,bigint,text)') is null
    or to_regprocedure('public.delete_owned_media_asset(uuid)') is null then
    raise exception 'required content/social/media RPC is missing';
  end if;

  if has_function_privilege('anon', 'public.upsert_content_draft(uuid,text,text,uuid,integer,text[],uuid[])', 'execute')
    or has_function_privilege('anon', 'public.complete_media_upload(uuid,text,bigint,text)', 'execute')
    or not has_function_privilege('authenticated', 'public.submit_content(uuid,integer)', 'execute') then
    raise exception 'content/media RPC privilege boundary is invalid';
  end if;
end;
$$;

do $$
declare
  expected_trigger text;
begin
  foreach expected_trigger in array array[
    'profile_follows_adjust_count',
    'content_likes_adjust_count',
    'comments_adjust_count'
  ] loop
    if not exists (
      select 1 from pg_trigger
      where tgname = expected_trigger and not tgisinternal
    ) then
      raise exception 'missing atomic counter trigger: %', expected_trigger;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.media_assets', 'select')
    or has_table_privilege('anon', 'public.profile_follows', 'select')
    or has_table_privilege('anon', 'public.content_likes', 'select')
    or has_table_privilege('anon', 'public.inquiries', 'select')
    or has_table_privilege('anon', 'public.reports', 'select') then
    raise exception 'private content/social/support table has an anonymous grant';
  end if;

  if not has_table_privilege('anon', 'public.contents', 'select')
    or not has_table_privilege('anon', 'public.comments', 'select') then
    raise exception 'published content read grants are missing';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'media-quarantine' and public = false and file_size_limit = 10485760
  ) then
    raise exception 'private media quarantine bucket is not ready';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'places'
      and column_name = 'region_id'
      and is_nullable = 'YES'
  ) then
    raise exception 'nullable places.region_id is missing';
  end if;
end;
$$;

select pass('content, social, support, media, and place-region security assertions passed');
select * from finish();

rollback;
