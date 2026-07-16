-- Forward-only VALIDATE step, separated so production can schedule it independently.

alter table public.places validate constraint places_operating_hours_object_check;
alter table public.places validate constraint places_duplicate_not_self_check;
alter table public.places validate constraint places_merge_not_self_check;
