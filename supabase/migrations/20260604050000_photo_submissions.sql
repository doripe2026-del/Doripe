create table if not exists public.photo_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tally' check (source in ('tally', 'manual', 'dropbox')),
  source_form_id text not null default '',
  source_submission_id text not null default '',
  source_respondent_id text not null default '',
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'approved', 'published', 'rejected')),
  place_name text not null,
  submitter_type text not null default 'unknown' check (submitter_type in ('unknown', 'owner', 'creator', 'team', 'other')),
  submitter_name text not null default '',
  submitter_contact text not null default '',
  submitter_instagram_url text not null default '',
  consent_label text not null default '',
  consent_accepted boolean not null default false,
  consent_accepted_at timestamptz,
  consent_text_snapshot text not null default '',
  raw_payload jsonb not null default '{}',
  admin_note text not null default '',
  linked_place_id text references public.places(id) on delete set null,
  published_at timestamptz,
  source_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists photo_submissions_source_submission_idx
  on public.photo_submissions(source, source_submission_id)
  where source_submission_id <> '';

create index if not exists photo_submissions_status_created_idx
  on public.photo_submissions(status, created_at desc);

create index if not exists photo_submissions_place_name_idx
  on public.photo_submissions(place_name);

create index if not exists photo_submissions_linked_place_idx
  on public.photo_submissions(linked_place_id);

create table if not exists public.photo_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.photo_submissions(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  original_url text not null default '',
  source_file_name text not null default '',
  mime_type text not null default '',
  file_size bigint not null default 0 check (file_size >= 0),
  checksum_sha256 text not null default '',
  display_order integer not null default 0,
  review_status text not null default 'pending' check (review_status in ('pending', 'selected', 'rejected')),
  selected_for_card boolean not null default false,
  place_photo_id uuid references public.place_photos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists photo_submission_files_submission_order_idx
  on public.photo_submission_files(submission_id, display_order);

create unique index if not exists photo_submission_files_storage_path_idx
  on public.photo_submission_files(bucket_id, storage_path);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photo-submission-originals',
  'photo-submission-originals',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.photo_submissions enable row level security;
alter table public.photo_submission_files enable row level security;

create policy "Service role manages photo submissions"
  on public.photo_submissions for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "Service role manages photo submission files"
  on public.photo_submission_files for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
