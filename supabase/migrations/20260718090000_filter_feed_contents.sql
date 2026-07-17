-- Filter and paginate the public feed inside Postgres so API requests never
-- materialize unbounded place, tag, follow, or content ID lists.

create or replace function public.filter_feed_contents(
  p_scope text,
  p_region_id text default null,
  p_category_id text default null,
  p_tag_ids uuid[] default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_km double precision default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 21
)
returns setof public.contents
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select c.*
  from public.contents c
  where c.status = 'published'
    and (
      p_scope = 'discover'
      or (
        p_scope = 'following'
        and (select auth.uid()) is not null
        and exists (
          select 1
          from public.profile_follows pf
          where pf.follower_user_id = (select auth.uid())
            and pf.followed_user_id = c.author_id
        )
      )
    )
    and (
      (
        p_region_id is null
        and p_category_id is null
        and p_tag_ids is null
        and p_center_lat is null
        and p_center_lng is null
        and p_radius_km is null
      )
      or exists (
        select 1
        from public.content_places cp
        join public.places p on p.id = cp.place_id
        where cp.content_id = c.id
          and p.status = 'ready'
          and p.qa_status = 'ready'
          and p.photo_qa_status = 'approved'
          and p.merged_into_place_id is null
          and (p_region_id is null or p.region_id = p_region_id)
          and (p_category_id is null or p.category_id = p_category_id)
          and (
            p_tag_ids is null
            or (
              select count(distinct pt.tag_id)
              from public.place_tags pt
              where pt.place_id = p.id
                and pt.tag_id = any(p_tag_ids)
            ) = cardinality(p_tag_ids)
          )
          and (
            p_center_lat is null
            or (
              p.lat is not null
              and p.lng is not null
              and 6371.0088 * 2 * asin(sqrt(least(1.0, greatest(0.0,
                power(sin(radians((p.lat::double precision - p_center_lat) / 2)), 2)
                + cos(radians(p_center_lat)) * cos(radians(p.lat::double precision))
                * power(sin(radians((p.lng::double precision - p_center_lng) / 2)), 2)
              )))) <= p_radius_km
            )
          )
      )
    )
    and (
      p_cursor_published_at is null
      or (c.published_at, c.id) < (p_cursor_published_at, p_cursor_id)
    )
  order by c.published_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 1), 1), 51);
$$;

revoke all on function public.filter_feed_contents(
  text, text, text, uuid[], double precision, double precision,
  double precision, timestamptz, uuid, integer
) from public;

grant execute on function public.filter_feed_contents(
  text, text, text, uuid[], double precision, double precision,
  double precision, timestamptz, uuid, integer
) to anon, authenticated, service_role;
