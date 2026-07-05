alter table public.notify_taste_results
  drop constraint if exists notify_taste_results_character_key_valid;

alter table public.notify_taste_results
  add constraint notify_taste_results_character_key_valid
  check (
    character_key in (
      'quiet_collector',
      'route_planner',
      'sunny_window',
      'alley_wanderer',
      'city_aesthetic',
      'food_first',
      'night_mood',
      'route_scene'
    )
  );
