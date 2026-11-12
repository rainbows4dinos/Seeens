-- Labels can claim their listing (#298): an admin invites a label's owner
-- the same way as a band's. A workspace now says which it is, so the app
-- can talk about "your label" and show its roster.

alter table public.workspaces
  add column kind text not null default 'band' check (kind in ('band', 'label'));

update public.workspaces w set kind = 'label'
from public.connections c
where c.id = w.listing_id and c.group_type = 'label';

-- invite_band takes a band or a label listing. With no listing, p_kind
-- says which to make. It answers which it was, for the email.
drop function public.invite_band(uuid, text, text, text, uuid);
create function public.invite_band(
  p_listing_id uuid, p_band text, p_email text, p_name text, p_person_id uuid default null,
  p_kind text default 'band'
)
returns table (workspace_id uuid, invite_id uuid, token text, band text, kind text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_band text := btrim(coalesce(p_band, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_kind text := coalesce(p_kind, 'band');
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
  if v_kind not in ('band', 'label') then
    raise exception 'not a band or label' using errcode = 'check_violation';
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
      or v_listing.group_type is null or v_listing.group_type::text not in ('band', 'label')
      or v_listing.keep_private or v_listing.is_us then
      raise exception 'not a band listing' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.workspaces w where w.listing_id = p_listing_id) then
      raise exception 'already claimed' using errcode = 'unique_violation';
    end if;
    v_band := v_listing.name;
    v_kind := v_listing.group_type::text;
  else
    if char_length(v_band) not between 1 and 80 then
      raise exception 'band name must be 1 to 80 characters' using errcode = 'check_violation';
    end if;
    -- Listed already: claim that one instead of making a second.
    if exists (
      select 1 from public.connections c
      where c.kind = 'group' and c.group_type::text = v_kind and c.merged_into is null and not c.keep_private
        and lower(c.name) = lower(v_band)
    ) then
      raise exception 'already listed' using errcode = 'unique_violation';
    end if;
  end if;

  v_sender := coalesce(
    (select m.display_name from public.workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1),
    'Seeens');

  insert into public.workspaces (name, listing_id, kind) values (v_band, p_listing_id, v_kind)
  returning id into v_workspace;
  if p_listing_id is null then
    -- Added by nobody in it yet: the author stamp would put the admin,
    -- who isn't a member, so it's left blank for this one row.
    v_claims := current_setting('request.jwt.claims', true);
    perform set_config('request.jwt.claims', '', true);
    insert into public.connections (workspace_id, name, kind, group_type, is_us, created_by)
    values (v_workspace, v_band, 'group', v_kind::public.group_type, true, null)
    returning id into p_listing_id;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    update public.workspaces set listing_id = p_listing_id where id = v_workspace;
  end if;

  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name, connection_id)
  values (v_workspace, v_email, v_name, 'owner', private.token_hash(v_token), auth.uid(), v_sender, p_person_id)
  returning id into v_invite;
  return query select v_workspace, v_invite, v_token, v_band, v_kind;
end;
$$;

-- Bands and labels an admin can invite, with which one each is.
drop function public.invitable_bands();
create function public.invitable_bands()
returns table (connection_id uuid, name text, town text, added_by text, group_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, l.name, w.name, c.group_type::text
  from public.connections c
  join public.workspaces w on w.id = c.workspace_id
  left join public.localities l on l.id = c.locality_id
  where public.is_app_admin()
    and c.kind = 'group' and c.group_type in ('band', 'label')
    and c.merged_into is null and not c.keep_private and not c.is_us
    and not exists (select 1 from public.workspaces o where o.listing_id = c.id)
  order by lower(c.name)
$$;

drop function public.list_bands();
create function public.list_bands()
returns table (
  workspace_id uuid, name text, created_at timestamptz, members integer, listing_from text,
  invite_id uuid, invite_email text, invite_expires_at timestamptz, kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, w.created_at,
    (select count(*)::integer from public.workspace_members m where m.workspace_id = w.id),
    (select o.name from public.connections c join public.workspaces o on o.id = c.workspace_id
      where c.id = w.listing_id and c.workspace_id <> w.id),
    i.id, i.email, i.expires_at, w.kind
  from public.workspaces w
  left join lateral (
    select i.id, i.email, i.expires_at from public.invites i
    where i.workspace_id = w.id and i.role = 'owner' and i.accepted_at is null and i.revoked_at is null
    order by i.created_at desc limit 1
  ) i on true
  where public.is_app_admin()
  order by w.created_at desc
$$;

-- The invite page words things for a label, too.
drop function public.invite_preview(text);
create function public.invite_preview(p_token text)
returns table (band text, invited_by text, email text, name text, role public.member_role, status text, kind text)
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
    end,
    w.kind
  from public.invites i join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = private.token_hash(p_token)
$$;
revoke all on function public.invite_preview from public;
grant execute on function public.invite_preview to anon, authenticated;

revoke all on function public.invite_band, public.invitable_bands, public.list_bands from public, anon;
grant execute on function public.invite_band, public.invitable_bands, public.list_bands to authenticated;

-- A label's roster: the bands listed on it, from any band's records, with
-- whether each is still on it and whether it's on Seeens yet.
create function public.label_roster(p_workspace_id uuid)
returns table (connection_id uuid, is_current boolean, joined boolean)
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
  )
  select b.id, bool_or(a.is_current),
    b.is_us or exists (select 1 from public.workspaces o where o.listing_id = b.id)
  from lbl
  join public.affiliations a on a.to_connection_id = lbl.id and a.kind = 'on_label'
  join public.connections b on b.id = a.from_connection_id
  where b.kind = 'group' and b.group_type = 'band' and b.merged_into is null
    and (not b.keep_private or b.workspace_id = p_workspace_id)
  group by b.id
$$;
revoke all on function public.label_roster from public, anon;
grant execute on function public.label_roster to authenticated;
