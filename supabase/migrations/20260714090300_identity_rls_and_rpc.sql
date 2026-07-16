-- Forward-only identity access-control migration.

create or replace function public.doripe_account_is_active(input_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_accounts
    where user_accounts.user_id = input_user_id
      and user_accounts.status = 'active'
      and (
        user_accounts.restricted_until is null
        or user_accounts.restricted_until <= now()
      )
  );
$$;

revoke all on function public.doripe_account_is_active(uuid) from public;
grant execute on function public.doripe_account_is_active(uuid) to anon, authenticated, service_role;

drop policy if exists "Users can manage own media quarantine objects" on storage.objects;
create policy "Active users can manage own media quarantine objects"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'media-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.doripe_account_is_active((select auth.uid()))
  )
  with check (
    bucket_id = 'media-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.doripe_account_is_active((select auth.uid()))
  );

drop policy if exists "Users can read own approved media objects" on storage.objects;
create policy "Active users can read own approved media objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media-approved'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.doripe_account_is_active((select auth.uid()))
  );

create policy "Public or owner can read safe profiles"
  on public.public_profiles for select
  to anon, authenticated
  using (
    (
      (select auth.uid()) = user_id
      and public.doripe_account_is_active(user_id)
    )
    or (
      visibility = 'public'
      and public.doripe_account_is_active(user_id)
    )
  );

create policy "Active users can insert own safe profile"
  on public.public_profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
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
  );

create policy "Users can read own account"
  on public.user_accounts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Active users can read own onboarding"
  on public.user_onboarding for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );
create policy "Active users can insert own onboarding"
  on public.user_onboarding for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );
create policy "Active users can update own onboarding"
  on public.user_onboarding for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

create policy "Users can read own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );
create policy "Active users can insert own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );
create policy "Active users can update own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

grant select on public.public_profiles to anon, authenticated;
grant insert, update on public.public_profiles to authenticated;
grant select on public.user_accounts to authenticated;
grant select, insert, update on public.user_onboarding to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Active users can read own legacy profile"
  on public.profiles for select
  to authenticated
  using (
    (select auth.uid()) = id
    and public.doripe_account_is_active(id)
  );
create policy "Active users can insert own legacy profile"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = id
    and public.doripe_account_is_active(id)
  );
create policy "Active users can update own legacy profile"
  on public.profiles for update
  to authenticated
  using (
    (select auth.uid()) = id
    and public.doripe_account_is_active(id)
  )
  with check (
    (select auth.uid()) = id
    and public.doripe_account_is_active(id)
  );

drop policy if exists "Users can insert own events" on public.event_logs;
drop policy if exists "Users can read own events" on public.event_logs;
create policy "Active users can insert own legacy events"
  on public.event_logs for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );
create policy "Active users can read own legacy events"
  on public.event_logs for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.doripe_account_is_active(user_id)
  );

revoke all on public.operator_accounts from anon, authenticated;
revoke all on public.operator_audit_logs from anon, authenticated;
grant select, insert, update, delete on public.operator_accounts to service_role;
grant select, insert on public.operator_audit_logs to service_role;

create or replace function public.request_account_withdrawal()
returns public.user_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  updated_account public.user_accounts;
begin
  if requesting_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.user_accounts
  set
    status = 'withdrawal_requested',
    withdrawal_requested_at = coalesce(withdrawal_requested_at, now()),
    updated_at = now()
  where user_id = requesting_user_id
    and status in ('active', 'withdrawal_requested')
  returning * into updated_account;

  if updated_account.user_id is null then
    raise exception 'account cannot request withdrawal from its current state'
      using errcode = '55000';
  end if;

  return updated_account;
end;
$$;

revoke all on function public.request_account_withdrawal() from public, anon;
grant execute on function public.request_account_withdrawal() to authenticated;
