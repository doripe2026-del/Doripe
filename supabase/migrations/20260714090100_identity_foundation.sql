-- Forward-only identity EXPAND migration. Roll back with a new migration.

create table public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  status text not null default 'active'
    check (status in ('active', 'restricted', 'withdrawal_requested', 'withdrawn')),
  email_verified_at timestamptz,
  restriction_reason text,
  restricted_until timestamptz,
  withdrawal_requested_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_profiles (
  user_id uuid primary key references public.user_accounts(user_id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  avatar_path text,
  visibility text not null default 'public'
    check (visibility in ('public', 'private', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_onboarding (
  user_id uuid primary key references public.user_accounts(user_id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.user_accounts(user_id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  enabled boolean not null default true,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operator_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  scopes text[] not null default '{}'::text[],
  display_label text not null default '',
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_position(scopes, null) is null),
  check ((is_active and disabled_at is null) or not is_active)
);

create table public.operator_audit_logs (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid not null references public.operator_accounts(user_id) on delete restrict,
  request_id uuid not null,
  action text not null check (btrim(action) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id text not null default '',
  reason text not null check (btrim(reason) <> ''),
  before_data jsonb check (before_data is null or jsonb_typeof(before_data) = 'object'),
  after_data jsonb check (after_data is null or jsonb_typeof(after_data) = 'object'),
  created_at timestamptz not null default now()
);

create index operator_audit_logs_entity_created_idx
  on public.operator_audit_logs(entity_type, entity_id, created_at desc);
create index operator_audit_logs_operator_created_idx
  on public.operator_audit_logs(operator_user_id, created_at desc);

alter table public.user_accounts enable row level security;
alter table public.public_profiles enable row level security;
alter table public.user_onboarding enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.operator_accounts enable row level security;
alter table public.operator_audit_logs enable row level security;

create or replace function public.doripe_provision_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_accounts (
    user_id,
    email,
    email_verified_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    email_verified_at = excluded.email_verified_at,
    updated_at = now();

  insert into public.public_profiles (user_id, display_name, created_at, updated_at)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      ''
    ),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.doripe_provision_user_identity() from public, anon, authenticated;

drop trigger if exists doripe_provision_user_identity on auth.users;
create trigger doripe_provision_user_identity
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.doripe_provision_user_identity();

create or replace function public.doripe_reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'operator audit rows are immutable' using errcode = '55000';
end;
$$;

revoke all on function public.doripe_reject_audit_mutation() from public, anon, authenticated;

create trigger operator_audit_logs_immutable
  before update or delete on public.operator_audit_logs
  for each row execute function public.doripe_reject_audit_mutation();

comment on table public.user_accounts is 'Private authentication/account state; never expose through public profile reads.';
comment on table public.public_profiles is 'PII-safe profile fields intended for controlled public or owner reads.';
comment on column public.operator_accounts.scopes is 'Explicit configurable authorization scopes. Display labels never authorize.';
