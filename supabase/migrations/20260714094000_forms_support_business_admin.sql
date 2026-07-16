-- Forward-only forms, support, content, media, and business operations foundation.

alter table public.categories add column if not exists version integer not null default 1 check (version > 0);
alter table public.content_tags add column if not exists version integer not null default 1 check (version > 0);
alter table public.places add column if not exists version integer not null default 1 check (version > 0);
alter table public.place_photos
  add column if not exists status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deleted')),
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists updated_at timestamptz not null default now();
alter table public.user_accounts add column if not exists version integer not null default 1 check (version > 0);
alter table public.media_assets add column if not exists operator_note text not null default '';
alter table public.contents add column if not exists moderation_note text not null default '';
alter table public.inquiries add column if not exists operator_note text not null default '';
alter table public.reports add column if not exists operator_note text not null default '';

create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'beta', 'creator', 'business', 'recommendation', 'inquiry', 'partner', 'campaign',
    'notify-taste', 'notify-event'
  )),
  status text not null default 'received' check (status in ('received', 'reviewing', 'accepted', 'rejected', 'closed')),
  label text not null default '',
  contact_email text,
  deduplication_key text not null check (char_length(deduplication_key) between 16 and 128),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  source text not null check (char_length(source) between 1 and 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  operator_note text not null default '',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, deduplication_key)
);

create table public.business_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  status text not null default 'lead' check (status in ('lead', 'active', 'inactive')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_partnerships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.business_organizations(id) on delete restrict,
  place_id text not null references public.places(id) on delete restrict,
  status text not null check (status in ('contact', 'meeting', 'pilot', 'partner', 'ended', 'excluded')),
  operator_note text not null default '',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, place_id)
);

create table public.business_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.business_organizations(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  operator_note text not null default '',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index intake_submissions_kind_status_created_idx on public.intake_submissions(kind, status, created_at desc, id desc);
create index inquiries_status_created_idx on public.inquiries(status, created_at desc, id desc);
create index reports_status_created_idx on public.reports(status, created_at desc, id desc);
create index business_partnerships_status_created_idx on public.business_partnerships(status, created_at desc, id desc);
create index business_campaigns_status_created_idx on public.business_campaigns(status, created_at desc, id desc);

alter table public.intake_submissions enable row level security;
alter table public.business_organizations enable row level security;
alter table public.business_partnerships enable row level security;
alter table public.business_campaigns enable row level security;

revoke all on public.intake_submissions, public.business_organizations, public.business_partnerships, public.business_campaigns from anon, authenticated;
grant select, insert, update, delete on public.intake_submissions, public.inquiries, public.reports,
  public.contents, public.media_assets, public.business_organizations, public.business_partnerships,
  public.business_campaigns to service_role;

create trigger intake_submissions_set_updated_at before update on public.intake_submissions
  for each row execute function public.doripe_set_updated_at();
create trigger inquiries_operator_set_updated_at before update on public.inquiries
  for each row execute function public.doripe_set_updated_at();
create trigger reports_operator_set_updated_at before update on public.reports
  for each row execute function public.doripe_set_updated_at();
create trigger contents_operator_set_updated_at before update on public.contents
  for each row execute function public.doripe_set_updated_at();
create trigger media_assets_operator_set_updated_at before update on public.media_assets
  for each row execute function public.doripe_set_updated_at();
create trigger business_organizations_set_updated_at before update on public.business_organizations
  for each row execute function public.doripe_set_updated_at();
create trigger business_partnerships_set_updated_at before update on public.business_partnerships
  for each row execute function public.doripe_set_updated_at();
create trigger business_campaigns_set_updated_at before update on public.business_campaigns
  for each row execute function public.doripe_set_updated_at();

comment on table public.intake_submissions is 'Private public-form intake. Payload and contact data are service-role/operator only.';
comment on column public.inquiries.operator_note is 'Operator-only support note; never selected by user-facing handlers.';
comment on table public.business_campaigns is 'Operator-managed campaign records; no direct client grants.';
