-- Telling new moderators (#195). Making someone a moderator now says who
-- they are and whether they're new, so the app can email them once. They
-- also see a note in the app until they dismiss it.

alter table public.app_moderators add column welcomed_at timestamptz;

drop function public.grant_moderator_user(uuid);
create function public.grant_moderator_user(p_user_id uuid)
returns table (email text, display_name text, added boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added int;
begin
  if not public.is_app_admin() then
    raise exception 'only admins can make moderators' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'no such account' using errcode = 'no_data_found';
  end if;
  insert into public.app_moderators (user_id, granted_by) values (p_user_id, auth.uid())
  on conflict (user_id) do nothing;
  get diagnostics v_added = row_count;
  return query
    select u.email::text,
      (select m.display_name from public.workspace_members m where m.user_id = u.id order by m.created_at limit 1),
      v_added > 0
    from auth.users u where u.id = p_user_id;
end;
$$;
revoke all on function public.grant_moderator_user from public, anon;
grant execute on function public.grant_moderator_user to authenticated;

-- The note: shown until the moderator dismisses it.
create function public.moderator_welcome_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_moderators where user_id = auth.uid() and welcomed_at is null)
$$;
revoke all on function public.moderator_welcome_pending from public, anon;
grant execute on function public.moderator_welcome_pending to authenticated;

create function public.dismiss_moderator_welcome()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.app_moderators set welcomed_at = now() where user_id = auth.uid() and welcomed_at is null
$$;
revoke all on function public.dismiss_moderator_welcome from public, anon;
grant execute on function public.dismiss_moderator_welcome to authenticated;
