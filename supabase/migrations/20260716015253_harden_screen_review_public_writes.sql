do $$
declare
  review_table text;
begin
  foreach review_table in array array[
    'screen_review_screens',
    'screen_review_tasks'
  ] loop
    if to_regclass('public.' || review_table) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', review_table);
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      review_table
    );
    execute format(
      'grant select, insert on table public.%I to anon, authenticated',
      review_table
    );
  end loop;

  if to_regclass('public.screen_review_screens') is not null then
    execute 'drop policy if exists "screen review update screens" on public.screen_review_screens';
  end if;

  if to_regclass('public.screen_review_tasks') is not null then
    execute 'drop policy if exists "screen review update tasks" on public.screen_review_tasks';
    execute 'drop policy if exists "screen review delete tasks" on public.screen_review_tasks';
  end if;
end;
$$;
