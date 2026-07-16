-- Forward-only durable rate-limit foundation for production public writes.

create table public.rate_limit_buckets (
  route_key text not null,
  bucket_key_hash text not null,
  request_limit integer not null check (request_limit between 1 and 10000),
  window_seconds integer not null check (window_seconds between 1 and 86400),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (route_key, bucket_key_hash),
  check (char_length(route_key) between 1 and 120),
  check (route_key ~ '^[A-Za-z0-9][A-Za-z0-9:_/.-]{0,119}$'),
  check (bucket_key_hash ~ '^[a-f0-9]{64}$')
);

create index rate_limit_buckets_window_started_idx
  on public.rate_limit_buckets(window_started_at);

alter table public.rate_limit_buckets enable row level security;

revoke all on public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_bucket_key_hash text,
  p_route_key text,
  p_limit integer,
  p_window_seconds integer,
  p_cost integer default 1
)
returns table (
  is_allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bucket public.rate_limit_buckets%rowtype;
  v_now timestamptz := clock_timestamp();
  next_count integer;
begin
  if p_bucket_key_hash is null or p_bucket_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'bucket key must be a lowercase SHA-256 hex digest' using errcode = '22023';
  end if;
  if p_route_key is null
    or char_length(p_route_key) not between 1 and 120
    or p_route_key !~ '^[A-Za-z0-9][A-Za-z0-9:_/.-]{0,119}$' then
    raise exception 'invalid rate-limit route key' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 10000 then
    raise exception 'rate limit must be between 1 and 10000' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'rate-limit window must be between 1 and 86400 seconds' using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 1 or p_cost > p_limit then
    raise exception 'rate-limit cost must be between 1 and the limit' using errcode = '22023';
  end if;

  insert into public.rate_limit_buckets (
    route_key,
    bucket_key_hash,
    request_limit,
    window_seconds,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_route_key,
    p_bucket_key_hash,
    p_limit,
    p_window_seconds,
    v_now,
    0,
    v_now
  )
  on conflict (route_key, bucket_key_hash) do nothing;

  select * into current_bucket
  from public.rate_limit_buckets
  where route_key = p_route_key
    and bucket_key_hash = p_bucket_key_hash
  for update;

  if current_bucket.window_started_at + make_interval(secs => current_bucket.window_seconds) <= v_now
    or current_bucket.request_limit <> p_limit
    or current_bucket.window_seconds <> p_window_seconds then
    update public.rate_limit_buckets
    set
      request_limit = p_limit,
      window_seconds = p_window_seconds,
      window_started_at = v_now,
      request_count = p_cost,
      updated_at = v_now
    where route_key = p_route_key
      and bucket_key_hash = p_bucket_key_hash
    returning * into current_bucket;

    return query
      select true, p_limit - p_cost,
        v_now + make_interval(secs => p_window_seconds);
    return;
  end if;

  next_count := current_bucket.request_count + p_cost;
  if next_count <= p_limit then
    update public.rate_limit_buckets
    set request_count = next_count, updated_at = v_now
    where route_key = p_route_key
      and bucket_key_hash = p_bucket_key_hash;

    return query
      select true, p_limit - next_count,
        current_bucket.window_started_at + make_interval(secs => current_bucket.window_seconds);
  else
    update public.rate_limit_buckets
    set updated_at = v_now
    where route_key = p_route_key
      and bucket_key_hash = p_bucket_key_hash;

    return query
      select false, greatest(p_limit - current_bucket.request_count, 0),
        current_bucket.window_started_at + make_interval(secs => current_bucket.window_seconds);
  end if;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer, integer)
  to service_role;

comment on table public.rate_limit_buckets is
  'Durable fixed-window limits. bucket_key_hash must be an API-generated SHA-256 digest, never raw PII or an IP address.';
comment on function public.consume_rate_limit(text, text, integer, integer, integer) is
  'Atomically consumes a durable rate-limit bucket. Server service role only.';
