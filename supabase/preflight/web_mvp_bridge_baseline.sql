-- Read-only production baseline guard for the Doripe web MVP bridge.
-- This file is intentionally outside supabase/migrations. It must pass before
-- a bridge migration is tested, and it must never be treated as authorization
-- to change production.

do $$
declare
  expected record;
  actual_count bigint;
  actual_type text;
  actual_migrations text[];
  expected_migrations constant text[] := array[
    '20260626002753',
    '20260626005454',
    '20260626010339',
    '20260627073734',
    '20260705063010',
    '20260705063049',
    '20260705063333',
    '20260705075436',
    '20260715101938'
  ];
begin
  for expected in
    select * from (values
      ('neighborhoods', 'id', 'uuid', 3::bigint),
      ('photo_providers', 'id', 'uuid', 2::bigint),
      ('places', 'id', 'uuid', 0::bigint),
      ('places', 'neighborhood_id', 'uuid', null::bigint),
      ('place_photos', 'id', 'uuid', 0::bigint),
      ('place_photos', 'place_id', 'uuid', null::bigint),
      ('place_tags', 'place_id', 'uuid', 0::bigint),
      ('place_tags', 'tag_id', 'uuid', null::bigint),
      ('shared_links', 'id', 'uuid', 0::bigint),
      ('shared_links', 'place_id', 'uuid', null::bigint),
      ('tag_groups', 'id', 'uuid', 3::bigint),
      ('tags', 'id', 'uuid', 11::bigint)
    ) as baseline(table_name, column_name, udt_name, row_count)
  loop
    if to_regclass('public.' || expected.table_name) is null then
      raise exception 'bridge baseline mismatch: missing table public.%', expected.table_name;
    end if;

    select columns.udt_name
      into actual_type
      from information_schema.columns
      where columns.table_schema = 'public'
        and columns.table_name = expected.table_name
        and columns.column_name = expected.column_name;
    if actual_type is distinct from expected.udt_name then
      raise exception 'bridge baseline mismatch: %.% expected %, got %',
        expected.table_name, expected.column_name, expected.udt_name, actual_type;
    end if;

    if expected.row_count is not null then
      execute format('select count(*) from public.%I', expected.table_name) into actual_count;
      if actual_count <> expected.row_count then
        raise exception 'bridge baseline mismatch: % expected % rows, got %',
          expected.table_name, expected.row_count, actual_count;
      end if;
    end if;
  end loop;

  for expected in
    select table_name from unnest(array[
      'app_events', 'app_sessions', 'app_users', 'discovery_run_places',
      'discovery_run_tags', 'discovery_runs', 'onboarding_answers',
      'place_actions', 'place_photos', 'place_tags', 'places', 'route_places',
      'routes', 'screen_review_tasks', 'shared_links'
    ]) as empty_tables(table_name)
  loop
    if to_regclass('public.' || expected.table_name) is null then
      raise exception 'bridge baseline mismatch: missing table public.%', expected.table_name;
    end if;
    execute format('select count(*) from public.%I', expected.table_name) into actual_count;
    if actual_count <> 0 then
      raise exception 'bridge baseline mismatch: % is no longer empty (% rows)',
        expected.table_name, actual_count;
    end if;
  end loop;

  select array_agg(version order by version)
    into actual_migrations
    from supabase_migrations.schema_migrations;
  if actual_migrations is distinct from expected_migrations then
    raise exception 'bridge baseline mismatch: remote migration history changed';
  end if;

  select count(*) into actual_count
    from storage.objects
    where bucket_id = 'place-photos-public';
  if actual_count <> 176 then
    raise exception 'bridge baseline mismatch: expected 176 storage objects, got %', actual_count;
  end if;
end;
$$;

select jsonb_build_object(
  'baseline_match', true,
  'production_migration_authorized', false,
  'next_step', 'restore into staging and test a forward-only bridge'
) as doripe_web_mvp_bridge_preflight;
