-- What's New (#216): the newest changelog entry each person has seen, so the
-- header can show a mark until they open the page. Per account, not per band.

create table public.changelog_seen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_on date not null
);
alter table public.changelog_seen enable row level security;
-- No policies: only the functions below read or write it.

-- The date of the newest entry this person has seen. Someone who's never
-- opened the page has seen everything from before they joined.
create function public.changelog_seen_on()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.seen_on from public.changelog_seen s where s.user_id = auth.uid()),
    (select u.created_at::date from auth.users u where u.id = auth.uid())
  )
$$;
revoke all on function public.changelog_seen_on from public, anon;
grant execute on function public.changelog_seen_on to authenticated;

-- Opening the page: remember the newest entry date. Never moves backward.
create function public.mark_changelog_seen(p_on date)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.changelog_seen (user_id, seen_on)
  select auth.uid(), least(p_on, current_date + 1)
  where auth.uid() is not null
  on conflict (user_id) do update set seen_on = greatest(public.changelog_seen.seen_on, excluded.seen_on)
$$;
revoke all on function public.mark_changelog_seen from public, anon;
grant execute on function public.mark_changelog_seen to authenticated;
