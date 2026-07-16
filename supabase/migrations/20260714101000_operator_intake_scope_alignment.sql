-- Keep the database authorization decision aligned with every intake kind
-- exposed by the v1 operator API. This is a forward-only replacement of the
-- immutable scope resolver; existing resource mappings remain unchanged.

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
    when p_resource = 'intake' and p_intake_kind = 'creator' then 'users:moderate'
    when p_resource = 'intake' and p_intake_kind = 'recommendation' then 'content:write'
    when p_resource = 'intake' and p_intake_kind = 'inquiry' then 'users:moderate'
    when p_resource = 'intake' and p_intake_kind in ('business', 'partner', 'campaign') then 'business:write'
    else null
  end;
end;
$$;
