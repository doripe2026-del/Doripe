-- Forward-only VALIDATE step, separated for production scheduling.

alter table public.saved_places validate constraint saved_places_removed_after_saved_check;
