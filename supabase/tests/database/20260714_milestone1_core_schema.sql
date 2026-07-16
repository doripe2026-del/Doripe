-- Run after `supabase db reset` with psql ON_ERROR_STOP enabled.
begin;
select plan(1);

do $$
declare
  expected_table text;
begin
  foreach expected_table in array array[
    'user_accounts',
    'public_profiles',
    'user_onboarding',
    'notification_preferences',
    'operator_accounts',
    'operator_audit_logs',
    'content_tags',
    'place_tags',
    'place_external_ids',
    'place_merge_history',
    'courses',
    'course_places',
    'course_place_replacements',
    'saved_courses',
    'analytics_sessions',
    'analytics_events',
    'idempotency_records',
    'rate_limit_buckets'
  ] loop
    if to_regclass('public.' || expected_table) is null then
      raise exception 'missing milestone 1 table: %', expected_table;
    end if;

    if not exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = expected_table
        and pg_class.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on milestone 1 table: %', expected_table;
    end if;
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_profiles'
      and column_name in ('email', 'phone', 'password_hash')
  ) then
    raise exception 'public_profiles contains a forbidden PII/authentication column';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_accounts'
      and column_name = 'user_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_accounts'
      and column_name = 'status'
  ) then
    raise exception 'user_accounts API contract columns are missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operator_accounts'
      and column_name = 'scopes'
      and udt_name = '_text'
  ) then
    raise exception 'operator_accounts.scopes text[] is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_profiles'
      and column_name = 'avatar_media_id'
      and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_profiles'
      and column_name = 'version'
      and udt_name = 'int4'
  ) then
    raise exception 'versioned media-backed profile columns are missing';
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.analytics_sessions', 'select')
    or has_table_privilege('authenticated', 'public.analytics_events', 'insert')
    or has_table_privilege('anon', 'public.idempotency_records', 'select')
    or has_table_privilege('authenticated', 'public.operator_accounts', 'select')
    or has_table_privilege('anon', 'public.rate_limit_buckets', 'select')
    or has_function_privilege(
      'authenticated',
      'public.consume_rate_limit(text,text,integer,integer,integer)',
      'execute'
    ) then
    raise exception 'a server-only milestone 1 table has a client grant';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'media-quarantine' and public = false
  ) or not exists (
    select 1 from storage.buckets
    where id = 'media-approved' and public = false
  ) then
    raise exception 'private media expand buckets are missing or public';
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.request_account_withdrawal()') is null
    or to_regprocedure('public.upsert_course_with_places(uuid,text,boolean,text,integer,text[])') is null
    or to_regprocedure('public.replace_course_places(uuid,integer,text[])') is null
    or to_regprocedure('public.replace_course_place(uuid,uuid,text,text,integer)') is null
    or to_regprocedure('public.archive_course(uuid,integer)') is null
    or to_regprocedure('public.consume_rate_limit(text,text,integer,integer,integer)') is null
    or to_regprocedure('public.update_my_profile(text,text,uuid,integer)') is null
    or to_regprocedure('public.doripe_set_updated_at()') is null then
    raise exception 'required milestone 1 RPC is missing';
  end if;
end;
$$;

do $$
declare
  attempt record;
begin
  select * into attempt
  from public.consume_rate_limit(repeat('a', 64), 'test:public-write', 2, 60, 1);
  if not attempt.is_allowed or attempt.remaining <> 1 then
    raise exception 'first durable rate-limit consume failed';
  end if;

  select * into attempt
  from public.consume_rate_limit(repeat('a', 64), 'test:public-write', 2, 60, 1);
  if not attempt.is_allowed or attempt.remaining <> 0 then
    raise exception 'second durable rate-limit consume failed';
  end if;

  select * into attempt
  from public.consume_rate_limit(repeat('a', 64), 'test:public-write', 2, 60, 1);
  if attempt.is_allowed or attempt.remaining <> 0 then
    raise exception 'durable rate limit did not deny an exhausted bucket';
  end if;
end;
$$;

select pass('milestone 1 schema, RLS, RPC, and durable limiter assertions passed');
select * from finish();

rollback;
