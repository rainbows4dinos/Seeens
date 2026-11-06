-- Account settings (#67): your display name, and leaving a band.
--
-- Members can read memberships but not write them, so both go through
-- functions that only ever touch the caller's own rows.

-- Your name as bandmates see it, in every band you're in.
create function public.update_my_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'display name must be 1 to 80 characters' using errcode = 'check_violation';
  end if;
  update public.workspace_members set display_name = v_name where user_id = auth.uid();
end;
$$;

-- Leave a band. Its directory, and everything you added to it, stays with
-- the band; your name comes off plans you were assigned (as when an owner
-- removes a member). The last owner can't leave, so a band always has one.
create function public.leave_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
begin
  select role into v_role from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'not a member' using errcode = 'no_data_found';
  end if;

  if v_role = 'owner' and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and role = 'owner' and user_id <> auth.uid()
  ) then
    raise exception 'the last owner can''t leave' using errcode = 'check_violation';
  end if;

  delete from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid();
end;
$$;

revoke all on function public.update_my_display_name from public, anon;
revoke all on function public.leave_workspace from public, anon;
grant execute on function public.update_my_display_name to authenticated;
grant execute on function public.leave_workspace to authenticated;
