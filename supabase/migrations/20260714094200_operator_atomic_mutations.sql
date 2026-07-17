-- Operator mutations and their audit records must commit atomically.

create or replace function public.operator_required_scope(
  p_resource text,
  p_intake_kind text default null
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case
    when p_resource in ('category', 'tag', 'place', 'media', 'content', 'naver_import') then 'content:write'
    when p_resource in ('report', 'inquiry', 'user', 'curator') then 'users:moderate'
    when p_resource in ('organization', 'partnership', 'campaign') then 'business:write'
    when p_resource = 'intake' and p_intake_kind in ('beta', 'notify-taste', 'notify-event') then 'analytics:read'
    when p_resource = 'intake' and p_intake_kind = 'creator' then 'content:write'
    when p_resource = 'intake' and p_intake_kind = 'business' then 'business:write'
    else null
  end;
end;
$$;

create or replace function public.operator_assert_scope(
  p_operator_id uuid,
  p_required_scope text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_required_scope is null or not exists (
    select 1 from public.operator_accounts
    where user_id = p_operator_id
      and is_active
      and p_required_scope = any(scopes)
  ) then
    raise exception 'operator scope required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.operator_create_resource(
  p_operator_id uuid,
  p_request_id uuid,
  p_resource text,
  p_values jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  required_scope text := public.operator_required_scope(p_resource, null);
  entity_id text;
  after_data jsonb;
begin
  if p_request_id is null or p_values is null or jsonb_typeof(p_values) <> 'object'
    or p_reason is null or btrim(p_reason) = '' then
    raise exception 'invalid operator create request' using errcode = '22023';
  end if;
  perform public.operator_assert_scope(p_operator_id, required_scope);

  case p_resource
    when 'category' then
      insert into public.categories(id, name, display_order)
      values (p_values->>'id', p_values->>'name', coalesce((p_values->>'display_order')::integer, 0))
      returning id into entity_id;
      select to_jsonb(t) into after_data from public.categories t where t.id = entity_id;
    when 'tag' then
      insert into public.content_tags(key, name, group_key, display_order)
      values (p_values->>'key', p_values->>'name', coalesce(nullif(p_values->>'group_key', ''), 'general'),
        coalesce((p_values->>'display_order')::integer, 0))
      returning key into entity_id;
      select to_jsonb(t) into after_data from public.content_tags t where t.key = entity_id;
    when 'place' then
      insert into public.places(id, name, category_id, neighborhood_id, address, lat, lng)
      values (p_values->>'id', p_values->>'name', p_values->>'category_id', p_values->>'neighborhood_id',
        coalesce(p_values->>'address', ''), (p_values->>'lat')::double precision, (p_values->>'lng')::double precision)
      returning id into entity_id;
      select to_jsonb(t) into after_data from public.places t where t.id = entity_id;
    when 'organization' then
      insert into public.business_organizations(id, name, status)
      values ((p_values->>'id')::uuid, p_values->>'name', coalesce(p_values->>'status', 'lead'))
      returning id::text into entity_id;
      select to_jsonb(t) into after_data from public.business_organizations t where t.id::text = entity_id;
    when 'partnership' then
      insert into public.business_partnerships(organization_id, place_id, status)
      values ((p_values->>'organization_id')::uuid, p_values->>'place_id', p_values->>'status')
      returning id::text into entity_id;
      select to_jsonb(t) into after_data from public.business_partnerships t where t.id::text = entity_id;
    when 'campaign' then
      insert into public.business_campaigns(advertiser_id, name, starts_at, ends_at)
      values ((p_values->>'advertiser_id')::uuid, p_values->>'name',
        (p_values->>'starts_at')::timestamptz, (p_values->>'ends_at')::timestamptz)
      returning id::text into entity_id;
      select to_jsonb(t) into after_data from public.business_campaigns t where t.id::text = entity_id;
    when 'naver_import' then
      insert into public.intake_submissions(
        kind, label, deduplication_key, consent_version, source, payload
      ) values (
        'recommendation', p_values->>'label', p_values->>'deduplication_key',
        'operator-import-v1', 'admin_naver_import', coalesce(p_values->'payload', '{}'::jsonb)
      ) returning id::text into entity_id;
      select to_jsonb(t) into after_data from public.intake_submissions t where t.id::text = entity_id;
    else
      raise exception 'unsupported operator create resource' using errcode = '22023';
  end case;

  insert into public.operator_audit_logs(
    operator_user_id, request_id, action, entity_type, entity_id, reason, before_data, after_data
  ) values (
    p_operator_id, p_request_id, p_resource || '.create', p_resource, entity_id, btrim(p_reason), null, after_data
  );
  return after_data;
end;
$$;

create or replace function public.operator_transition_resource(
  p_operator_id uuid,
  p_request_id uuid,
  p_resource text,
  p_entity_id text,
  p_status text,
  p_note text,
  p_expected_version integer,
  p_reason text,
  p_intake_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  required_scope text := public.operator_required_scope(p_resource, p_intake_kind);
  table_name text;
  key_column text := 'id';
  note_column text;
  effective_kind text := p_resource;
  before_data jsonb;
  after_data jsonb;
  query_text text;
begin
  if p_request_id is null or p_entity_id is null or p_entity_id = ''
    or p_status is null or p_status !~ '^[a-z][a-z0-9_]{0,39}$'
    or p_expected_version is null or p_expected_version < 1
    or p_reason is null or btrim(p_reason) = '' then
    raise exception 'invalid operator transition request' using errcode = '22023';
  end if;
  perform public.operator_assert_scope(p_operator_id, required_scope);

  case p_resource
    when 'category' then table_name := 'categories';
    when 'tag' then table_name := 'content_tags'; key_column := 'key';
    when 'place' then table_name := 'places';
    when 'media' then table_name := 'media_assets'; note_column := 'operator_note';
    when 'content' then table_name := 'contents'; note_column := 'moderation_note';
    when 'report' then table_name := 'reports'; note_column := 'operator_note';
    when 'inquiry' then table_name := 'inquiries'; note_column := 'operator_note';
    when 'user' then table_name := 'user_accounts'; key_column := 'user_id'; note_column := 'restriction_reason';
    when 'curator' then table_name := 'intake_submissions'; note_column := 'operator_note'; p_intake_kind := 'creator';
    when 'organization' then table_name := 'business_organizations';
    when 'partnership' then table_name := 'business_partnerships'; note_column := 'operator_note';
    when 'campaign' then table_name := 'business_campaigns'; note_column := 'operator_note';
    when 'intake' then
      table_name := 'intake_submissions'; note_column := 'operator_note'; effective_kind := p_intake_kind;
    else
      raise exception 'unsupported operator transition resource' using errcode = '22023';
  end case;

  query_text := format('select to_jsonb(t) from public.%I t where %I::text = $1', table_name, key_column);
  if p_resource in ('curator', 'intake') then query_text := query_text || ' and kind = $2'; end if;
  query_text := query_text || ' for update';
  execute query_text into before_data using p_entity_id, p_intake_kind;
  if before_data is null then raise exception 'operator resource not found' using errcode = 'P0002'; end if;
  if coalesce((before_data->>'version')::integer, 1) <> p_expected_version then
    raise exception 'operator version conflict' using errcode = '40001';
  end if;

  query_text := format('update public.%I as t set status = $1, version = version + 1, updated_at = now()', table_name);
  if p_resource = 'media' and p_status = 'approved' then
    query_text := query_text || ', storage_bucket = ''media-approved'', rights_status = ''approved''';
  elsif p_resource = 'media' and p_status = 'rejected' then
    query_text := query_text || ', rights_status = ''rejected''';
  end if;
  if note_column is not null and p_note is not null then
    query_text := query_text || format(', %I = $2', note_column);
  end if;
  query_text := query_text || format(' where %I::text = $3 and version = $4', key_column);
  if p_resource in ('curator', 'intake') then query_text := query_text || ' and kind = $5'; end if;
  query_text := query_text || ' returning to_jsonb(t)';
  execute query_text into after_data using p_status, p_note, p_entity_id, p_expected_version, p_intake_kind;
  if after_data is null then raise exception 'operator version conflict' using errcode = '40001'; end if;

  insert into public.operator_audit_logs(
    operator_user_id, request_id, action, entity_type, entity_id, reason, before_data, after_data
  ) values (
    p_operator_id, p_request_id, effective_kind || '.transition', effective_kind,
    p_entity_id, btrim(p_reason), before_data, after_data
  );
  return after_data;
end;
$$;

revoke all on function public.operator_required_scope(text, text) from public, anon, authenticated;
revoke all on function public.operator_assert_scope(uuid, text) from public, anon, authenticated;
revoke all on function public.operator_create_resource(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.operator_transition_resource(uuid, uuid, text, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.operator_create_resource(uuid, uuid, text, jsonb, text) to service_role;
grant execute on function public.operator_transition_resource(uuid, uuid, text, text, text, text, integer, text, text)
  to service_role;
