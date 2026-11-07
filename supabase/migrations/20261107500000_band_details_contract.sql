-- Shared directory, phase 1, step 3 of 3 (#181): the private layer is the
-- only home for a band's status, played together, notes, email, phone, and
-- archive. The old columns on connections go, along with the two-way sync.
--
-- Every record still gets this band's row as it's created (a trigger), so a
-- record always has one. Status history is now logged from the private
-- layer; a status set in the same transaction that created the record
-- replaces its starting entry, so a new record has one entry, as before.
-- Database functions that used the old columns read and write the private
-- layer instead. Phase 2 opens records to every band; these functions
-- already join on the viewing band's row.

-- 1. Stop syncing.
drop trigger connections_sync_band_details on public.connections;
drop trigger connection_band_details_sync_back on public.connection_band_details;
drop function private.sync_connection_band_details();
drop function private.sync_band_details_to_connection();

-- 2. A new record gets its band's private row straight away.
create function private.add_band_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.connection_band_details (workspace_id, connection_id)
  values (new.workspace_id, new.id)
  on conflict do nothing;
  return null;
end;
$$;
revoke all on function private.add_band_details from public;
create trigger connections_add_band_details
  after insert on public.connections
  for each row execute function private.add_band_details();

-- 3. Status history moves to the private layer.
drop trigger connections_log_status on public.connections;
drop function private.log_status_change();

create function private.log_band_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.connection_status_changes (workspace_id, connection_id, from_status, to_status, changed_by)
    values (new.workspace_id, new.connection_id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    -- Set while the record was being created: that's its starting status.
    update public.connection_status_changes s set to_status = new.status
    where s.id = (
      select x.id from public.connection_status_changes x
      where x.workspace_id = new.workspace_id and x.connection_id = new.connection_id
      order by x.id desc limit 1)
      and s.from_status is null and s.changed_at = now();
    if not found then
      insert into public.connection_status_changes (workspace_id, connection_id, from_status, to_status, changed_by)
      values (new.workspace_id, new.connection_id, old.status, new.status, auth.uid());
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.log_band_status_change from public;
create trigger connection_band_details_log_status
  after insert or update of status on public.connection_band_details
  for each row execute function private.log_band_status_change();

-- 4. Functions that used the old columns.
create or replace function private.connection_weight(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select
    (c.locality_id is not null)::int + (d.email is not null)::int + (d.phone is not null)::int
    + (coalesce(d.notes, '') <> '')::int + (c.photo_path is not null)::int
    + cardinality(c.can_help_with) + (select count(*) from jsonb_object_keys(c.attributes))::int
    + (select count(*) from public.connection_links l where l.connection_id = c.id)::int
    + (select count(*) from public.connection_scenes s where s.connection_id = c.id)::int
    + (select count(*) from public.affiliations a where a.from_connection_id = c.id or a.to_connection_id = c.id)::int
    + (select count(*) from public.outreach_entries o where o.connection_id = c.id)::int
    + (select count(*) from public.next_actions n where n.connection_id = c.id)::int
  from public.connections c
  left join public.connection_band_details d on d.workspace_id = c.workspace_id and d.connection_id = c.id
  where c.id = p_id
$$;


create or replace function public.create_my_person(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_us uuid;
  v_id uuid;
begin
  select display_name into v_name from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid() and connection_id is null;
  if not found then
    if exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()) then
      raise exception 'already linked' using errcode = 'unique_violation';
    end if;
    raise exception 'not a member' using errcode = 'insufficient_privilege';
  end if;

  insert into public.connections (workspace_id, name, kind, person_roles, created_by)
  values (p_workspace_id, v_name, 'person', '{musician}', auth.uid())
  returning id into v_id;

  select id into v_us from public.connections
  where workspace_id = p_workspace_id and is_us and kind = 'group' and merged_into is null
    and not exists (select 1 from public.connection_band_details d
      where d.workspace_id = p_workspace_id and d.connection_id = connections.id and d.archived_at is not null)
  order by created_at limit 1;
  if v_us is not null then
    insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current)
    values (p_workspace_id, v_id, v_us, 'member', true);
  end if;

  update public.workspace_members set connection_id = v_id
  where workspace_id = p_workspace_id and user_id = auth.uid();
  return v_id;
end;
$$;


create or replace function public.create_linked_connection(
  p_workspace_id uuid,
  p_other_id uuid,                        -- the existing connection
  p_new_is_from boolean,                  -- true: new -> other (a new person joins a band)
  p_name text,
  p_kind public.connection_kind,
  p_person_roles public.person_role[],
  p_affiliation_kind public.affiliation_kind,
  p_is_current boolean,
  p_group_type public.group_type default null,
  p_role text default null,
  -- Carried over from the band when adding a member (#124), each optional.
  p_locality_id uuid default null,
  p_scene_ids uuid[] default null,
  p_played_together boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_id uuid;
begin
  if not exists (
    select 1 from public.connections where id = p_other_id and workspace_id = p_workspace_id
  ) then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;

  insert into public.connections (workspace_id, name, kind, person_roles, group_type, locality_id)
  values (p_workspace_id, p_name, p_kind, coalesce(p_person_roles, '{}'), p_group_type, p_locality_id)
  returning id into v_new_id;
  -- Played together is the band's own (#181).
  update public.connection_band_details set played_together = coalesce(p_played_together, false)
  where workspace_id = p_workspace_id and connection_id = v_new_id and played_together is distinct from coalesce(p_played_together, false);

  insert into public.connection_scenes (workspace_id, connection_id, scene_id)
  select p_workspace_id, v_new_id, s from unnest(coalesce(p_scene_ids, '{}')) s
  on conflict do nothing;

  insert into public.affiliations
    (workspace_id, from_connection_id, to_connection_id, kind, role, is_current)
  values
    (p_workspace_id,
     case when p_new_is_from then v_new_id else p_other_id end,
     case when p_new_is_from then p_other_id else v_new_id end,
     p_affiliation_kind, p_role, p_is_current);

  return v_new_id;
end;
$$;


create or replace function public.add_band_members(
  p_workspace_id uuid,
  p_band_id uuid,
  p_rows jsonb,
  -- Carried over from the band to each new person (#124), each optional.
  -- People already in the directory keep their own values.
  p_locality_id uuid default null,
  p_scene_ids uuid[] default null,
  p_played_together boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_person_id uuid;
  v_name text;
  v_roles text;
  v_added boolean;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be a list' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(p_rows) > 40 then
    raise exception 'too many rows' using errcode = 'invalid_parameter_value';
  end if;

  if not exists (
    select 1 from public.connections
    where id = p_band_id and workspace_id = p_workspace_id and kind = 'group' and group_type = 'band'
  ) then
    raise exception 'band not found' using errcode = 'no_data_found';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_person_id := nullif(v_row ->> 'person_id', '')::uuid;
    v_roles := nullif(trim(coalesce(v_row ->> 'roles', '')), '');

    if v_person_id is not null then
      if not exists (
        select 1 from public.connections
        where id = v_person_id and workspace_id = p_workspace_id and kind = 'person'
      ) then
        raise exception 'person not found' using errcode = 'no_data_found';
      end if;
    else
      v_name := trim(coalesce(v_row ->> 'name', ''));
      insert into public.connections (workspace_id, name, kind, person_roles, locality_id)
      values (p_workspace_id, v_name, 'person', array['musician']::public.person_role[], p_locality_id)
      returning id into v_person_id;
      update public.connection_band_details set played_together = coalesce(p_played_together, false)
      where workspace_id = p_workspace_id and connection_id = v_person_id
        and played_together is distinct from coalesce(p_played_together, false);

      insert into public.connection_scenes (workspace_id, connection_id, scene_id)
      select p_workspace_id, v_person_id, s from unnest(coalesce(p_scene_ids, '{}')) s
      on conflict do nothing;
    end if;

    insert into public.affiliations
      (workspace_id, from_connection_id, to_connection_id, kind, role, is_current)
    values
      (p_workspace_id, v_person_id, p_band_id, 'member', v_roles,
       not coalesce((v_row ->> 'former')::boolean, false))
    on conflict (from_connection_id, to_connection_id, kind) do nothing;
    v_added := found;

    v_results := v_results || jsonb_build_object('person_id', v_person_id, 'added', v_added);
  end loop;

  return v_results;
end;
$$;


create or replace function public.save_connection(
  p_workspace_id uuid,
  p_name text,
  p_kind public.connection_kind,
  p_person_roles public.person_role[],
  p_status public.connection_status,
  p_played_together boolean,
  p_is_us boolean,
  p_can_help_with text[],
  p_scene_ids uuid[],
  p_new_scenes text[],                    -- names; reuses a scene with the same name
  p_links jsonb,                          -- [{"label": text | null, "url": text}], in order
  p_id uuid default null,                 -- null creates a new connection
  p_group_type public.group_type default null,
  p_email text default null,
  p_phone text default null,
  p_notes text default null,
  p_place_id integer default null,        -- a GeoNames place to file under, or
  p_keep_locality_id uuid default null,   -- an existing locality to keep, or neither
  p_expected_updated_at timestamptz default null,  -- edit only: the version the form was opened on
  p_attributes jsonb default null         -- type details (#48); null leaves them as they are
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_locality_id uuid;
  v_scene_ids uuid[] := coalesce(p_scene_ids, '{}');
  v_scene_id uuid;
  v_name text;
  -- Type details, stamped with today's date when they're new or changed (#48).
  v_attributes jsonb := case when p_attributes is null or p_attributes - 'checked_on' = '{}'::jsonb
    then p_attributes - 'checked_on'
    else (p_attributes - 'checked_on') || jsonb_build_object('checked_on', current_date) end;
begin
  -- Town: one locality per place per workspace. Reuse it or add it.
  if p_place_id is not null then
    select id into v_locality_id
    from public.localities
    where workspace_id = p_workspace_id and place_id = p_place_id;

    if v_locality_id is null then
      insert into public.localities
        (workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
      select p_workspace_id, p.id, p.name, p.region_name, p.region_code,
             p.country_name, p.country_code, p.latitude, p.longitude
      from public.places p
      where p.id = p_place_id
      on conflict (workspace_id, place_id) do nothing
      returning id into v_locality_id;

      if v_locality_id is null then
        -- A bandmate added the same town at the same moment, or no such place.
        select id into v_locality_id
        from public.localities
        where workspace_id = p_workspace_id and place_id = p_place_id;
        if v_locality_id is null then
          raise exception 'place not found' using errcode = 'no_data_found';
        end if;
      end if;
    end if;
  elsif p_keep_locality_id is not null then
    v_locality_id := p_keep_locality_id;  -- the composite foreign key keeps it in this workspace
  end if;

  -- The connection itself.
  if v_id is null then
    insert into public.connections
      (workspace_id, name, kind, person_roles, group_type, is_us, can_help_with, locality_id, attributes)
    values
      (p_workspace_id, p_name, p_kind, coalesce(p_person_roles, '{}'), p_group_type,
       p_is_us, coalesce(p_can_help_with, '{}'), v_locality_id, coalesce(v_attributes, '{}'))
    returning id into v_id;
  else
    update public.connections set
      name = p_name,
      kind = p_kind,
      person_roles = coalesce(p_person_roles, '{}'),
      group_type = p_group_type,
      is_us = p_is_us,
      can_help_with = coalesce(p_can_help_with, '{}'),
      locality_id = v_locality_id,
      -- Unchanged details keep their checked date.
      attributes = case
        when v_attributes is null then attributes
        when v_attributes - 'checked_on' = attributes - 'checked_on' then attributes
        else v_attributes end
    where id = v_id
      and workspace_id = p_workspace_id
      -- The version covers this band's private layer too (#181).
      and (p_expected_updated_at is null or greatest(updated_at, coalesce((
        select d.updated_at from public.connection_band_details d
        where d.workspace_id = p_workspace_id and d.connection_id = v_id), updated_at)) = p_expected_updated_at);

    if not found then
      -- Still there, so someone saved it after this form was opened.
      if exists (select 1 from public.connections where id = v_id and workspace_id = p_workspace_id) then
        raise exception 'connection changed since it was opened'
          using errcode = 'PT409';
      end if;
      -- RLS hides rows the member can't edit, which shows up as nothing updated.
      raise exception 'connection not found' using errcode = 'no_data_found';
    end if;
  end if;

  -- This band's private layer (#181): status, played together, contacts, notes.
  insert into public.connection_band_details
    (workspace_id, connection_id, status, played_together, email, phone, notes)
  values (p_workspace_id, v_id, p_status, p_played_together, p_email, p_phone, p_notes)
  on conflict (workspace_id, connection_id) do update set
    status = excluded.status,
    played_together = excluded.played_together,
    email = excluded.email,
    phone = excluded.phone,
    notes = excluded.notes
  where (connection_band_details.status, connection_band_details.played_together, connection_band_details.email,
         connection_band_details.phone, connection_band_details.notes)
    is distinct from (excluded.status, excluded.played_together, excluded.email, excluded.phone, excluded.notes);

  -- New scenes typed in by name reuse a scene with the same name, ignoring case.
  foreach v_name in array coalesce(p_new_scenes, '{}') loop
    v_name := trim(v_name);
    continue when v_name = '';

    v_scene_id := null;
    select id into v_scene_id
    from public.scenes
    where workspace_id = p_workspace_id and lower(name) = lower(v_name)
    order by created_at, id
    limit 1;

    if v_scene_id is null then
      insert into public.scenes (workspace_id, name)
      values (p_workspace_id, v_name)
      on conflict (workspace_id, name) do nothing
      returning id into v_scene_id;

      if v_scene_id is null then
        select id into v_scene_id
        from public.scenes
        where workspace_id = p_workspace_id and name = v_name;
      end if;
      if v_scene_id is null then
        raise exception 'could not add scene' using errcode = 'no_data_found';
      end if;
    end if;

    v_scene_ids := v_scene_ids || v_scene_id;
  end loop;

  -- Scene tags: exactly these scenes. Unchanged tags are left alone.
  delete from public.connection_scenes
  where connection_id = v_id and scene_id <> all (v_scene_ids);

  insert into public.connection_scenes (workspace_id, connection_id, scene_id)
  select distinct p_workspace_id, v_id, s
  from unnest(v_scene_ids) as s
  on conflict (connection_id, scene_id) do nothing;

  -- Links: exactly these, in this order.
  delete from public.connection_links where connection_id = v_id;

  insert into public.connection_links (workspace_id, connection_id, label, url, position)
  select p_workspace_id, v_id, nullif(trim(l.value ->> 'label'), ''), l.value ->> 'url', (l.ord - 1)::smallint
  from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality as l (value, ord);

  return v_id;
end;
$$;


create or replace function public.import_connections(p_workspace_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  v_id uuid;
  v_match uuid;
  v_place integer;
  v_locality uuid;
  v_venue jsonb;
  v_scene_ids uuid[];
  v_scene uuid;
  v_name text;
  v_booker uuid;
  v_added integer := 0;
  v_filled integer := 0;
  v_people integer := 0;
  v_links integer := 0;
  v_pos integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'import takes up to 1000 rows' using errcode = 'invalid_parameter_value';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_match := nullif(r ->> 'match_id', '')::uuid;
    v_place := nullif(r ->> 'place_id', '')::integer;
    v_venue := coalesce(r -> 'venue', '{}'::jsonb);

    if v_match is null then
      v_id := public.save_connection(
        p_workspace_id => p_workspace_id,
        p_name => r ->> 'name',
        p_kind => (r ->> 'kind')::public.connection_kind,
        p_person_roles => coalesce(array(select jsonb_array_elements_text(r -> 'person_roles')), '{}')::public.person_role[],
        p_status => coalesce(r ->> 'status', 'neutral')::public.connection_status,
        p_played_together => coalesce((r ->> 'played_together')::boolean, false),
        p_is_us => false,
        p_can_help_with => '{}',
        p_scene_ids => '{}',
        p_new_scenes => coalesce(array(select jsonb_array_elements_text(r -> 'scenes')), '{}'),
        p_links => coalesce(r -> 'links', '[]'::jsonb),
        p_group_type => nullif(r ->> 'group_type', '')::public.group_type,
        p_email => nullif(r ->> 'email', ''),
        p_phone => nullif(r ->> 'phone', ''),
        p_notes => nullif(r ->> 'notes', ''),
        p_place_id => v_place,
        p_attributes => case when v_venue = '{}'::jsonb then null else v_venue end
      );
      v_added := v_added + 1;
    else
      v_id := v_match;
      -- Town: the same locality save_connection would pick.
      v_locality := null;
      if v_place is not null then
        select id into v_locality from public.localities
        where workspace_id = p_workspace_id and place_id = v_place;
        if v_locality is null then
          insert into public.localities
            (workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
          select p_workspace_id, p.id, p.name, p.region_name, p.region_code,
                 p.country_name, p.country_code, p.latitude, p.longitude
          from public.places p where p.id = v_place
          on conflict (workspace_id, place_id) do nothing
          returning id into v_locality;
          if v_locality is null then
            select id into v_locality from public.localities
            where workspace_id = p_workspace_id and place_id = v_place;
          end if;
        end if;
      end if;

      update public.connections c set
        locality_id = coalesce(c.locality_id, v_locality),
        -- Details it already has win; new ones are stamped today.
        attributes = case
          when (v_venue - array(select jsonb_object_keys(c.attributes))) = '{}'::jsonb then c.attributes
          else v_venue || c.attributes || jsonb_build_object('checked_on', current_date) end
      where c.id = v_id and c.workspace_id = p_workspace_id;
      if not found then
        raise exception 'connection not found' using errcode = 'no_data_found';
      end if;

      -- This band's private layer (#181): fill blanks, add notes.
      update public.connection_band_details d set
        email = coalesce(d.email, nullif(r ->> 'email', '')),
        phone = coalesce(d.phone, nullif(r ->> 'phone', '')),
        played_together = d.played_together or coalesce((r ->> 'played_together')::boolean, false),
        notes = case
          when nullif(r ->> 'notes', '') is null then d.notes
          when coalesce(d.notes, '') = '' then r ->> 'notes'
          when position(r ->> 'notes' in d.notes) > 0 then d.notes
          else d.notes || E'\n\n' || (r ->> 'notes') end
      where d.workspace_id = p_workspace_id and d.connection_id = v_id;

      -- Links it doesn't have yet, after the ones it does.
      select coalesce(max(position), -1) into v_pos from public.connection_links where connection_id = v_id;
      insert into public.connection_links (workspace_id, connection_id, label, url, position)
      select p_workspace_id, v_id, nullif(trim(l.value ->> 'label'), ''), l.value ->> 'url', (v_pos + l.ord)::smallint
      from jsonb_array_elements(coalesce(r -> 'links', '[]'::jsonb)) with ordinality as l (value, ord)
      where not exists (
        select 1 from public.connection_links x
        where x.connection_id = v_id and lower(x.url) = lower(l.value ->> 'url'));

      -- Scenes by name, as save_connection reuses them.
      v_scene_ids := '{}';
      for v_name in select trim(value) from jsonb_array_elements_text(coalesce(r -> 'scenes', '[]'::jsonb)) loop
        continue when v_name = '';
        v_scene := null;
        select id into v_scene from public.scenes
        where workspace_id = p_workspace_id and lower(name) = lower(v_name)
        order by created_at, id limit 1;
        if v_scene is null then
          insert into public.scenes (workspace_id, name) values (p_workspace_id, v_name)
          on conflict (workspace_id, name) do nothing returning id into v_scene;
          if v_scene is null then
            select id into v_scene from public.scenes where workspace_id = p_workspace_id and name = v_name;
          end if;
        end if;
        v_scene_ids := v_scene_ids || v_scene;
      end loop;
      insert into public.connection_scenes (workspace_id, connection_id, scene_id)
      select distinct p_workspace_id, v_id, s from unnest(v_scene_ids) s
      on conflict (connection_id, scene_id) do nothing;

      v_filled := v_filled + 1;
    end if;

    -- Who books this room.
    if r ->> 'group_type' = 'venue' then
      for v_name in select trim(value) from jsonb_array_elements_text(coalesce(r -> 'booked_by', '[]'::jsonb)) loop
        continue when v_name = '';
        v_booker := null;
        select c.id into v_booker from public.connections c
        where c.workspace_id = p_workspace_id and not c.is_us
          and not exists (select 1 from public.connection_band_details d
            where d.workspace_id = p_workspace_id and d.connection_id = c.id and d.archived_at is not null)
          and lower(c.name) = lower(v_name)
          and (c.kind = 'person' or c.group_type = 'promoter_collective')
        order by c.created_at, c.id limit 1;
        if v_booker is null then
          if v_name ~* '\m(presents|collective|productions|promotions|booking|bookings|records)\M' then
            insert into public.connections (workspace_id, name, kind, group_type)
            values (p_workspace_id, v_name, 'group', 'promoter_collective')
            returning id into v_booker;
          else
            insert into public.connections (workspace_id, name, kind, person_roles)
            values (p_workspace_id, v_name, 'person', '{booker}')
            returning id into v_booker;
          end if;
          v_people := v_people + 1;
        end if;
        insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current)
        values (p_workspace_id, v_booker, v_id, 'books', true)
        on conflict (from_connection_id, to_connection_id, kind) do nothing;
        if found then v_links := v_links + 1; end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'filled', v_filled, 'bookers_added', v_people, 'booking_links', v_links);
end;
$$;


create or replace function public.merge_connections(p_keep uuid, p_merge uuid[], p_photo jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws uuid;
  k public.connections;
  l public.connections;
  -- This band's private layer (#181) on the kept one and on each merged one.
  kd public.connection_band_details;
  ld public.connection_band_details;
  v_ids uuid[];
  v_lose uuid;
  v_log jsonb := '[]';
  v_old jsonb := '{}';
  v_new jsonb;
  r record;
  e record;
  v_pos integer;
  v_merge uuid;
  v_notes text;
  v_summary jsonb;
begin
  v_ids := array(select distinct x from unnest(p_merge) x where x is not null);
  if cardinality(v_ids) = 0 then
    raise exception 'pick at least one connection to merge' using errcode = 'invalid_parameter_value';
  end if;
  if cardinality(v_ids) > 20 then
    raise exception 'merge up to 20 at a time' using errcode = 'invalid_parameter_value';
  end if;
  if p_keep = any(v_ids) then
    raise exception 'a connection can''t be merged into itself' using errcode = 'invalid_parameter_value';
  end if;

  select * into k from public.connections where id = p_keep for update;
  if not found or k.workspace_id not in (select private.my_workspace_ids()) or k.merged_into is not null then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  v_ws := k.workspace_id;
  select * into kd from public.connection_band_details where workspace_id = v_ws and connection_id = p_keep for update;

  perform 1 from public.connections c where c.id = any(v_ids) for update;
  if (select count(*) from public.connections c
      where c.id = any(v_ids) and c.workspace_id = v_ws and c.merged_into is null) <> cardinality(v_ids) then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  if not k.is_us and k.kind <> 'group'
     and exists (select 1 from public.connections c where c.id = any(v_ids) and c.is_us) then
    raise exception 'our band can only be merged into a group' using errcode = 'check_violation';
  end if;

  perform set_config('seeens.merging', 'on', true);

  -- Fill order: the most complete first, so it wins any blank.
  v_ids := array(select x from unnest(v_ids) x order by private.connection_weight(x) desc, x);
  select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind,
      'group_type', c.group_type, 'person_roles', c.person_roles, 'catalog_no', c.catalog_no)
    order by array_position(v_ids, c.id))
  into v_summary from public.connections c where c.id = any(v_ids);

  -- The kept row's values before anything fills in, for undo.
  v_old := jsonb_build_object(
    'locality_id', k.locality_id, 'email', kd.email, 'phone', kd.phone, 'notes', kd.notes,
    'can_help_with', to_jsonb(k.can_help_with), 'played_together', coalesce(kd.played_together, false),
    'person_roles', to_jsonb(k.person_roles), 'attributes', k.attributes, 'is_us', k.is_us);

  foreach v_lose in array v_ids loop
    select * into l from public.connections where id = v_lose;
    select * into ld from public.connection_band_details where workspace_id = v_ws and connection_id = v_lose;

    -- Blanks on the kept one: this band's private layer, then the record.
    v_notes := nullif(btrim(coalesce(ld.notes, '')), '');
    update public.connection_band_details d set
      email = coalesce(d.email, ld.email),
      phone = coalesce(d.phone, ld.phone),
      notes = case
        when v_notes is null then d.notes
        when coalesce(btrim(d.notes), '') = '' then ld.notes
        when position(v_notes in d.notes) > 0 then d.notes
        else d.notes || E'\n\n' || 'From ' || l.name || ':' || E'\n' || ld.notes end,
      played_together = d.played_together or coalesce(ld.played_together, false)
    where d.workspace_id = v_ws and d.connection_id = p_keep;
    update public.connections c set
      locality_id = coalesce(c.locality_id, l.locality_id),
      can_help_with = array(select distinct x from unnest(c.can_help_with || l.can_help_with) x),
      person_roles = case when c.kind = 'person' and l.kind = 'person'
        then array(select distinct x from unnest(c.person_roles || l.person_roles) x)
        else c.person_roles end,
      attributes = l.attributes || c.attributes
    where c.id = p_keep;

    -- The photo, copied by the app into the kept one's folder.
    if p_photo is not null and v_lose = v_ids[1] then
      update public.connections c set
        photo_path = p_photo ->> 'path',
        photo_original_path = p_photo ->> 'original_path',
        photo_settings = p_photo -> 'settings',
        photo_alt = nullif(left(p_photo ->> 'alt', 300), '')
      where c.id = p_keep and c.photo_path is null;
      if found then
        v_log := v_log || jsonb_build_object('op', 'photo', 'path', p_photo ->> 'path',
          'original_path', p_photo ->> 'original_path');
      end if;
    end if;

    -- Only one connection can be us. The kept one takes it.
    if l.is_us then
      update public.connections set is_us = false where id = v_lose;
      update public.connections set is_us = true where id = p_keep;
      v_log := v_log || jsonb_build_object('op', 'us', 'from', v_lose);
    end if;

    -- Links: append after the kept one's, skipping URLs it already has.
    select coalesce(max(position), -1) into v_pos from public.connection_links where connection_id = p_keep;
    for r in select * from public.connection_links where connection_id = v_lose order by position, created_at loop
      if exists (
        select 1 from public.connection_links x
        where x.connection_id = p_keep
          and lower(regexp_replace(regexp_replace(x.url, '^https?://(www\.)?', '', 'i'), '/+$', ''))
            = lower(regexp_replace(regexp_replace(r.url, '^https?://(www\.)?', '', 'i'), '/+$', ''))) then
        delete from public.connection_links where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'connection_links', 'row', to_jsonb(r));
      else
        v_pos := v_pos + 1;
        update public.connection_links set connection_id = p_keep, position = v_pos where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'link', 'id', r.id, 'from', v_lose, 'pos', r.position);
      end if;
    end loop;

    -- Scenes.
    for r in select * from public.connection_scenes where connection_id = v_lose loop
      if exists (select 1 from public.connection_scenes x where x.connection_id = p_keep and x.scene_id = r.scene_id) then
        delete from public.connection_scenes where connection_id = v_lose and scene_id = r.scene_id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'connection_scenes', 'row', to_jsonb(r));
      else
        update public.connection_scenes set connection_id = p_keep
        where connection_id = v_lose and scene_id = r.scene_id;
        v_log := v_log || jsonb_build_object('op', 'scene', 'scene', r.scene_id, 'from', v_lose);
      end if;
    end loop;

    -- Affiliations, both directions. A link to the kept one (or between two
    -- that are both being merged) would point at itself: dropped. One that
    -- the kept one already has is dropped too, after filling its blanks.
    for r in select * from public.affiliations a where a.from_connection_id = v_lose or a.to_connection_id = v_lose loop
      if r.from_connection_id = v_lose and r.to_connection_id = p_keep
         or r.to_connection_id = v_lose and r.from_connection_id = p_keep then
        delete from public.affiliations where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'affiliations', 'row', to_jsonb(r));
        continue;
      end if;

      select * into e from public.affiliations a
      where a.id <> r.id and a.kind = r.kind
        and a.from_connection_id = case when r.from_connection_id = v_lose then p_keep else r.from_connection_id end
        and a.to_connection_id = case when r.to_connection_id = v_lose then p_keep else r.to_connection_id end;
      if found then
        if (e.role is null and r.role is not null) or (e.notes is null and r.notes is not null) then
          update public.affiliations set role = coalesce(role, r.role), notes = coalesce(notes, r.notes) where id = e.id;
          v_log := v_log || jsonb_build_object('op', 'aff_fill', 'id', e.id, 'role', e.role, 'notes', e.notes,
            'new_role', coalesce(e.role, r.role), 'new_notes', coalesce(e.notes, r.notes));
        end if;
        delete from public.affiliations where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'affiliations', 'row', to_jsonb(r));
      elsif r.from_connection_id = v_lose then
        update public.affiliations set from_connection_id = p_keep where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'move', 't', 'affiliations', 'col', 'from_connection_id', 'id', r.id, 'from', v_lose);
      else
        update public.affiliations set to_connection_id = p_keep where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'move', 't', 'affiliations', 'col', 'to_connection_id', 'id', r.id, 'from', v_lose);
      end if;
    end loop;

    -- Outreach and status history move as they are.
    for r in select id from public.outreach_entries where connection_id = v_lose loop
      update public.outreach_entries set connection_id = p_keep where id = r.id;
      v_log := v_log || jsonb_build_object('op', 'move', 't', 'outreach_entries', 'col', 'connection_id', 'id', r.id, 'from', v_lose);
    end loop;
    for r in select id from public.connection_status_changes where connection_id = v_lose loop
      update public.connection_status_changes set connection_id = p_keep where id = r.id;
      v_log := v_log || jsonb_build_object('op', 'move_n', 't', 'connection_status_changes', 'id', r.id, 'from', v_lose);
    end loop;

    -- Plans: only one can be open. If the kept one has one, this one's
    -- open plan is closed as dropped before it moves over.
    for r in select id, status from public.next_actions where connection_id = v_lose loop
      if r.status = 'open' and exists (
        select 1 from public.next_actions n where n.connection_id = p_keep and n.status = 'open') then
        update public.next_actions set status = 'dropped', closed_at = now(), closed_by = auth.uid() where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'reopen', 'id', r.id);
      end if;
      update public.next_actions set connection_id = p_keep where id = r.id;
      v_log := v_log || jsonb_build_object('op', 'move', 't', 'next_actions', 'col', 'connection_id', 'id', r.id, 'from', v_lose);
    end loop;

    update public.connections set merged_into = p_keep, merged_at = now() where id = v_lose;
  end loop;

  select jsonb_build_object(
    'locality_id', c.locality_id, 'email', d.email, 'phone', d.phone, 'notes', d.notes,
    'can_help_with', to_jsonb(c.can_help_with), 'played_together', coalesce(d.played_together, false),
    'person_roles', to_jsonb(c.person_roles), 'attributes', c.attributes, 'is_us', c.is_us)
  into v_new from public.connections c
  left join public.connection_band_details d on d.workspace_id = c.workspace_id and d.connection_id = c.id
  where c.id = p_keep;
  v_log := jsonb_build_array(jsonb_build_object('op', 'keep', 'old', v_old, 'new', v_new)) || v_log;

  insert into public.connection_merges (workspace_id, keep_id, merged_ids, merged_summary, log)
  values (v_ws, p_keep, v_ids, v_summary, v_log)
  returning id into v_merge;

  perform set_config('seeens.merging', 'off', true);
  return v_merge;
end;
$$;


create or replace function public.undo_merge(p_merge uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.connection_merges;
  s jsonb;
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_cur jsonb;
  v_set text[] := '{}';
begin
  select * into m from public.connection_merges where id = p_merge for update;
  if not found or m.workspace_id not in (select private.my_workspace_ids()) then
    raise exception 'merge not found' using errcode = 'no_data_found';
  end if;
  if m.undone_at is not null then
    raise exception 'that merge was already undone' using errcode = 'check_violation';
  end if;
  if m.purged_at is not null or m.merged_at < now() - interval '30 days' then
    raise exception 'that merge is more than 30 days old' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.connections c where c.id = m.keep_id and c.merged_into is not null) then
    raise exception 'undo the later merge first' using errcode = 'check_violation';
  end if;

  perform 1 from public.connections c where c.id = m.keep_id or c.id = any(m.merged_ids) for update;
  perform set_config('seeens.merging', 'on', true);

  -- Bring the merged-away ones back first, so rows can point at them again.
  update public.connections set merged_into = null, merged_at = null
  where id = any(m.merged_ids) and merged_into = m.keep_id;

  for s in select value from jsonb_array_elements(m.log) with ordinality as t(value, n) order by n desc loop
    case s ->> 'op'
      when 'move' then
        if s ->> 't' not in ('affiliations', 'outreach_entries', 'next_actions') then
          raise exception 'unknown table in merge log';
        end if;
        execute format('update public.%I set %I = $1 where id = $2 and %I = $3',
          s ->> 't', coalesce(s ->> 'col', 'connection_id'), coalesce(s ->> 'col', 'connection_id'))
          using (s ->> 'from')::uuid, (s ->> 'id')::uuid, m.keep_id;
      when 'move_n' then
        update public.connection_status_changes set connection_id = (s ->> 'from')::uuid
        where id = (s ->> 'id')::bigint and connection_id = m.keep_id;
      when 'link' then
        update public.connection_links set connection_id = (s ->> 'from')::uuid, position = (s ->> 'pos')::smallint
        where id = (s ->> 'id')::uuid and connection_id = m.keep_id;
      when 'scene' then
        update public.connection_scenes set connection_id = (s ->> 'from')::uuid
        where connection_id = m.keep_id and scene_id = (s ->> 'scene')::uuid;
      when 'restore' then
        if s ->> 't' not in ('affiliations', 'connection_links', 'connection_scenes') then
          raise exception 'unknown table in merge log';
        end if;
        execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
          s ->> 't', s ->> 't')
          using s -> 'row';
      when 'aff_fill' then
        update public.affiliations a set
          role = case when a.role is not distinct from s ->> 'new_role' then s ->> 'role' else a.role end,
          notes = case when a.notes is not distinct from s ->> 'new_notes' then s ->> 'notes' else a.notes end
        where a.id = (s ->> 'id')::uuid;
      when 'reopen' then
        update public.next_actions set status = 'open', closed_at = null, closed_by = null
        where id = (s ->> 'id')::uuid and status = 'dropped'
          and not exists (select 1 from public.next_actions n
            where n.connection_id = public.next_actions.connection_id and n.status = 'open');
      when 'photo' then
        -- The copied photo comes off unless it's been replaced since. The app
        -- deletes the copied files after.
        update public.connections set photo_path = null, photo_original_path = null, photo_settings = null, photo_alt = null
        where id = m.keep_id and photo_path = s ->> 'path';
      when 'us' then
        update public.connections set is_us = false where id = m.keep_id;
        update public.connections set is_us = true where id = (s ->> 'from')::uuid;
      when 'keep' then
        -- Revert each filled-in value that's still what the merge left.
        v_old := s -> 'old';
        v_new := s -> 'new';
        -- The record and this band's private layer (#181), as the log saw them.
        select to_jsonb(c) || jsonb_build_object('email', d.email, 'phone', d.phone, 'notes', d.notes,
            'played_together', coalesce(d.played_together, false))
        into v_cur from public.connections c
        left join public.connection_band_details d on d.workspace_id = c.workspace_id and d.connection_id = c.id
        where c.id = m.keep_id;
        for v_col in select jsonb_object_keys(v_old) loop
          if v_col <> 'is_us' and v_cur -> v_col is not distinct from v_new -> v_col
             and v_old -> v_col is distinct from v_new -> v_col then
            v_set := v_set || v_col;
          end if;
        end loop;
        update public.connections c set
          locality_id = case when 'locality_id' = any(v_set) then (v_old ->> 'locality_id')::uuid else c.locality_id end,
          can_help_with = case when 'can_help_with' = any(v_set)
            then array(select jsonb_array_elements_text(v_old -> 'can_help_with')) else c.can_help_with end,
          person_roles = case when 'person_roles' = any(v_set)
            then array(select jsonb_array_elements_text(v_old -> 'person_roles'))::public.person_role[] else c.person_roles end,
          attributes = case when 'attributes' = any(v_set) then v_old -> 'attributes' else c.attributes end
        where c.id = m.keep_id;
        update public.connection_band_details d set
          email = case when 'email' = any(v_set) then v_old ->> 'email' else d.email end,
          phone = case when 'phone' = any(v_set) then v_old ->> 'phone' else d.phone end,
          notes = case when 'notes' = any(v_set) then v_old ->> 'notes' else d.notes end,
          played_together = case when 'played_together' = any(v_set)
            then (v_old ->> 'played_together')::boolean else d.played_together end
        where d.workspace_id = m.workspace_id and d.connection_id = m.keep_id;
      else
        raise exception 'unknown step in merge log';
    end case;
  end loop;

  update public.connection_merges set undone_at = now(), undone_by = auth.uid() where id = p_merge;
  perform set_config('seeens.merging', 'off', true);
  return m.keep_id;
end;
$$;


create or replace function public.directory_page(
  p_workspace_id uuid,
  p_archived boolean,
  p_q text default '',
  p_statuses public.connection_status[] default '{}',
  p_list_status public.connection_status default null,
  p_kind public.connection_kind default null,
  p_group_type public.group_type default null,
  p_person_role public.person_role default null,
  p_scene_ids uuid[] default null,
  p_town uuid default null,
  p_hide_avoid boolean default true,
  p_after jsonb default null,
  p_limit integer default 48,
  p_counts boolean default true,
  p_type text default null,
  p_instrument text default null,
  p_ages text default null,
  p_capacity text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 48), 1), 200) as lim,
      case when nullif(trim(coalesce(p_q, '')), '') is null then null
        else '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as pattern,
      -- "BND-0042", "0042", or "42"; at most 9 digits so it fits an integer.
      (substring(trim(coalesce(p_q, '')) from '^(?:[A-Za-z]{2,3}-)?([0-9]{1,9})$'))::integer as catalog_no,
      (select c.id from public.connections c
        where c.workspace_id = p_workspace_id and c.is_us limit 1) as us
  ),
  -- Everyone in this half, with its sort key and whether it passes the filters.
  half as (
    select
      c.id,
      array_position(enum_range(null::public.connection_status), coalesce(b.status, cd.status, 'neutral')) as rank,
      lower(c.name) as sort_name,
      -- "Close to us" (#140): someone who's Heard of takes the closest status
      -- of the bands they're in now; any status set on the person wins.
      coalesce(b.status, cd.status, 'neutral') as status,
      b.name as via,
      c.kind,
      c.locality_id,
      -- Which directory tab it belongs to (#122).
      case
        when c.kind = 'person' then 'people'
        when c.group_type = 'band' then 'bands'
        when c.group_type = 'venue' then 'venues'
        else 'more'
      end as tab,
      -- Every filter except status and type.
      (pr.pattern is null or c.name ilike pr.pattern or c.catalog_no = pr.catalog_no)
        and (p_kind is null or c.kind = p_kind)
        and (p_group_type is null or c.group_type = p_group_type)
        and (p_person_role is null or p_person_role = any (c.person_roles))
        and (p_scene_ids is null or exists (
          select 1 from public.connection_scenes cs
          where cs.connection_id = c.id and cs.scene_id = any (p_scene_ids)))
        and (p_town is null or c.locality_id = p_town)
        -- Plays (#140): an instrument in any of their band roles, now or before.
        and (p_instrument is null or exists (
          select 1 from public.affiliations a
          where a.from_connection_id = c.id and a.kind = 'member'
            and p_instrument = any (public.role_instruments(a.role))))
        -- Venue details (#48): ages and capacity.
        and (p_ages is null or c.attributes ->> 'ages' = p_ages)
        and (p_capacity is null or c.attributes ->> 'capacity' = p_capacity) as passes
    from public.connections c
    cross join params pr
    -- This band's private layer (#181); a record it never touched reads as Known.
    left join public.connection_band_details cd on cd.workspace_id = p_workspace_id and cd.connection_id = c.id
    left join lateral (
      select gd.status, g.name
      from public.affiliations a
      join public.connections g on g.id = a.to_connection_id
      join public.connection_band_details gd on gd.workspace_id = p_workspace_id and gd.connection_id = g.id
      where c.kind = 'person' and coalesce(cd.status, 'neutral') = 'neutral'
        and a.from_connection_id = c.id and a.kind = 'member' and a.is_current
        and gd.archived_at is null and not g.is_us
        -- Only closer than Heard of; a band in Avoid never pulls a person there.
        and gd.status in ('homies', 'lets_play', 'prospect')
      order by array_position(enum_range(null::public.connection_status), gd.status), lower(g.name)
      limit 1
    ) b on true
    where c.workspace_id = p_workspace_id
      and not c.is_us
      and (cd.archived_at is not null) = p_archived
  ),
  -- Status: the asked-for statuses, or everyone but Avoid. Every tab.
  shown as (
    select h.* from half h
    where h.passes and (
      case when cardinality(p_statuses) > 0 then h.status = any (p_statuses)
      else not (p_hide_avoid and h.status = 'avoid') end)
  ),
  -- This tab ('bands', 'people', 'venues', 'more'; null or 'all' is everyone).
  matched as (
    select s.* from shown s
    where p_type is null or p_type = 'all' or s.tab = p_type
  ),
  -- One row past the page, to know whether there's a next one.
  page as (
    select m.id, m.rank, m.sort_name, m.status, m.via, row_number() over (order by m.rank, m.sort_name, m.id) as n
    from matched m
    where p_after is null or (m.rank, m.sort_name, m.id) >
      ((p_after ->> 'rank')::integer, p_after ->> 'name', (p_after ->> 'id')::uuid)
    order by m.rank, m.sort_name, m.id
    limit (select lim + 1 from params)
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'status', p.status,
          'via', p.via,
          'label_mate', pr.us is not null and not p_archived and exists (
            select 1
            from public.affiliations mine
            join public.affiliations ours on ours.to_connection_id = mine.to_connection_id
            where mine.from_connection_id = p.id and mine.kind = 'on_label'
              and ours.from_connection_id = pr.us and ours.kind = 'on_label'),
          'shares_member', pr.us is not null and exists (
            select 1
            from public.affiliations theirs
            join public.affiliations ours on ours.from_connection_id = theirs.from_connection_id
            where theirs.to_connection_id = p.id and theirs.kind = 'member'
              and ours.to_connection_id = pr.us and ours.kind = 'member')
        ) order by p.n)
      from page p, params pr
      where p.n <= pr.lim), '[]'::jsonb),
    'next', (
      select jsonb_build_object('rank', p.rank, 'name', p.sort_name, 'id', p.id)
      from page p, params pr
      where p.n = pr.lim
        and exists (select 1 from page q where q.n = pr.lim + 1)),
    'counts', case when p_counts then (
      select jsonb_build_object(
        'view', (select count(*) from half),
        'total', (select count(*) from half h
          where (p_list_status is null or h.status = p_list_status)
            and (p_type is null or p_type = 'all' or h.tab = p_type)),
        'matched', (select count(*) from matched),
        'groups', (
          select jsonb_build_object(
            'homies', count(*) filter (where m.status = 'homies'),
            'lets_play', count(*) filter (where m.status = 'lets_play'),
            'prospect', count(*) filter (where m.status = 'prospect'),
            'neutral', count(*) filter (where m.status = 'neutral'),
            'avoid', count(*) filter (where m.status = 'avoid'))
          from matched m),
        'hidden_avoid', case when cardinality(p_statuses) = 0 and p_hide_avoid then (
            select count(*) from half h where h.passes and h.status = 'avoid'
              and (p_type is null or p_type = 'all' or h.tab = p_type))
          else 0 end,
        -- How many in this tab are archived, for the "3 archived" link (no
        -- other filter applies; it opens the archived view fresh). 0 there.
        'archived', case when p_archived then 0 else (
            select count(*) from public.connections a
            join public.connection_band_details ad on ad.workspace_id = p_workspace_id and ad.connection_id = a.id
            where a.workspace_id = p_workspace_id and not a.is_us and ad.archived_at is not null
              and (p_type is null or p_type = 'all' or case
                when a.kind = 'person' then 'people'
                when a.group_type = 'band' then 'bands'
                when a.group_type = 'venue' then 'venues'
                else 'more' end = p_type)) end,
        -- Tab counts follow every other filter.
        'types', (
          select jsonb_build_object(
            'bands', count(*) filter (where s.tab = 'bands'),
            'people', count(*) filter (where s.tab = 'people'),
            'venues', count(*) filter (where s.tab = 'venues'),
            'more', count(*) filter (where s.tab = 'more'),
            'all', count(*))
          from shown s),
        -- Instruments people in this half play, for the Plays filter.
        'instruments', coalesce((
          select jsonb_agg(distinct i order by i)
          from half h
          join public.affiliations a on a.from_connection_id = h.id and a.kind = 'member'
          cross join unnest(public.role_instruments(a.role)) i
          where h.kind = 'person'), '[]'::jsonb),
        'towns', coalesce((
          select jsonb_agg(jsonb_build_object(
              'id', l.id, 'name', l.name, 'region', l.region, 'region_code', l.region_code,
              'country', l.country, 'country_code', l.country_code))
          from public.localities l
          where l.workspace_id = p_workspace_id
            and l.id in (select h.locality_id from half h where h.locality_id is not null)), '[]'::jsonb)
      )) end
  );
$$;


-- 5. The old columns. (Their index, connections_status_idx, goes with them.)
alter table public.connections
  drop column status,
  drop column played_together,
  drop column notes,
  drop column email,
  drop column phone,
  drop column archived_at;
