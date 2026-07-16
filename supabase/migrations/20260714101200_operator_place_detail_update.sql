-- Atomically update the complete operator-editable place record and its audit log.

create or replace function public.operator_update_place(
  p_operator_id uuid,
  p_request_id uuid,
  p_place_id text,
  p_values jsonb,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
begin
  if p_request_id is null or p_place_id is null or btrim(p_place_id) = ''
    or p_values is null or jsonb_typeof(p_values) <> 'object' or p_values = '{}'::jsonb
    or p_expected_version is null or p_expected_version < 1
    or p_reason is null or btrim(p_reason) = '' then
    raise exception 'invalid operator place update' using errcode = '22023';
  end if;
  perform public.operator_assert_scope(p_operator_id, 'content:write');

  select to_jsonb(p) into before_data
  from public.places p
  where p.id = p_place_id
  for update;
  if before_data is null then
    raise exception 'place not found' using errcode = 'P0002';
  end if;
  if (before_data->>'version')::integer <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;

  update public.places p set
    name = case when p_values ? 'name' then p_values->>'name' else p.name end,
    short_copy = case when p_values ? 'short_copy' then p_values->>'short_copy' else p.short_copy end,
    category_id = case when p_values ? 'category_id' then p_values->>'category_id' else p.category_id end,
    neighborhood_id = case when p_values ? 'neighborhood_id' then p_values->>'neighborhood_id' else p.neighborhood_id end,
    address = case when p_values ? 'address' then p_values->>'address' else p.address end,
    lat = case when p_values ? 'lat' then (p_values->>'lat')::double precision else p.lat end,
    lng = case when p_values ? 'lng' then (p_values->>'lng')::double precision else p.lng end,
    nearest_station = case when p_values ? 'nearest_station' then p_values->>'nearest_station' else p.nearest_station end,
    hours_text = case when p_values ? 'hours_text' then p_values->>'hours_text' else p.hours_text end,
    phone_text = case when p_values ? 'phone_text' then p_values->>'phone_text' else p.phone_text end,
    mood_tags = case when p_values ? 'mood_tags' then array(select jsonb_array_elements_text(p_values->'mood_tags')) else p.mood_tags end,
    best_for = case when p_values ? 'best_for' then array(select jsonb_array_elements_text(p_values->'best_for')) else p.best_for end,
    time_tags = case when p_values ? 'time_tags' then array(select jsonb_array_elements_text(p_values->'time_tags')) else p.time_tags end,
    price_hint = case when p_values ? 'price_hint' then p_values->>'price_hint' else p.price_hint end,
    representative_menu_name = case when p_values ? 'representative_menu_name' then p_values->>'representative_menu_name' else p.representative_menu_name end,
    representative_menu_price = case when p_values ? 'representative_menu_price' then p_values->>'representative_menu_price' else p.representative_menu_price end,
    stay_time_minutes = case when p_values ? 'stay_time_minutes' then (p_values->>'stay_time_minutes')::integer else p.stay_time_minutes end,
    naver_place_url = case when p_values ? 'naver_place_url' then p_values->>'naver_place_url' else p.naver_place_url end,
    status = case when p_values ? 'status' then p_values->>'status' else p.status end,
    version = p.version + 1,
    updated_at = now()
  where p.id = p_place_id
  returning to_jsonb(p) into after_data;

  insert into public.operator_audit_logs(
    operator_user_id, request_id, action, entity_type, entity_id, reason, before_data, after_data
  ) values (
    p_operator_id, p_request_id, 'place.update', 'place', p_place_id, btrim(p_reason), before_data, after_data
  );
  return after_data;
end;
$$;

revoke all on function public.operator_update_place(uuid, uuid, text, jsonb, integer, text)
  from public, anon, authenticated;
grant execute on function public.operator_update_place(uuid, uuid, text, jsonb, integer, text)
  to service_role;
