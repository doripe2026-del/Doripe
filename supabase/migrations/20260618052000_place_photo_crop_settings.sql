alter table public.place_photos
  add column if not exists crop_x numeric(5,2) not null default 50,
  add column if not exists crop_y numeric(5,2) not null default 50,
  add column if not exists crop_zoom numeric(4,2) not null default 1;

alter table public.place_photos
  drop constraint if exists place_photos_crop_x_check,
  drop constraint if exists place_photos_crop_y_check,
  drop constraint if exists place_photos_crop_zoom_check;

alter table public.place_photos
  add constraint place_photos_crop_x_check check (crop_x >= 0 and crop_x <= 100),
  add constraint place_photos_crop_y_check check (crop_y >= 0 and crop_y <= 100),
  add constraint place_photos_crop_zoom_check check (crop_zoom >= 1 and crop_zoom <= 3);
