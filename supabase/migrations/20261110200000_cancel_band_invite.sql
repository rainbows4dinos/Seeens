-- Cancel a band invite, for app admins. Until anyone joins, the band is only
-- its invite (and its own new listing, when it wasn't listed), so canceling
-- removes the band: the link stops working, and a listing it claimed is free
-- to invite again. The band that added that listing keeps it as it was.
create function public.cancel_band_invite(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_band text;
begin
  if not public.is_app_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  select i.workspace_id into v_workspace from public.invites i
  where i.id = p_invite_id and i.role = 'owner' and i.accepted_at is null and i.revoked_at is null;
  if not found then
    raise exception 'invite closed' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.workspace_members m where m.workspace_id = v_workspace) then
    raise exception 'band has members' using errcode = 'check_violation';
  end if;
  delete from public.workspaces where id = v_workspace returning name into v_band;
  return v_band;
end;
$$;
revoke all on function public.cancel_band_invite from public, anon;
grant execute on function public.cancel_band_invite to authenticated;
