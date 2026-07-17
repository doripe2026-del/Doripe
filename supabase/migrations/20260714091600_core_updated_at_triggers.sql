-- Forward-only timestamp consistency migration.

create or replace function public.doripe_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.doripe_set_updated_at() from public, anon, authenticated;

create trigger user_accounts_set_updated_at
  before update on public.user_accounts
  for each row execute function public.doripe_set_updated_at();
create trigger public_profiles_set_updated_at
  before update on public.public_profiles
  for each row execute function public.doripe_set_updated_at();
create trigger user_onboarding_set_updated_at
  before update on public.user_onboarding
  for each row execute function public.doripe_set_updated_at();
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.doripe_set_updated_at();
create trigger operator_accounts_set_updated_at
  before update on public.operator_accounts
  for each row execute function public.doripe_set_updated_at();
create trigger content_tags_set_updated_at
  before update on public.content_tags
  for each row execute function public.doripe_set_updated_at();
create trigger place_external_ids_set_updated_at
  before update on public.place_external_ids
  for each row execute function public.doripe_set_updated_at();
create trigger saved_places_set_updated_at
  before update on public.saved_places
  for each row execute function public.doripe_set_updated_at();
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.doripe_set_updated_at();
create trigger course_places_set_updated_at
  before update on public.course_places
  for each row execute function public.doripe_set_updated_at();
create trigger saved_courses_set_updated_at
  before update on public.saved_courses
  for each row execute function public.doripe_set_updated_at();
create trigger idempotency_records_set_updated_at
  before update on public.idempotency_records
  for each row execute function public.doripe_set_updated_at();
create trigger shared_links_set_updated_at
  before update on public.shared_links
  for each row execute function public.doripe_set_updated_at();
