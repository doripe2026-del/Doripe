-- Run after `supabase db reset` with psql ON_ERROR_STOP enabled.
begin;
select plan(1);

do $$
declare
  expected_table text;
begin
  foreach expected_table in array array[
    'intake_submissions',
    'inquiries',
    'reports',
    'contents',
    'media_assets',
    'business_organizations',
    'business_partnerships',
    'business_campaigns'
  ] loop
    if to_regclass('public.' || expected_table) is null then
      raise exception 'missing forms/admin table: %', expected_table;
    end if;
    if not exists (
      select 1 from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = expected_table
        and pg_class.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on forms/admin table: %', expected_table;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.intake_submissions', 'select')
    or has_table_privilege('authenticated', 'public.intake_submissions', 'insert')
    or has_table_privilege('anon', 'public.business_partnerships', 'select')
    or has_table_privilege('authenticated', 'public.business_campaigns', 'select') then
    raise exception 'sensitive intake/business tables have a client grant';
  end if;

  if not has_table_privilege('service_role', 'public.intake_submissions', 'insert')
    or not has_table_privilege('service_role', 'public.operator_audit_logs', 'insert') then
    raise exception 'server role is missing forms/audit privileges';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'media_assets' and column_name = 'operator_note'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries' and column_name = 'operator_note'
  ) then
    raise exception 'operator-only moderation columns are missing';
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.operator_create_resource(uuid,uuid,text,jsonb,text)') is null
    or to_regprocedure('public.operator_transition_resource(uuid,uuid,text,text,text,text,integer,text,text)') is null then
    raise exception 'atomic operator mutation RPCs are missing';
  end if;
  if has_function_privilege(
      'anon',
      'public.operator_create_resource(uuid,uuid,text,jsonb,text)',
      'execute'
    ) or has_function_privilege(
      'authenticated',
      'public.operator_transition_resource(uuid,uuid,text,text,text,text,integer,text,text)',
      'execute'
    ) then
    raise exception 'client roles can execute operator mutation RPCs';
  end if;
  if not has_function_privilege(
      'service_role',
      'public.operator_create_resource(uuid,uuid,text,jsonb,text)',
      'execute'
    ) or not has_function_privilege(
      'service_role',
      'public.operator_transition_resource(uuid,uuid,text,text,text,text,integer,text,text)',
      'execute'
    ) then
    raise exception 'service role cannot execute operator mutation RPCs';
  end if;
end;
$$;

select pass('forms, business, and atomic operator audit assertions passed');
select * from finish();

rollback;
