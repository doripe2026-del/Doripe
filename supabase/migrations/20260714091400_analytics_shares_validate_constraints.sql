-- Forward-only VALIDATE step, separated for production scheduling.

alter table public.shared_links validate constraint shared_links_canonical_target_shape_check;
alter table public.shared_links validate constraint shared_links_revocation_shape_check;
