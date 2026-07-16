-- Comment reactions required by the current discovery comment UI.

alter table public.comments
  add column if not exists like_count integer not null default 0 check (like_count >= 0);

create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);

create index if not exists comment_likes_comment_idx
  on public.comment_likes(comment_id, created_at desc);

alter table public.comment_likes enable row level security;
revoke all on table public.comment_likes from anon, authenticated;
grant select, insert, delete on table public.comment_likes to authenticated;

create policy comment_likes_select_own
  on public.comment_likes for select to authenticated
  using (auth.uid() = user_id);

create policy comment_likes_insert_own_visible
  on public.comment_likes for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.doripe_account_is_active(auth.uid())
    and exists (
      select 1 from public.comments
      where comments.id = comment_likes.comment_id
        and comments.status = 'visible'
    )
  );

create policy comment_likes_delete_own
  on public.comment_likes for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.doripe_adjust_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  end if;
  update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  return old;
end;
$$;

create trigger comment_likes_adjust_count
  after insert or delete on public.comment_likes
  for each row execute function public.doripe_adjust_comment_like_count();

revoke all on function public.doripe_adjust_comment_like_count() from public, anon, authenticated;
