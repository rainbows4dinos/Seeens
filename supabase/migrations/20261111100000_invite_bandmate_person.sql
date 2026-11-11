-- Invite a bandmate who's already in the directory (#225): pick the person,
-- and accepting links the new account to them (accept_invite does that for
-- any invite that names a person, #267). Their email fills in when the band
-- saved one.

-- People a band could invite: its members first (even ones another band
-- kept private), then its own people, then shared ones. Not anyone already
-- linked to an account. Email is the band's own note of it, if any.
create function public.invitable_bandmates(p_workspace_id uuid)
returns table (connection_id uuid, name text, email text, in_band boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, nullif(btrim(d.email), ''), b.in_band
  from public.connections c
  left join public.connection_band_details d on d.connection_id = c.id and d.workspace_id = p_workspace_id
  cross join lateral (select private.member_of_my_band(c.id, p_workspace_id) as in_band) b
  where exists (select 1 from public.workspace_members me where me.workspace_id = p_workspace_id and me.user_id = auth.uid())
    and c.kind = 'person' and c.merged_into is null
    and (c.workspace_id = p_workspace_id or not c.keep_private or b.in_band)
    and not exists (select 1 from public.workspace_members m where m.connection_id = c.id)
  order by b.in_band desc, (c.workspace_id = p_workspace_id) desc, lower(c.name)
$$;
revoke all on function public.invitable_bandmates from public, anon;
grant execute on function public.invitable_bandmates to authenticated;

-- create_invite, with the person (optional). The invite's name defaults
-- to theirs.
drop function public.create_invite(uuid, text, text, public.member_role);
create function public.create_invite(
  p_workspace_id uuid, p_email text, p_name text, p_role public.member_role, p_person_id uuid default null
)
returns table (invite_id uuid, token text, existing boolean, first_sent_by text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.member_role := private.my_role(p_workspace_id);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_token text := private.invite_token();
  v_inviter text;
  v_open record;
  v_person public.connections;
begin
  if v_me is null then
    raise exception 'not a member' using errcode = 'insufficient_privilege';
  end if;
  if p_role = 'owner' and v_me <> 'owner' then
    raise exception 'only owners can invite owners' using errcode = 'insufficient_privilege';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'not an email address' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is not null and exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and lower(u.email) = v_email
  ) then
    raise exception 'already a member' using errcode = 'unique_violation';
  end if;
  if v_email is not null and exists (select 1 from public.invite_optouts o where o.email = v_email) then
    raise exception 'opted out' using errcode = 'check_violation';
  end if;

  -- Who they are in the directory, if the inviter picked someone: the
  -- band's own people, shared ones, and the band's members (#225).
  if p_person_id is not null then
    select * into v_person from public.connections c where c.id = p_person_id;
    if not found or v_person.kind <> 'person' or v_person.merged_into is not null
      or not (v_person.workspace_id = p_workspace_id or not v_person.keep_private
        or private.member_of_my_band(p_person_id, p_workspace_id)) then
      raise exception 'not a person here' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.workspace_members m where m.connection_id = p_person_id) then
      raise exception 'someone else' using errcode = 'unique_violation';
    end if;
    v_name := coalesce(v_name, left(v_person.name, 80));
  end if;

  -- Caps, until there's real verification: open invites per member, and
  -- invites per member per day.
  if (select count(*) from public.invites i
      where i.invited_by = auth.uid() and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) >= 20
     or (select count(*) from public.invites i
      where i.invited_by = auth.uid() and i.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many invites' using errcode = 'program_limit_exceeded';
  end if;

  select display_name into v_inviter from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  if v_email is not null then
    select * into v_open from public.invites i
    where i.workspace_id = p_workspace_id and i.email = v_email and i.accepted_at is null and i.revoked_at is null
    for update;
    if found and v_open.expires_at > now() then
      update public.invites
      set token_hash = private.token_hash(v_token), connection_id = coalesce(p_person_id, connection_id)
      where id = v_open.id;
      return query select v_open.id, v_token, true, v_open.invited_by_name;
      return;
    elsif found then
      update public.invites set revoked_at = now(), revoked_by = auth.uid() where id = v_open.id;
    end if;
  end if;

  return query
  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name, connection_id)
  values (p_workspace_id, v_email, v_name, p_role, private.token_hash(v_token), auth.uid(), v_inviter, p_person_id)
  returning id, v_token, false, null::text;
end;
$$;
revoke all on function public.create_invite from public, anon;
grant execute on function public.create_invite to authenticated;
