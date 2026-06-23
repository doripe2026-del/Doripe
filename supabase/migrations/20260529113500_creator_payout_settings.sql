alter table public.creator_profiles
  add column if not exists payout_bank_name text not null default '',
  add column if not exists payout_account_holder text not null default '',
  add column if not exists payout_account_number text not null default '',
  add column if not exists payout_schedule text not null default 'monthly' check (payout_schedule in ('monthly', 'manual')),
  add column if not exists payout_note text not null default '',
  add column if not exists payout_updated_at timestamptz;
