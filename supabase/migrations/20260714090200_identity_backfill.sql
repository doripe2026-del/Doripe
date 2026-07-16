-- Forward-only DATA migration, intentionally separate from schema and constraints.

insert into public.user_accounts (
  user_id,
  email,
  status,
  email_verified_at,
  created_at,
  updated_at
)
select
  users.id,
  coalesce(nullif(users.email, ''), nullif(profiles.email, '')),
  'active',
  users.email_confirmed_at,
  coalesce(profiles.created_at, users.created_at, now()),
  coalesce(profiles.updated_at, users.updated_at, now())
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
on conflict (user_id) do nothing;

insert into public.public_profiles (
  user_id,
  display_name,
  created_at,
  updated_at
)
select
  users.id,
  coalesce(
    nullif(btrim(profiles.display_name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    ''
  ),
  coalesce(profiles.created_at, users.created_at, now()),
  coalesce(profiles.updated_at, users.updated_at, now())
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
on conflict (user_id) do nothing;
