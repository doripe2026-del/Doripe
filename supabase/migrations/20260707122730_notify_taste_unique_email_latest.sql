alter table public.notify_taste_results
  add column if not exists email_key text;

update public.notify_taste_results
set email_key = lower(trim(email))
where email_key is null;

delete from public.notify_taste_results kept
using public.notify_taste_results duplicate
where kept.email_key = duplicate.email_key
  and kept.created_at < duplicate.created_at;

delete from public.notify_taste_results kept
using public.notify_taste_results duplicate
where kept.email_key = duplicate.email_key
  and kept.created_at = duplicate.created_at
  and kept.id < duplicate.id;

alter table public.notify_taste_results
  alter column email_key set not null;

create unique index if not exists notify_taste_results_email_key_unique
  on public.notify_taste_results(email_key);

grant select, insert, update
  on table public.notify_taste_results
  to service_role;
