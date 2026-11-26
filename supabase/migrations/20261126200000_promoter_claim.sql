-- Promoters can claim their listing (#304), like bands and labels (#298):
-- an admin invites a promoter's owner, and it claims its listing (group
-- type promoter_collective). A workspace's kind is now band, label, or
-- promoter. Same functions as 20261111500000_label_claim.sql apart from
-- the kinds they take.

alter table public.workspaces drop constraint workspaces_kind_check;
alter table public.workspaces
  add constraint workspaces_kind_check check (kind in ('band', 'label', 'promoter'));

-- A workspace's kind and its listing's group type, each from the other.
create function private.workspace_kind_for(p_type public.group_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type when 'label' then 'label' when 'promoter_collective' then 'promoter' else 'band' end
$$;
create function private.group_type_for(p_kind text)
returns public.group_type
language sql
immutable
set search_path = ''
as $$
  select (case p_kind when 'label' then 'label' when 'promoter' then 'promoter_collective' else 'band' end)::public.group_type
$$;

create or replace function public.invite_band(
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
  if v_kind not in ('band', 'label', 'promoter') then
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
      or v_listing.group_type is null or v_listing.group_type::text not in ('band', 'label', 'promoter_collective')
      or v_listing.keep_private or v_listing.is_us then
      raise exception 'not a band listing' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.workspaces w where w.listing_id = p_listing_id) then
      raise exception 'already claimed' using errcode = 'unique_violation';
    end if;
    v_band := v_listing.name;
    v_kind := private.workspace_kind_for(v_listing.group_type);
  else
    if char_length(v_band) not between 1 and 80 then
      raise exception 'band name must be 1 to 80 characters' using errcode = 'check_violation';
    end if;
    -- Listed already: claim that one instead of making a second.
    if exists (
      select 1 from public.connections c
      where c.kind = 'group' and c.group_type = private.group_type_for(v_kind) and c.merged_into is null and not c.keep_private
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
    values (v_workspace, v_band, 'group', private.group_type_for(v_kind), true, null)
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


-- Bands, labels, and promoters an admin can invite.
create or replace function public.invitable_bands()
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
    and c.kind = 'group' and c.group_type in ('band', 'label', 'promoter_collective')
    and c.merged_into is null and not c.keep_private and not c.is_us
    and not exists (select 1 from public.workspaces o where o.listing_id = c.id)
  order by lower(c.name)
$$;

