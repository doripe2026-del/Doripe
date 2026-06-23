alter table public.places
  add column if not exists phone_text text not null default '',
  add column if not exists representative_menu_name text not null default '',
  add column if not exists representative_menu_price text not null default '',
  add column if not exists instagram_url text not null default '';

alter table public.places
  drop constraint if exists places_image_credit_check;

alter table public.places
  add constraint places_image_credit_check
  check (image_credit in ('team', 'owner', 'creator', 'licensed', 'unsplash', 'naver'));

alter table public.place_photos
  drop constraint if exists place_photos_source_type_check;

alter table public.place_photos
  add constraint place_photos_source_type_check
  check (source_type in ('team', 'owner', 'creator', 'licensed', 'naver'));
