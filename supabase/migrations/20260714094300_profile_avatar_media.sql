-- Versioned profile updates and private media-backed avatars.

alter table public.public_profiles
  add column if not exists avatar_media_id uuid references public.media_assets(id) on delete set null,
  add column if not exists version integer not null default 1 check (version > 0);

drop policy if exists "Active users can insert own safe profile" on public.public_profiles;
drop policy if exists "Active users can update own safe profile" on public.public_profiles;

create policy "Active users can insert own safe profile"
  on public.public_profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and (
      avatar_media_id is null
      or exists (
        select 1 from public.media_assets
        where media_assets.id = public_profiles.avatar_media_id
          and media_assets.owner_user_id = (select auth.uid())
          and media_assets.kind = 'image'
          and media_assets.status in ('uploaded', 'approved')
      )
    )
  );

create policy "Active users can update own safe profile"
  on public.public_profiles for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
    and visibility in ('public', 'private')
    and (
      avatar_media_id is null
      or exists (
        select 1 from public.media_assets
        where media_assets.id = public_profiles.avatar_media_id
          and media_assets.owner_user_id = (select auth.uid())
          and media_assets.kind = 'image'
          and media_assets.status in ('uploaded', 'approved')
      )
    )
  );

create or replace function public.update_my_profile(
  p_display_name text,
  p_bio text,
  p_avatar_media_id uuid,
  p_expected_version integer
)
returns public.public_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  changed_profile public.public_profiles;
begin
  if actor_id is null or not public.doripe_account_is_active(actor_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 40
    or p_bio is null or char_length(p_bio) > 500
    or p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid profile input' using errcode = '22023';
  end if;
  if p_avatar_media_id is not null and not exists (
    select 1 from public.media_assets
    where id = p_avatar_media_id
      and owner_user_id = actor_id
      and kind = 'image'
      and status in ('uploaded', 'approved')
  ) then
    raise exception 'avatar media is not available' using errcode = '22023';
  end if;

  update public.public_profiles
  set display_name = btrim(p_display_name),
      bio = p_bio,
      avatar_media_id = p_avatar_media_id,
      version = version + 1,
      updated_at = now()
  where user_id = actor_id and version = p_expected_version
  returning * into changed_profile;
  if changed_profile.user_id is null then
    raise exception 'profile version conflict' using errcode = '40001';
  end if;
  return changed_profile;
end;
$$;

revoke all on function public.update_my_profile(text, text, uuid, integer) from public, anon;
grant execute on function public.update_my_profile(text, text, uuid, integer) to authenticated;
