-- Forward-only security and atomic mutation migration. Roll back with a new migration.

revoke all on table public.media_assets from anon, authenticated;
revoke all on table public.contents from anon, authenticated;
revoke all on table public.content_places from anon, authenticated;
revoke all on table public.content_media from anon, authenticated;
revoke all on table public.profile_follows from anon, authenticated;
revoke all on table public.content_likes from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
revoke all on table public.inquiries from anon, authenticated;
revoke all on table public.reports from anon, authenticated;

grant select on public.contents, public.content_places, public.content_media, public.comments to anon, authenticated;
grant select, insert on public.media_assets to authenticated;
grant select, insert, delete on public.profile_follows, public.content_likes to authenticated;
grant insert on public.comments to authenticated;
grant select, insert on public.inquiries, public.reports to authenticated;

create policy "Public or owner can read contents"
  on public.contents for select
  to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));

create policy "Active owners can create draft contents"
  on public.contents for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'draft'
    and public.doripe_account_is_active((select auth.uid()))
  );

create policy "Active owners can update editable contents"
  on public.contents for update
  to authenticated
  using (
    author_id = (select auth.uid())
    and status in ('draft', 'rejected')
    and public.doripe_account_is_active((select auth.uid()))
  )
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'rejected')
    and public.doripe_account_is_active((select auth.uid()))
  );

create policy "Readers can read visible content places"
  on public.content_places for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.contents
      where contents.id = content_places.content_id
        and (contents.status = 'published' or contents.author_id = (select auth.uid()))
    )
  );

create policy "Readers can read visible content media links"
  on public.content_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.contents
      where contents.id = content_media.content_id
        and (contents.status = 'published' or contents.author_id = (select auth.uid()))
    )
  );

create policy "Owners can read own media assets"
  on public.media_assets for select
  to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "Active users can register own private image uploads"
  on public.media_assets for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and public.doripe_account_is_active((select auth.uid()))
    and kind = 'image'
    and mime_type in ('image/jpeg', 'image/png', 'image/webp')
    and byte_size <= 10485760
    and duration_seconds is null
    and source_type = 'user'
    and storage_bucket = 'media-quarantine'
    and status = 'pending'
    and rights_status = 'pending'
  );

create policy "Users can read own following edges"
  on public.profile_follows for select
  to authenticated
  using (follower_user_id = (select auth.uid()));

create policy "Active users can follow public profiles"
  on public.profile_follows for insert
  to authenticated
  with check (
    follower_user_id = (select auth.uid())
    and public.doripe_account_is_active((select auth.uid()))
    and exists (
      select 1 from public.public_profiles
      where public_profiles.user_id = profile_follows.followed_user_id
        and public_profiles.visibility = 'public'
    )
  );

create policy "Users can unfollow profiles"
  on public.profile_follows for delete
  to authenticated
  using (follower_user_id = (select auth.uid()));

create policy "Users can read own content likes"
  on public.content_likes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Active users can like published content"
  on public.content_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.doripe_account_is_active((select auth.uid()))
    and exists (
      select 1 from public.contents
      where contents.id = content_likes.content_id and contents.status = 'published'
    )
  );

create policy "Users can remove own content likes"
  on public.content_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Public can read visible comments on published content"
  on public.comments for select
  to anon, authenticated
  using (
    (
      status = 'visible'
      and exists (
        select 1 from public.contents
        where contents.id = comments.content_id and contents.status = 'published'
      )
    )
    or author_id = (select auth.uid())
  );

create policy "Active users can comment on published content"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'visible'
    and public.doripe_account_is_active((select auth.uid()))
    and exists (
      select 1 from public.contents
      where contents.id = comments.content_id and contents.status = 'published'
    )
  );

create policy "Users can read own inquiries"
  on public.inquiries for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Active users can create own inquiries"
  on public.inquiries for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'received'
    and public.doripe_account_is_active((select auth.uid()))
  );

create policy "Users can read own report statuses"
  on public.reports for select
  to authenticated
  using (reporter_user_id = (select auth.uid()));

create policy "Active users can create own reports"
  on public.reports for insert
  to authenticated
  with check (
    reporter_user_id = (select auth.uid())
    and status = 'received'
    and public.doripe_account_is_active((select auth.uid()))
  );

create or replace function public.doripe_adjust_follow_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.public_profiles
    set follower_count = follower_count + 1
    where user_id = new.followed_user_id;
    return new;
  end if;

  update public.public_profiles
  set follower_count = greatest(follower_count - 1, 0)
  where user_id = old.followed_user_id;
  return old;
end;
$$;

create trigger profile_follows_adjust_count
  after insert or delete on public.profile_follows
  for each row execute function public.doripe_adjust_follow_count();

create or replace function public.doripe_adjust_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.contents set like_count = like_count + 1 where id = new.content_id;
    return new;
  end if;

  update public.contents set like_count = greatest(like_count - 1, 0) where id = old.content_id;
  return old;
end;
$$;

create trigger content_likes_adjust_count
  after insert or delete on public.content_likes
  for each row execute function public.doripe_adjust_like_count();

create or replace function public.doripe_adjust_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content_id uuid;
  v_delta integer := 0;
begin
  v_content_id := coalesce(new.content_id, old.content_id);
  if tg_op = 'INSERT' and new.status = 'visible' then
    v_delta := 1;
  elsif tg_op = 'DELETE' and old.status = 'visible' then
    v_delta := -1;
  elsif tg_op = 'UPDATE' then
    v_delta := (case when new.status = 'visible' then 1 else 0 end)
      - (case when old.status = 'visible' then 1 else 0 end);
  end if;

  if v_delta <> 0 then
    update public.contents
    set comment_count = greatest(comment_count + v_delta, 0)
    where id = v_content_id;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger comments_adjust_count
  after insert or update of status or delete on public.comments
  for each row execute function public.doripe_adjust_comment_count();

create or replace function public.upsert_content_draft(
  p_content_id uuid,
  p_type text,
  p_caption text,
  p_course_id uuid,
  p_expected_version integer,
  p_place_ids text[],
  p_media_ids uuid[]
)
returns setof public.contents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_content public.contents%rowtype;
  v_index integer;
begin
  if v_user_id is null or not public.doripe_account_is_active(v_user_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_content_id is null
    or p_type not in ('place', 'course')
    or p_caption is null
    or char_length(p_caption) > 2000
    or p_expected_version < 0
    or coalesce(cardinality(p_place_ids), 0) not between 1 and 30
    or coalesce(cardinality(p_media_ids), 0) > 5 then
    raise exception 'invalid content input' using errcode = '22023';
  end if;
  if (select count(*) from unnest(p_place_ids) item) <> (select count(distinct item) from unnest(p_place_ids) item)
    or (select count(*) from unnest(p_media_ids) item) <> (select count(distinct item) from unnest(p_media_ids) item) then
    raise exception 'duplicate content relation' using errcode = '22023';
  end if;
  if (p_type = 'place' and p_course_id is not null) or (p_type = 'course' and p_course_id is null) then
    raise exception 'content type target mismatch' using errcode = '22023';
  end if;
  if (select count(*) from public.places
      where id = any(p_place_ids) and status = 'ready' and qa_status = 'ready' and photo_qa_status = 'approved')
      <> cardinality(p_place_ids) then
    raise exception 'content place is not ready' using errcode = '23503';
  end if;
  if p_course_id is not null and not exists (
    select 1 from public.courses
    where id = p_course_id and status = 'active' and (user_id = v_user_id or is_public)
  ) then
    raise exception 'content course is not visible' using errcode = '23503';
  end if;
  if cardinality(p_media_ids) > 0 and (
    select count(*) from public.media_assets
    where id = any(p_media_ids)
      and owner_user_id = v_user_id
      and status in ('uploaded', 'approved')
      and rights_status in ('pending', 'approved')
  ) <> cardinality(p_media_ids) then
    raise exception 'content media is not attachable' using errcode = '22023';
  end if;

  select * into v_content from public.contents where id = p_content_id for update;
  if not found then
    if p_expected_version <> 0 then
      raise exception 'content not found' using errcode = 'P0002';
    end if;
    insert into public.contents (id, author_id, type, caption, course_id)
    values (p_content_id, v_user_id, p_type, p_caption, p_course_id)
    returning * into v_content;
  else
    if v_content.author_id <> v_user_id then
      raise exception 'content owner required' using errcode = '42501';
    end if;
    if v_content.status not in ('draft', 'rejected') then
      raise exception 'content is not editable' using errcode = '22023';
    end if;
    if v_content.version <> p_expected_version then
      raise exception 'content version conflict' using errcode = '40001';
    end if;
    update public.contents
    set caption = p_caption,
        course_id = p_course_id,
        version = version + 1,
        updated_at = now()
    where id = p_content_id
    returning * into v_content;
  end if;

  delete from public.content_places where content_id = p_content_id;
  for v_index in 1..cardinality(p_place_ids) loop
    insert into public.content_places (content_id, place_id, position)
    values (p_content_id, p_place_ids[v_index], v_index - 1);
  end loop;

  delete from public.content_media where content_id = p_content_id;
  if cardinality(p_media_ids) > 0 then
    for v_index in 1..cardinality(p_media_ids) loop
      insert into public.content_media (content_id, media_asset_id, position)
      values (p_content_id, p_media_ids[v_index], v_index - 1);
    end loop;
  end if;

  return query select * from public.contents where id = p_content_id;
end;
$$;

create or replace function public.submit_content(
  p_content_id uuid,
  p_expected_version integer
)
returns setof public.contents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_content public.contents%rowtype;
begin
  if v_user_id is null or not public.doripe_account_is_active(v_user_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  select * into v_content from public.contents where id = p_content_id for update;
  if not found or v_content.author_id <> v_user_id then
    raise exception 'content not found' using errcode = 'P0002';
  end if;
  if v_content.version <> p_expected_version then
    raise exception 'content version conflict' using errcode = '40001';
  end if;
  if v_content.status not in ('draft', 'rejected') then
    raise exception 'content is not submittable' using errcode = '22023';
  end if;
  if not exists (select 1 from public.content_places where content_id = p_content_id) then
    raise exception 'content requires a place' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.content_media
    join public.media_assets on media_assets.id = content_media.media_asset_id
    where content_media.content_id = p_content_id
      and (media_assets.owner_user_id <> v_user_id or media_assets.status not in ('uploaded', 'approved'))
  ) then
    raise exception 'content media is not ready' using errcode = '22023';
  end if;

  update public.contents
  set status = 'submitted', submitted_at = now(), version = version + 1, updated_at = now()
  where id = p_content_id;
  return query select * from public.contents where id = p_content_id;
end;
$$;

create or replace function public.update_owned_comment(
  p_comment_id uuid,
  p_body text,
  p_expected_version integer
)
returns setof public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment public.comments%rowtype;
begin
  if v_user_id is null or not public.doripe_account_is_active(v_user_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'invalid comment' using errcode = '22023';
  end if;
  select * into v_comment from public.comments where id = p_comment_id for update;
  if not found or v_comment.author_id <> v_user_id or v_comment.status <> 'visible' then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
  if v_comment.version <> p_expected_version then
    raise exception 'comment version conflict' using errcode = '40001';
  end if;
  update public.comments
  set body = btrim(p_body), version = version + 1, updated_at = now()
  where id = p_comment_id;
  return query select * from public.comments where id = p_comment_id;
end;
$$;

create or replace function public.hide_owned_comment(p_comment_id uuid)
returns setof public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment public.comments%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into v_comment from public.comments where id = p_comment_id for update;
  if not found or v_comment.author_id <> v_user_id then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
  if v_comment.status = 'visible' then
    update public.comments
    set status = 'hidden', hidden_at = now(), version = version + 1, updated_at = now()
    where id = p_comment_id;
  end if;
  return query select * from public.comments where id = p_comment_id;
end;
$$;

create or replace function public.complete_media_upload(
  p_asset_id uuid,
  p_storage_path text,
  p_byte_size bigint,
  p_checksum_sha256 text
)
returns setof public.media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.media_assets%rowtype;
  v_object_size bigint;
begin
  if v_user_id is null or not public.doripe_account_is_active(v_user_id) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  select * into v_asset from public.media_assets where id = p_asset_id for update;
  if not found or v_asset.owner_user_id <> v_user_id then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;
  if v_asset.status = 'uploaded'
    and v_asset.storage_path = p_storage_path
    and v_asset.byte_size = p_byte_size
    and v_asset.checksum_sha256 = p_checksum_sha256 then
    return query select * from public.media_assets where id = p_asset_id;
    return;
  end if;
  if v_asset.status <> 'pending'
    or v_asset.storage_bucket <> 'media-quarantine'
    or v_asset.storage_path <> p_storage_path
    or v_asset.byte_size <> p_byte_size
    or v_asset.checksum_sha256 <> p_checksum_sha256 then
    raise exception 'media metadata mismatch' using errcode = '22023';
  end if;
  select case
    when coalesce(objects.metadata ->> 'size', '') ~ '^[0-9]+$' then (objects.metadata ->> 'size')::bigint
    else null
  end into v_object_size
  from storage.objects
  where bucket_id = v_asset.storage_bucket and name = v_asset.storage_path;
  if v_object_size is null or v_object_size <> v_asset.byte_size then
    raise exception 'uploaded object metadata mismatch' using errcode = '22023';
  end if;
  update public.media_assets
  set status = 'uploaded', completed_at = now(), version = version + 1, updated_at = now()
  where id = p_asset_id;
  return query select * from public.media_assets where id = p_asset_id;
end;
$$;

create or replace function public.delete_owned_media_asset(p_asset_id uuid)
returns setof public.media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.media_assets%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into v_asset from public.media_assets where id = p_asset_id for update;
  if not found or v_asset.owner_user_id <> v_user_id then
    raise exception 'media asset not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.content_media
    join public.contents on contents.id = content_media.content_id
    where content_media.media_asset_id = p_asset_id
      and contents.status in ('submitted', 'reviewing', 'published')
  ) then
    raise exception 'media asset is in use' using errcode = '55000';
  end if;
  if v_asset.status <> 'deleted' then
    delete from public.content_media where media_asset_id = p_asset_id;
    update public.media_assets
    set status = 'deleted', deleted_at = now(), version = version + 1, updated_at = now()
    where id = p_asset_id;
  end if;
  return query select * from public.media_assets where id = p_asset_id;
end;
$$;

revoke all on function public.doripe_adjust_follow_count() from public, anon, authenticated;
revoke all on function public.doripe_adjust_like_count() from public, anon, authenticated;
revoke all on function public.doripe_adjust_comment_count() from public, anon, authenticated;
revoke all on function public.upsert_content_draft(uuid,text,text,uuid,integer,text[],uuid[]) from public, anon, authenticated;
revoke all on function public.submit_content(uuid,integer) from public, anon, authenticated;
revoke all on function public.update_owned_comment(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.hide_owned_comment(uuid) from public, anon, authenticated;
revoke all on function public.complete_media_upload(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function public.delete_owned_media_asset(uuid) from public, anon, authenticated;

grant execute on function public.upsert_content_draft(uuid,text,text,uuid,integer,text[],uuid[]) to authenticated;
grant execute on function public.submit_content(uuid,integer) to authenticated;
grant execute on function public.update_owned_comment(uuid,text,integer) to authenticated;
grant execute on function public.hide_owned_comment(uuid) to authenticated;
grant execute on function public.complete_media_upload(uuid,text,bigint,text) to authenticated;
grant execute on function public.delete_owned_media_asset(uuid) to authenticated;

comment on function public.upsert_content_draft(uuid,text,text,uuid,integer,text[],uuid[]) is
  'Atomically creates or version-updates an owned content draft and its ordered place/media relations.';
comment on function public.complete_media_upload(uuid,text,bigint,text) is
  'Completes an owned private upload only after the storage object size and declared immutable metadata match.';
