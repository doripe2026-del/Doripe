insert into public.regions (id, name, short_name, display_order, status, map_pin_x, map_pin_y)
values
  ('seongsu', 'Seongsu', 'Seongsu', 1, 'active', 249, 296),
  ('yongsan_hbc', 'Yongsan / HBC', 'Yongsan', 2, 'active', 182, 421),
  ('yeonnam_mangwon', 'Yeonnam / Mangwon', 'Yeonnam', 3, 'active', 82, 335)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  display_order = excluded.display_order,
  status = excluded.status,
  map_pin_x = excluded.map_pin_x,
  map_pin_y = excluded.map_pin_y;

insert into public.neighborhoods (id, name, display_order, status)
values
  ('seongsu', '성수', 1, 'active'),
  ('yongsan_hbc', '용산/HBC', 2, 'active'),
  ('yeonnam_mangwon', '연남/망원', 3, 'active')
on conflict (id) do update set
  name = excluded.name,
  display_order = excluded.display_order,
  status = excluded.status;

update public.neighborhoods
set status = 'inactive'
where id not in ('seongsu', 'yongsan_hbc', 'yeonnam_mangwon');

insert into public.categories (id, name, display_order, status)
values
  ('doripe_pick', 'Doripe pick', 1, 'active'),
  ('curator_pick', 'Curator pick', 2, 'active'),
  ('partner_pick', 'Partner pick', 3, 'active'),
  ('community_save', 'Community save', 4, 'active')
on conflict (id) do update set
  name = excluded.name,
  display_order = excluded.display_order,
  status = excluded.status;

update public.categories
set status = 'inactive'
where id not in ('doripe_pick', 'curator_pick', 'partner_pick', 'community_save');

insert into public.decks (id, region_id, status, title, short_copy, tags, tone, display_order)
values
  ('yongsan-solo-afternoon', 'yongsan_hbc', 'active', 'Quiet afternoon', 'A calm Yongsan route for a light solo walk.', array['solo', 'calm'], 'sunset', 1)
on conflict (id) do update set
  region_id = excluded.region_id,
  status = excluded.status,
  title = excluded.title,
  short_copy = excluded.short_copy,
  tags = excluded.tags,
  tone = excluded.tone,
  display_order = excluded.display_order;
