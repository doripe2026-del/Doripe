insert into public.regions (id, name, short_name, display_order, status, map_pin_x, map_pin_y)
values
  ('seongsu', '성수', '성수', 1, 'active', 249, 296),
  ('yongsan_hbc', '용산/HBC', '용산', 2, 'active', 182, 421),
  ('yeonnam_mangwon', '연남/망원', '연남', 3, 'active', 82, 335)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  display_order = excluded.display_order,
  status = excluded.status,
  map_pin_x = excluded.map_pin_x,
  map_pin_y = excluded.map_pin_y,
  updated_at = now();
