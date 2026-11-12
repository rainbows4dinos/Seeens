-- A label invites its roster (#298): a label's owner can invite a band on
-- its roster to claim its listing, the way an admin can. The band's
-- workspace remembers which label asked.

alter table public.workspaces
  add column invited_by_workspace uuid references public.workspaces (id) on delete set null;

-- On the roster now: joined means someone's in, invited means a band's
-- workspace is waiting on its owner.
drop function public.label_roster(uuid);
create function public.label_roster(p_workspace_id uuid)
returns table (connection_id uuid, is_current boolean, joined boolean, invited boolean, by_us boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with lbl as (
    select coalesce(w.listing_id,
      (select c.id from public.connections c where c.workspace_id = w.id and c.is_us limit 1)) as id
    from public.workspaces w
    where w.id = p_workspace_id and w.kind = 'label'
      and private.my_role(p_workspace_id) is not null
  ), roster as (
    select b.id, bool_or(a.is_current) as is_current, b.is_us
    from lbl
    join public.affiliations a on a.to_connection_id = lbl.id and a.kind = 'on_label'
    join public.connections b on b.id = a.from_connection_id
    where b.kind = 'group' and b.group_type = 'band' and b.merged_into is null
      and (not b.keep_private or b.workspace_id = p_workspace_id)
    group by b.id
  )
  select r.id, r.is_current,
    r.is_us or coalesce(o.members > 0, false),
    coalesce(o.members = 0, false),
    coalesce(o.invited_by_workspace = p_workspace_id, false)
  from roster r
  left join lateral (
    select w.invited_by_workspace,
      (select count(*) from public.workspace_members m where m.workspace_id = w.id) as members
    from public.workspaces w where w.listing_id = r.id
  ) o on true
$$;
revoke all on function public.label_roster from public, anon;
grant execute on function public.label_roster to authenticated;

-- Invite a band on the roster to claim its listing, as the label's owner.
-- Asking again for a band this label already invited, and nobody joined,
-- closes the old invite and makes a new one. At most 20 a day per label.
create function public.invite_roster_band(p_workspace_id uuid, p_listing_id uuid, p_email text, p_name text)
returns table (workspace_id uuid, invite_id uuid, token text, band text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_token text := private.invite_token();
  v_listing public.connections;
  v_label public.workspaces;
  v_band public.workspaces;
  v_sender text;
  v_invite uuid;
begin
  if private.my_role(p_workspace_id) is distinct from 'owner' then
    raise exception 'only label owners' using errcode = '42501';
  end if;
  select * into v_label from public.workspaces w where w.id = p_workspace_id;
  if v_label.kind <> 'label' then
    raise exception 'only label owners' using errcode = '42501';
  end if;
  if not exists (select 1 from public.label_roster(p_workspace_id) r where r.connection_id = p_listing_id) then
    raise exception 'not on the roster' using errcode = 'check_violation';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'not an email address' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is not null and exists (select 1 from public.invite_optouts o where o.email = v_email) then
    raise exception 'opted out' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.invites i join public.workspaces w on w.id = i.workspace_id
      where w.invited_by_workspace = p_workspace_id and i.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many today' using errcode = 'check_violation';
  end if;

  select * into v_listing from public.connections c where c.id = p_listing_id for update;
  if v_listing.keep_private or v_listing.is_us then
    raise exception 'not a band listing' using errcode = 'check_violation';
  end if;

  select * into v_band from public.workspaces w where w.listing_id = p_listing_id;
  if found then
    if v_band.invited_by_workspace is distinct from p_workspace_id
      or exists (select 1 from public.workspace_members m where m.workspace_id = v_band.id) then
      raise exception 'already claimed' using errcode = 'unique_violation';
    end if;
    update public.invites set revoked_at = now(), revoked_by = auth.uid()
    where invites.workspace_id = v_band.id and accepted_at is null and revoked_at is null;
  else
    insert into public.workspaces (name, listing_id, kind, invited_by_workspace)
    values (v_listing.name, p_listing_id, 'band', p_workspace_id)
    returning * into v_band;
  end if;

  v_sender := coalesce(
    (select m.display_name from public.workspace_members m
      where m.workspace_id = p_workspace_id and m.user_id = auth.uid()),
    v_label.name);
  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name)
  values (v_band.id, v_email, v_name, 'owner', private.token_hash(v_token), auth.uid(), v_sender || ' at ' || v_label.name)
  returning id into v_invite;
  return query select v_band.id, v_invite, v_token, v_listing.name;
end;
$$;
revoke all on function public.invite_roster_band from public, anon;
grant execute on function public.invite_roster_band to authenticated;

-- Whoever sent an invite can mark it sent, even into a band they're not in.
create or replace function public.mark_invite_sent(p_invite_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invites set sent_at = now()
  where id = p_invite_id
    and (private.my_role(workspace_id) is not null or public.is_app_admin() or invited_by = auth.uid())
$$;
