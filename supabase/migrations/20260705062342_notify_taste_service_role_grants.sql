grant usage on schema public to service_role;

grant select, insert
  on table public.notify_taste_results
  to service_role;

grant insert
  on table public.notify_taste_events
  to service_role;
