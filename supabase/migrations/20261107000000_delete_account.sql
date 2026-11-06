-- Delete your account (#67 follow-up). The server deletes the auth user with
-- the admin API; memberships go with it (on delete cascade), and everything
-- you added stays with the band, shown as "Former member".
--
-- Before that, this checks the one rule a cascade would skip: a band always
-- keeps an owner. It returns the bands that would be left without one, and
-- deletes nothing if there are any. Otherwise it removes your email from
-- invites you accepted, so it doesn't outlive the account.

create function public.prepare_account_deletion()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocking text[];
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(array_agg(w.name order by w.name), '{}')
  into v_blocking
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = auth.uid()
    and m.role = 'owner'
    and not exists (
      select 1 from public.workspace_members o
      where o.workspace_id = m.workspace_id and o.role = 'owner' and o.user_id <> auth.uid()
    );

  if cardinality(v_blocking) = 0 then
    update public.invites set email = null where accepted_by = auth.uid();
  end if;

  return v_blocking;
end;
$$;

revoke all on function public.prepare_account_deletion from public, anon;
grant execute on function public.prepare_account_deletion to authenticated;
