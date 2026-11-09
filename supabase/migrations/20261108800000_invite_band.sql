-- Invite a band (#68). An app admin invites a band's first owner, and the
-- band claims its listing in the directory: usually one another band added
-- (Merwulf added Wet Paint), or a new one when it isn't listed yet. The
-- owner joins through the usual invite page, then invites their bandmates
-- from Band Settings. Replaces making bands by hand in the SQL editor.
--
-- A claim is a pointer from the band to its listing. The listing stays with
-- the band that added it, so that band's notes, links, and history on it
-- stay where they are. What claiming gives the band: its listing says "Uses
-- Seeens," and its members can fix the listing's details (name, town,
-- links, what they can help with), logged as theirs, the way moderators do.
-- Each band's status and notes on it stay its own. A claimed listing stays
-- shared: keeping it private would hide it from the band that claimed it.

-- The band's listing. One band per listing.
alter table public.workspaces
  add column listing_id uuid references public.connections (id) on delete set null;
create unique index workspaces_listing_idx on public.workspaces (listing_id) where listing_id is not null;

-- Bands already here claim their own page.
update public.workspaces w set listing_id = (
  select c.id from public.connections c
  where c.workspace_id = w.id and c.is_us and c.merged_into is null
  order by c.created_at limit 1);

-- Merging listings (#169): the claim follows to the one kept, unless that
-- one is already claimed.
create function private.move_claim_on_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into is not null and old.merged_into is null then
    update public.workspaces w set listing_id = new.merged_into
    where w.listing_id = new.id
      and not exists (select 1 from public.workspaces o where o.listing_id = new.merged_into);
  end if;
  return new;
end;
$$;
revoke all on function private.move_claim_on_merge from public;
create trigger connections_move_claim_on_merge
  after update of merged_into on public.connections
  for each row execute function private.move_claim_on_merge();

-- The name of the caller's band, when it has claimed this listing and the
-- listing is another band's. Null otherwise.
create function private.my_claim_band(p_connection_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select w.name from public.workspaces w
  join public.connections c on c.id = w.listing_id
  where w.listing_id = p_connection_id and c.workspace_id <> w.id
    and w.id in (select private.my_workspace_ids())
  limit 1
$$;
revoke all on function private.my_claim_band from public;
grant execute on function private.my_claim_band to authenticated;

-- Who has claimed a listing you can see: the band (once it has members),
-- and whether it's yours.
create function public.listing_claim(p_connection_id uuid)
returns table (band text, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, w.id in (select private.my_workspace_ids())
  from public.workspaces w
  where w.listing_id = p_connection_id
    and private.can_see_connection(p_connection_id)
    and exists (select 1 from public.workspace_members m where m.workspace_id = w.id)
$$;
revoke all on function public.listing_claim from public, anon;
grant execute on function public.listing_claim to authenticated;

-- Who fixed a listing: null for a moderator, or the band that claimed it.
alter table public.connection_edits add column by_band text;

-- Members of the band that claimed a listing fix it the way moderators do,
-- logged as their band's. It stays a band.
create or replace function public.moderate_connection(
  p_id uuid,
  p_name text,
  p_kind public.connection_kind,
  p_person_roles public.person_role[],
  p_group_type public.group_type,
  p_can_help_with text[],
  p_links jsonb,
  p_place_id integer default null,
  p_keep_locality_id uuid default null,
  p_attributes jsonb default null,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.connections;
  v_new public.connections;
  v_locality_id uuid;
  v_old_links jsonb;
  v_new_links jsonb;
  v_changes jsonb := '{}';
  v_attributes jsonb := case when p_attributes is null or p_attributes - 'checked_on' = '{}'::jsonb
    then p_attributes - 'checked_on'
    else (p_attributes - 'checked_on') || jsonb_build_object('checked_on', current_date) end;
  v_moderator boolean := public.is_moderator();
  v_by_band text := private.my_claim_band(p_id);
begin
  if not v_moderator and v_by_band is null then
    raise exception 'only moderators can edit other bands'' records' using errcode = '42501';
  end if;
  -- A moderator's fix is a moderator's, even on their own band's listing.
  if v_moderator then
    v_by_band := null;
  elsif p_kind is distinct from 'group' or p_group_type is distinct from 'band' then
    raise exception 'a claimed band stays a band' using errcode = '23514';
  end if;

  select * into v_old from public.connections
  where id = p_id and merged_into is null and not keep_private
  for update;
  if not found then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  if p_expected_updated_at is not null and v_old.updated_at <> p_expected_updated_at then
    raise exception 'connection changed since it was opened' using errcode = 'PT409';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'a name is required' using errcode = '23514';
  end if;

  -- Town: the record's band's locality for the place, added if it's new.
  if p_place_id is not null then
    select id into v_locality_id from public.localities
    where workspace_id = v_old.workspace_id and place_id = p_place_id;
    if v_locality_id is null then
      insert into public.localities
        (workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
      select v_old.workspace_id, p.id, p.name, p.region_name, p.region_code,
             p.country_name, p.country_code, p.latitude, p.longitude
      from public.places p where p.id = p_place_id
      on conflict (workspace_id, place_id) do nothing
      returning id into v_locality_id;
      if v_locality_id is null then
        select id into v_locality_id from public.localities
        where workspace_id = v_old.workspace_id and place_id = p_place_id;
      end if;
      if v_locality_id is null then
        raise exception 'place not found' using errcode = 'no_data_found';
      end if;
    end if;
  elsif p_keep_locality_id is not null then
    -- Only the town it already has (the foreign key keeps it in the band).
    v_locality_id := p_keep_locality_id;
  end if;

  update public.connections set
    name = trim(p_name),
    kind = p_kind,
    person_roles = coalesce(p_person_roles, '{}'),
    group_type = p_group_type,
    can_help_with = coalesce(p_can_help_with, '{}'),
    locality_id = v_locality_id,
    attributes = case
      when v_attributes is null then attributes
      when v_attributes - 'checked_on' = attributes - 'checked_on' then attributes
      else v_attributes end
  where id = p_id
  returning * into v_new;

  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position), '[]')
    into v_old_links from public.connection_links where connection_id = p_id;
  v_new_links := coalesce((
    select jsonb_agg(jsonb_build_object('label', nullif(trim(l.value ->> 'label'), ''), 'url', l.value ->> 'url') order by l.ord)
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality as l (value, ord)), '[]');
  if v_new_links is distinct from v_old_links then
    delete from public.connection_links where connection_id = p_id;
    insert into public.connection_links (workspace_id, connection_id, label, url, position)
    select v_old.workspace_id, p_id, nullif(trim(l.value ->> 'label'), ''), l.value ->> 'url', (l.ord - 1)::smallint
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality as l (value, ord);
    v_changes := v_changes || jsonb_build_object('links', jsonb_build_array(v_old_links, v_new_links));
  end if;

  -- The log: each field that changed, before and after.
  select v_changes || coalesce(jsonb_object_agg(k, jsonb_build_array(to_jsonb(v_old) -> k, to_jsonb(v_new) -> k)), '{}')
    into v_changes
  from unnest(array['name', 'kind', 'person_roles', 'group_type', 'can_help_with', 'locality_id', 'attributes']) k
  where to_jsonb(v_old) -> k is distinct from to_jsonb(v_new) -> k;

  if v_changes <> '{}' then
    insert into public.connection_edits (connection_id, edited_by, changes, by_band)
    values (p_id, auth.uid(), v_changes, v_by_band);
  end if;
end;
$$;

-- A claimed listing stays shared (only a moderator can keep it private).
create or replace function private.can_set_keep_private(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_moderator() or exists (
    select 1 from public.connections c
    where c.id = p_connection_id and c.merged_into is null
      and not exists (select 1 from public.workspaces w where w.listing_id = c.id and w.id <> c.workspace_id)
      and case
        -- Groups: an owner of the band that added it.
        when c.kind = 'group' then exists (
          select 1 from public.workspace_members m
          where m.workspace_id = c.workspace_id and m.user_id = auth.uid() and m.role = 'owner')
        -- A person who's linked their account decides for themselves.
        when exists (select 1 from public.workspace_members l where l.connection_id = c.id) then exists (
          select 1 from public.workspace_members l where l.connection_id = c.id and l.user_id = auth.uid())
        -- Anyone else: the band that added them.
        else c.workspace_id in (select private.my_workspace_ids())
      end)
$$;

-- Admins ---------------------------------------------------------------------

-- Bands in the directory that can be invited: shared, not merged, not a
-- band's own page, and not claimed yet. With their town and who added them.
create function public.invitable_bands()
returns table (connection_id uuid, name text, town text, added_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, l.name, w.name
  from public.connections c
  join public.workspaces w on w.id = c.workspace_id
  left join public.localities l on l.id = c.locality_id
  where public.is_app_admin()
    and c.kind = 'group' and c.group_type = 'band'
    and c.merged_into is null and not c.keep_private and not c.is_us
    and not exists (select 1 from public.workspaces o where o.listing_id = c.id)
  order by lower(c.name)
$$;

-- Invite a band's first owner. With a listing, the band claims it and takes
-- its name; without one, the band gets a new listing of its own. Admins
-- aren't members of the bands they invite, so the invite names the admin.
create function public.invite_band(p_listing_id uuid, p_band text, p_email text, p_name text)
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
  -- Seeens shows one band per person for now, so someone already in a band
  -- would never see the new one.
  if v_email is not null and exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id where lower(u.email) = v_email
  ) then
    raise exception 'already in a band' using errcode = 'unique_violation';
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

  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name)
  values (v_workspace, v_email, v_name, 'owner', private.token_hash(v_token), auth.uid(), v_sender)
  returning id into v_invite;
  return query select v_workspace, v_invite, v_token, v_band;
end;
$$;

-- Every band, newest first: how many members, whose listing it claimed, and
-- the owner invite still waiting, if any.
create function public.list_bands()
returns table (
  workspace_id uuid, name text, created_at timestamptz, members integer, listing_from text,
  invite_id uuid, invite_email text, invite_expires_at timestamptz
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

revoke all on function public.invitable_bands, public.invite_band, public.list_bands, public.renew_band_invite
  from public, anon;
grant execute on function public.invitable_bands, public.invite_band, public.list_bands, public.renew_band_invite
  to authenticated;
