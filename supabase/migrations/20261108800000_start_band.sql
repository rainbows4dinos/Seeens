-- Start a band (#68): an app admin names a new band and invites its first
-- owner. The band starts empty; the owner joins through the usual invite
-- page (and makes their account there), then invites their bandmates from
-- Band Settings. Replaces making bands by hand in the SQL editor.

-- Admins aren't members of the bands they start, so the invite records the
-- admin as the sender by name.
create function public.start_band(p_band text, p_email text, p_name text)
returns table (workspace_id uuid, invite_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_band text := btrim(coalesce(p_band, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_token text := private.invite_token();
  v_sender text;
  v_workspace uuid;
  v_invite uuid;
begin
  if not public.is_app_admin() then
    raise exception 'only admins can start bands' using errcode = '42501';
  end if;
  if char_length(v_band) not between 1 and 80 then
    raise exception 'band name must be 1 to 80 characters' using errcode = 'check_violation';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'not an email address' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is not null and exists (select 1 from public.invite_optouts o where o.email = v_email) then
    raise exception 'opted out' using errcode = 'check_violation';
  end if;
  -- Seeens shows one band per person for now, so someone already in a band
  -- would never see the new one.
  if v_email is not null and exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id where lower(u.email) = v_email
  ) then
    raise exception 'already in a band' using errcode = 'unique_violation';
  end if;
  if exists (select 1 from public.workspaces w where lower(w.name) = lower(v_band)) then
    raise exception 'a band with that name' using errcode = 'unique_violation';
  end if;

  v_sender := coalesce(
    (select m.display_name from public.workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1),
    'Seeens');

  insert into public.workspaces (name) values (v_band) returning id into v_workspace;
  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name)
  values (v_workspace, v_email, v_name, 'owner', private.token_hash(v_token), auth.uid(), v_sender)
  returning id into v_invite;
  return query select v_workspace, v_invite, v_token;
end;
$$;

-- Every band, newest first, for the admin page: how many members, and the
-- owner invite still waiting, if any.
create function public.list_bands()
returns table (
  workspace_id uuid, name text, created_at timestamptz, members integer,
  invite_id uuid, invite_email text, invite_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, w.created_at,
    (select count(*)::integer from public.workspace_members m where m.workspace_id = w.id),
    i.id, i.email, i.expires_at
  from public.workspaces w
  left join lateral (
    select i.id, i.email, i.expires_at from public.invites i
    where i.workspace_id = w.id and i.role = 'owner' and i.accepted_at is null and i.revoked_at is null
    order by i.created_at desc limit 1
  ) i on true
  where public.is_app_admin()
  order by w.created_at desc
$$;

-- A fresh link for a band's waiting owner invite (the old one stops
-- working), for when the first one ran out or got lost.
create function public.renew_band_invite(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := private.invite_token();
begin
  if not public.is_app_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  update public.invites
  set token_hash = private.token_hash(v_token), expires_at = greatest(expires_at, now() + interval '7 days')
  where id = p_invite_id and role = 'owner' and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'invite closed' using errcode = 'check_violation';
  end if;
  return v_token;
end;
$$;

-- Admins can mark the invites they sent, too.
create or replace function public.mark_invite_sent(p_invite_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invites set sent_at = now()
  where id = p_invite_id and (private.my_role(workspace_id) is not null or public.is_app_admin())
$$;

revoke all on function public.start_band, public.list_bands, public.renew_band_invite from public, anon;
grant execute on function public.start_band, public.list_bands, public.renew_band_invite to authenticated;
