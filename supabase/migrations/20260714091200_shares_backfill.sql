-- Forward-only DATA migration. Only unambiguous legacy place links are mapped.
-- Legacy route payloads remain legacy until production mapping identifies a canonical course.

set lock_timeout = '5s';
set statement_timeout = '60s';

update public.shared_links
set
  target_type = 'place',
  target_place_id = place_id,
  updated_at = coalesce(updated_at, created_at)
where target_type is null
  and content_type = 'place'
  and place_id is not null;

update public.shared_links
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

reset lock_timeout;
reset statement_timeout;
