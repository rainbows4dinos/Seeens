-- Claim yourself. A band's friends are usually already in its directory as
-- people, kept private (people start private). Find Yourself only listed
-- people you could see, so a newly invited owner couldn't find the person
-- another band had for them, and made a copy. Two ways in now:
--
-- 1. Inviting a band, an admin can name its owner's person. Accepting the
--    invite links the new account to it.
-- 2. Find Yourself also lists the current members of the band you claimed,
--    even ones the band that added them kept private.
--
-- Either way the person stays with the band that added it, as before. Linked
-- from another band, it's shared (its name, town, and links), so the new
-- band can see its own member; the adding band's status and notes on it stay
-- its own.

alter table public.invites
  add column connection_id uuid references public.connections (id) on delete set null;

-- Whether a person is a current member of the band p_workspace_id claimed
-- (its listing, or its own page).
create function private.member_of_my_band(p_connection_id uuid, p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.affiliations a
    join public.workspaces mine on mine.id = p_workspace_id
    where a.from_connection_id = p_connection_id and a.kind = 'member' and a.is_current
      and (a.to_connection_id = mine.listing_id
        or a.to_connection_id in (select u.id from public.connections u where u.workspace_id = p_workspace_id and u.is_us)))
$$;
revoke all on function private.member_of_my_band from public;

-- Link the caller to a person: in p_workspace_id, and in their other bands
-- that don't have one yet. Another band's person is shared once it's yours.
create function private.link_me(p_connection_id uuid, p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workspace_members set connection_id = p_connection_id
  where user_id = auth.uid() and (workspace_id = p_workspace_id or connection_id is null);
  -- Past the guard that sends everyone else to set_keep_private.
  perform set_config('seeens.keep_private_ok', 'on', true);
  update public.connections set keep_private = false
  where id = p_connection_id and keep_private
    and workspace_id not in (select private.my_workspace_ids());
  perform set_config('seeens.keep_private_ok', 'off', true);
end;
$$;
revoke all on function private.link_me from public;

create or replace function public.findable_people(p_workspace_id uuid)
returns table (connection_id uuid, name text, added_by text, in_band boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, w.name, b.in_band
  from public.connections c
  join public.workspaces w on w.id = c.workspace_id
  cross join lateral (select private.member_of_my_band(c.id, p_workspace_id) as in_band) b
  where exists (select 1 from public.workspace_members me where me.workspace_id = p_workspace_id and me.user_id = auth.uid())
    and c.kind = 'person' and c.merged_into is null
    -- Shared, kept private by any band you're in (your own bands' people are
    -- yours to see), or a member of your band, wherever they're kept.
    and (c.workspace_id in (select private.my_workspace_ids()) or not c.keep_private or b.in_band)
    and not exists (select 1 from public.workspace_members o where o.connection_id = c.id and o.user_id <> auth.uid())
  order by lower(c.name)
$$;

create or replace function public.link_me_to_person(p_workspace_id uuid, p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()
  ) then
    raise exception 'not a member' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.connections
    where id = p_connection_id and kind = 'person' and merged_into is null
  ) or not (private.can_see_connection(p_connection_id) or private.member_of_my_band(p_connection_id, p_workspace_id)) then
    raise exception 'not a person here' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.workspace_members where connection_id = p_connection_id and user_id <> auth.uid()
  ) then
    raise exception 'someone else' using errcode = 'unique_violation';
  end if;
  perform private.link_me(p_connection_id, p_workspace_id);
end;
$$;

-- Admins -------------------------------------------------------------------

-- People an invited owner could be: anyone not linked to an account yet,
-- private or not, with who added them.
create function public.invitable_people()
returns table (connection_id uuid, name text, added_by text, keep_private boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, w.name, c.keep_private
  from public.connections c
  join public.workspaces w on w.id = c.workspace_id
  where public.is_app_admin()
    and c.kind = 'person' and c.merged_into is null
    and not exists (select 1 from public.workspace_members m where m.connection_id = c.id)
  order by lower(c.name)
$$;

-- invite_band, with the owner's person (optional). The invite's name
-- defaults to the person's.
drop function public.invite_band(uuid, text, text, text);
create function public.invite_band(p_listing_id uuid, p_band text, p_email text, p_name text, p_person_id uuid default null)
returns table (workspace_id uuid, invite_id uuid, token text, band text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_band text := btrim(coalesce(p_band, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_token text := private.invite_token();
  v_listing public.connections;
  v_person public.connections;
  v_sender text;
  v_workspace uuid;
  v_invite uuid;
  v_claims text;
begin
  if not public.is_app_admin() then
    raise exception 'only admins can invite bands' using errcode = '42501';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'not an email address' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is not null and exists (select 1 from public.invite_optouts o where o.email = v_email) then
    raise exception 'opted out' using errcode = 'check_violation';
  end if;

  if p_person_id is not null then
    select * into v_person from public.connections c where c.id = p_person_id;
    if not found or v_person.kind <> 'person' or v_person.merged_into is not null then
      raise exception 'not a person' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.workspace_members m where m.connection_id = p_person_id) then
      raise exception 'someone else' using errcode = 'unique_violation';
    end if;
    v_name := coalesce(v_name, left(v_person.name, 80));
  end if;

  if p_listing_id is not null then
    select * into v_listing from public.connections c where c.id = p_listing_id for update;
    if not found or v_listing.merged_into is not null or v_listing.kind <> 'group'
      or v_listing.group_type is distinct from 'band' or v_listing.keep_private or v_listing.is_us then
      raise exception 'not a band listing' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.workspaces w where w.listing_id = p_listing_id) then
      raise exception 'already claimed' using errcode = 'unique_violation';
    end if;
    v_band := v_listing.name;
  else
    if char_length(v_band) not between 1 and 80 then
      raise exception 'band name must be 1 to 80 characters' using errcode = 'check_violation';
    end if;
    -- Listed already: claim that one instead of making a second.
    if exists (
      select 1 from public.connections c
      where c.kind = 'group' and c.group_type = 'band' and c.merged_into is null and not c.keep_private
        and lower(c.name) = lower(v_band)
    ) then
      raise exception 'already listed' using errcode = 'unique_violation';
    end if;
  end if;

  v_sender := coalesce(
    (select m.display_name from public.workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1),
    'Seeens');

  insert into public.workspaces (name, listing_id) values (v_band, p_listing_id) returning id into v_workspace;
  if p_listing_id is null then
    -- Added by nobody in the band yet: the author stamp would put the admin,
    -- who isn't a member, so it's left blank for this one row.
    v_claims := current_setting('request.jwt.claims', true);
    perform set_config('request.jwt.claims', '', true);
    insert into public.connections (workspace_id, name, kind, group_type, is_us, created_by)
    values (v_workspace, v_band, 'group', 'band', true, null)
    returning id into p_listing_id;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    update public.workspaces set listing_id = p_listing_id where id = v_workspace;
  end if;

  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name, connection_id)
  values (v_workspace, v_email, v_name, 'owner', private.token_hash(v_token), auth.uid(), v_sender, p_person_id)
  returning id into v_invite;
  return query select v_workspace, v_invite, v_token, v_band;
end;
$$;

-- Accepting an invite that names your person links you to it, unless
-- someone else got there first.
create or replace function public.accept_invite(p_token text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
  v_email text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  select * into i from public.invites where token_hash = private.token_hash(p_token) for update;
  if not found then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  if i.accepted_at is not null or i.revoked_at is not null or i.expires_at <= now() then
    raise exception 'invite closed' using errcode = 'check_violation';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if i.email is not null and i.email is distinct from v_email then
    raise exception 'wrong email' using errcode = 'insufficient_privilege';
  end if;

  v_name := coalesce(
    nullif(left(btrim(coalesce(p_display_name, '')), 80), ''),
    (select m.display_name from public.workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1),
    i.name,
    initcap(split_part(v_email, '@', 1)));

  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (i.workspace_id, auth.uid(), i.role, v_name)
  on conflict (workspace_id, user_id) do nothing;

  if i.connection_id is not null
    and exists (select 1 from public.connections c where c.id = i.connection_id and c.kind = 'person' and c.merged_into is null)
    and not exists (select 1 from public.workspace_members m where m.connection_id = i.connection_id and m.user_id <> auth.uid())
  then
    perform private.link_me(i.connection_id, i.workspace_id);
  end if;

  update public.invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.workspace_id;
end;
$$;

revoke all on function public.invitable_people, public.invite_band from public, anon;
grant execute on function public.invitable_people, public.invite_band to authenticated;
