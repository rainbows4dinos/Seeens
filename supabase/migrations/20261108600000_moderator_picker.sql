-- Pick moderators by name (#195): admins choose from everyone on Seeens,
-- shown with their bands, instead of typing an email.

-- Everyone with an account, for admins only: name, email, bands, and role.
create function public.list_accounts()
returns table (user_id uuid, email text, display_name text, bands text, moderator boolean, admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text,
    (select m.display_name from public.workspace_members m where m.user_id = u.id order by m.created_at limit 1),
    (select string_agg(w.name, ', ' order by w.name) from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id where m.user_id = u.id),
    exists (select 1 from public.app_moderators mo where mo.user_id = u.id),
    exists (select 1 from public.app_admins ad where ad.user_id = u.id)
  from auth.users u
  where public.is_app_admin()
  order by lower(coalesce((select m.display_name from public.workspace_members m where m.user_id = u.id
    order by m.created_at limit 1), u.email))
$$;
revoke all on function public.list_accounts from public, anon;
grant execute on function public.list_accounts to authenticated;

create function public.grant_moderator_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'only admins can make moderators' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'no such account' using errcode = 'no_data_found';
  end if;
  insert into public.app_moderators (user_id, granted_by) values (p_user_id, auth.uid())
  on conflict (user_id) do nothing;
end;
$$;
revoke all on function public.grant_moderator_user from public, anon;
grant execute on function public.grant_moderator_user to authenticated;
