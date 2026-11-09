-- Find yourself anywhere (#68). Linking your login to your person (#44)
-- worked only within your band's own records, so someone in a second band
-- couldn't pick the person another band already had for them, and made a
-- copy. Now you can link to any person you can see in the directory. The
-- person stays with the band that added it, as band claims do; linked from
-- another band, you can fix your own details (logged as yours), and it stays
-- shared. One person per account: linking also fills in your other bands
-- that don't have one yet.

alter table public.workspace_members drop constraint workspace_members_connection_fkey;
alter table public.workspace_members
  add constraint workspace_members_connection_fkey
    foreign key (connection_id) references public.connections (id) on delete set null;

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
  ) or not private.can_see_connection(p_connection_id) then
    raise exception 'not a person here' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.workspace_members where connection_id = p_connection_id and user_id <> auth.uid()
  ) then
    raise exception 'someone else' using errcode = 'unique_violation';
  end if;

  update public.workspace_members set connection_id = p_connection_id
  where user_id = auth.uid() and (workspace_id = p_workspace_id or connection_id is null);
end;
$$;

-- Merging people (#169): every link follows the person to the one kept,
-- whichever band it's from, unless that one is already someone else's.
create or replace function private.move_member_link_on_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into is not null and old.merged_into is null then
    update public.workspace_members m set connection_id = new.merged_into
    where m.connection_id = new.id
      and not exists (
        select 1 from public.workspace_members o
        where o.connection_id = new.merged_into and o.user_id <> m.user_id
      );
  end if;
  return new;
end;
$$;

-- Your name, when you've linked yourself to this person from a band other
-- than the one that added it. Null otherwise.
create function private.my_person_name(p_connection_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.display_name from public.workspace_members m
  join public.connections c on c.id = m.connection_id
  where m.connection_id = p_connection_id and m.user_id = auth.uid() and c.workspace_id <> m.workspace_id
  order by m.created_at
  limit 1
$$;
revoke all on function private.my_person_name from public;
grant execute on function private.my_person_name to authenticated;

-- The people you could link yourself to, from your band (p_workspace_id):
-- any person you can see (shared, or in any band you're in) that isn't
-- someone else's, with who added them
-- and whether they're in your band.
create function public.findable_people(p_workspace_id uuid)
returns table (connection_id uuid, name text, added_by text, in_band boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, w.name,
    exists (
      select 1 from public.affiliations a
      join public.workspaces mine on mine.id = p_workspace_id
      where a.from_connection_id = c.id and a.kind = 'member' and a.is_current
        and (a.to_connection_id = mine.listing_id
          or a.to_connection_id in (select u.id from public.connections u where u.workspace_id = p_workspace_id and u.is_us)))
  from public.connections c
  join public.workspaces w on w.id = c.workspace_id
  where exists (select 1 from public.workspace_members me where me.workspace_id = p_workspace_id and me.user_id = auth.uid())
    and c.kind = 'person' and c.merged_into is null
    -- Shared, or kept private by any band you're in (your own bands' people
    -- are yours to see).
    and (c.workspace_id in (select private.my_workspace_ids()) or not c.keep_private)
    and not exists (select 1 from public.workspace_members o where o.connection_id = c.id and o.user_id <> auth.uid())
  order by lower(c.name)
$$;
revoke all on function public.findable_people from public, anon;
grant execute on function public.findable_people to authenticated;

-- Linked from another band, you fix your own details, logged as yours.
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
  v_band_claim text := private.my_claim_band(p_id);
  v_person_claim text := private.my_person_name(p_id);
  v_by_band text := coalesce(v_band_claim, v_person_claim);
begin
  if not v_moderator and v_by_band is null then
    raise exception 'only moderators can edit other bands'' records' using errcode = '42501';
  end if;
  -- A moderator's fix is a moderator's, even on their own band's listing.
  if v_moderator then
    v_by_band := null;
  elsif v_band_claim is not null and (p_kind is distinct from 'group' or p_group_type is distinct from 'band') then
    raise exception 'a claimed band stays a band' using errcode = '23514';
  elsif v_band_claim is null and p_kind is distinct from 'person' then
    raise exception 'you stay a person' using errcode = '23514';
  end if;

  -- Kept private is fine for your own person (your bands can see it).
  select * into v_old from public.connections
  where id = p_id and merged_into is null and (not keep_private or v_person_claim is not null)
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

-- Linked from another band, a person stays shared (keeping it private would
-- hide it from you); a moderator still can.
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
      and not exists (select 1 from public.workspace_members l where l.connection_id = c.id and l.workspace_id <> c.workspace_id)
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
