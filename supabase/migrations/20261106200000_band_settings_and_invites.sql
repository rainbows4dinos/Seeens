-- Band Settings and invites (#69).
--
-- Any member invites a bandmate by email or by a one-time link. The link
-- carries a random token; only its SHA-256 is stored. Opening it shows who
-- invited you before any account step; accepting goes through
-- accept_invite, never a client insert into workspace_members.
--
-- Owners rename the band, change roles, and remove members. A band always
-- keeps at least one owner. Every write here is a function that checks who
-- is asking; members can read invites but not write them directly.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Null for a link invite: whoever opens it signs up with their own email.
  email text check (email is null or email = lower(btrim(email))),
  name text check (name is null or char_length(name) between 1 and 80),
  role public.member_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  invited_by_name text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null
);

-- One open invite per address per band (open: not accepted or revoked; an
-- expired one is revoked when it's replaced).
create unique index invites_one_open_per_email
  on public.invites (workspace_id, email)
  where email is not null and accepted_at is null and revoked_at is null;
create index invites_workspace_idx on public.invites (workspace_id, created_at desc);
create index invites_inviter_idx on public.invites (invited_by, created_at desc);

alter table public.invites enable row level security;
create policy "Members can view their band's invites" on public.invites
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));
-- Members read invites but never the token hash, and write only through
-- the functions below.
revoke all on public.invites from anon, authenticated;
grant select (id, workspace_id, email, name, role, invited_by, invited_by_name, created_at, sent_at,
  expires_at, accepted_at, accepted_by, revoked_at, revoked_by) on public.invites to authenticated;

-- Addresses that asked Seeens not to email them again ("don't email me").
create table public.invite_optouts (
  email text primary key check (email = lower(btrim(email))),
  created_at timestamptz not null default now()
);
alter table public.invite_optouts enable row level security;
revoke all on public.invite_optouts from anon, authenticated;

create function private.invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

create function private.token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

create function private.my_role(p_workspace_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()
$$;

revoke all on function private.invite_token, private.token_hash, private.my_role from public, anon, authenticated;

-- Invite a bandmate. With an email: one open invite per address, so asking
-- again for the same address gives back the open one (a new token, so a
-- fresh link) and says who sent it first. Without one: a link invite.
-- Returns the token once; only its hash is kept.
create function public.create_invite(p_workspace_id uuid, p_email text, p_name text, p_role public.member_role)
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
      update public.invites set token_hash = private.token_hash(v_token) where id = v_open.id;
      return query select v_open.id, v_token, true, v_open.invited_by_name;
      return;
    elsif found then
      update public.invites set revoked_at = now(), revoked_by = auth.uid() where id = v_open.id;
    end if;
  end if;

  return query
  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name)
  values (p_workspace_id, v_email, v_name, p_role, private.token_hash(v_token), auth.uid(), v_inviter)
  returning id, v_token, false, null::text;
end;
$$;

-- A fresh link for an open invite (Copy Link, Resend). The old link stops
-- working. The sender or an owner.
create function public.renew_invite_link(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
  v_token text := private.invite_token();
begin
  select * into i from public.invites where id = p_invite_id for update;
  if not found or private.my_role(i.workspace_id) is null then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  if i.invited_by is distinct from auth.uid() and private.my_role(i.workspace_id) <> 'owner' then
    raise exception 'only the sender or an owner' using errcode = 'insufficient_privilege';
  end if;
  if i.accepted_at is not null or i.revoked_at is not null then
    raise exception 'invite closed' using errcode = 'check_violation';
  end if;
  update public.invites
  set token_hash = private.token_hash(v_token), expires_at = greatest(expires_at, now() + interval '7 days')
  where id = p_invite_id;
  return v_token;
end;
$$;

create function public.mark_invite_sent(p_invite_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invites set sent_at = now()
  where id = p_invite_id and private.my_role(workspace_id) is not null
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
begin
  select * into i from public.invites where id = p_invite_id for update;
  if not found or private.my_role(i.workspace_id) is null then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  if i.invited_by is distinct from auth.uid() and private.my_role(i.workspace_id) <> 'owner' then
    raise exception 'only the sender or an owner' using errcode = 'insufficient_privilege';
  end if;
  update public.invites set revoked_at = now(), revoked_by = auth.uid()
  where id = p_invite_id and accepted_at is null and revoked_at is null;
end;
$$;

-- What an invite link shows before any account step. Anyone holding the
-- link can ask, signed in or not; it only says who invited you to which
-- band, and whether the link still works.
create function public.invite_preview(p_token text)
returns table (band text, invited_by text, email text, name text, role public.member_role, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, i.invited_by_name, i.email, i.name, i.role,
    case
      when i.accepted_at is not null then 'used'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'open'
    end
  from public.invites i join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = private.token_hash(p_token)
$$;

-- Join the band. An email invite only works for that address. Single use.
-- Someone already in the band just uses it up.
create function public.accept_invite(p_token text, p_display_name text)
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

  update public.invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.workspace_id;
end;
$$;

-- "Don't email me again," from the invite page: closes the invite and
-- keeps the address off future invites from anyone.
create function public.opt_out_of_invites(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
begin
  select * into i from public.invites where token_hash = private.token_hash(p_token) for update;
  if not found or i.email is null then
    return;
  end if;
  insert into public.invite_optouts (email) values (i.email) on conflict do nothing;
  update public.invites set revoked_at = coalesce(revoked_at, now())
  where email = i.email and accepted_at is null;
end;
$$;

-- Members with their emails, for Band Settings. Only for your own bands.
create function public.band_members(p_workspace_id uuid)
returns table (user_id uuid, display_name text, role public.member_role, email text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.display_name, m.role, u.email::text, m.created_at
  from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace_id and private.my_role(p_workspace_id) is not null
  order by m.created_at
$$;

create function public.set_member_role(p_workspace_id uuid, p_user_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role(p_workspace_id) is distinct from 'owner' then
    raise exception 'owners only' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from public.workspace_members where workspace_id = p_workspace_id for update;
  if p_role = 'member' and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and role = 'owner' and user_id <> p_user_id
  ) then
    raise exception 'a band needs an owner' using errcode = 'check_violation';
  end if;
  update public.workspace_members set role = p_role where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'not a member' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Owners remove others (to remove yourself, leave). History stays, as when
-- anyone leaves.
create function public.remove_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role(p_workspace_id) is distinct from 'owner' then
    raise exception 'owners only' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'leave instead' using errcode = 'check_violation';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'not a member' using errcode = 'no_data_found';
  end if;
end;
$$;

create function public.rename_band(p_workspace_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if private.my_role(p_workspace_id) is distinct from 'owner' then
    raise exception 'owners only' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'band name must be 1 to 80 characters' using errcode = 'check_violation';
  end if;
  update public.workspaces set name = v_name where id = p_workspace_id;
end;
$$;

revoke all on function public.create_invite, public.renew_invite_link, public.mark_invite_sent, public.revoke_invite,
  public.invite_preview, public.accept_invite, public.opt_out_of_invites, public.band_members,
  public.set_member_role, public.remove_member, public.rename_band from public;
grant execute on function public.create_invite, public.renew_invite_link, public.mark_invite_sent, public.revoke_invite,
  public.accept_invite, public.band_members, public.set_member_role, public.remove_member, public.rename_band
  to authenticated;
-- The invite page works signed out.
grant execute on function public.invite_preview, public.opt_out_of_invites to anon, authenticated;
