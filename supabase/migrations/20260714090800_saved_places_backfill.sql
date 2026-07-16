-- Forward-only DATA migration, separate from schema and constraint tightening.
-- Timeouts make an unexpectedly large production table fail safely for rescheduling.

set lock_timeout = '5s';
set statement_timeout = '60s';

update public.saved_places
set
  saved_at = coalesce(saved_at, created_at),
  updated_at = coalesce(updated_at, created_at)
where saved_at is null
   or updated_at is null;

reset lock_timeout;
reset statement_timeout;
