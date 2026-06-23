alter table public.creator_profiles
  add column if not exists password_hash text not null default '',
  add column if not exists password_set_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists last_login_at timestamptz;

create index if not exists creator_profiles_last_login_idx
  on public.creator_profiles(last_login_at desc);
