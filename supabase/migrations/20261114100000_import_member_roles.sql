-- Import reads band members like Paste Lineup does (#321).
--
-- A Members cell can say what each person plays ("Jo Example - vocals,
-- guitar", "Lee Example (drums)") and who's a former member. Import now
-- keeps that: roles go on the member link, former members are linked as
-- former, and someone already linked with no roles gets them filled in.
-- Plain names still work.

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
  v_member uuid;
  v_members integer := 0;
  m jsonb;
  v_role text;
  v_current boolean;
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

      -- Links it doesn't have yet, after the ones it does (#321). The same
      -- page counts as the same link however it's written, and a record with
      -- an Instagram (or Bandcamp, or ...) keeps its own: a sheet's second
      -- one is skipped, not stacked under it.
      select coalesce(max(position), -1) into v_pos from public.connection_links where connection_id = v_id;
      insert into public.connection_links (workspace_id, connection_id, label, url, position)
      select p_workspace_id, v_id, n.label, n.url, (v_pos + row_number() over (order by n.ord))::smallint
      from (
        select l.label, l.url, l.ord,
          row_number() over (partition by private.link_key(l.url) order by l.ord) as nth_url,
          row_number() over (partition by private.one_per_record(l.label) order by l.ord) as nth_kind
        from (
          select nullif(trim(e.value ->> 'label'), '') as label, e.value ->> 'url' as url, e.ord
          from jsonb_array_elements(coalesce(r -> 'links', '[]'::jsonb)) with ordinality as e (value, ord)
        ) l
      ) n
      where n.nth_url = 1
        and (private.one_per_record(n.label) is null or n.nth_kind = 1)
        and not exists (
          select 1 from public.connection_links x
          where x.connection_id = v_id
            and (private.link_key(x.url) = private.link_key(n.url)
              or private.one_per_record(x.label) = private.one_per_record(n.label)));

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

    -- A band's members (#321): someone already linked to this band, or a full
    -- name that's one person here, is reused. A first name alone ("Chris")
    -- could be anyone, so it gets its own record.
    if r ->> 'group_type' = 'band' then
      for m in select value from jsonb_array_elements(coalesce(r -> 'members', '[]'::jsonb)) loop
        -- A name, or (since #321's lineup reading) a name with roles.
        if jsonb_typeof(m) = 'string' then
          v_name := trim(m #>> '{}');
          v_role := null;
          v_current := true;
        else
          v_name := trim(coalesce(m ->> 'name', ''));
          v_role := nullif(left(trim(coalesce(m ->> 'roles', '')), 80), '');
          v_current := not coalesce((m ->> 'former')::boolean, false);
        end if;
        continue when v_name = '';
        v_member := null;
        select c.id into v_member from public.connections c
        join public.affiliations a on a.from_connection_id = c.id and a.to_connection_id = v_id
        where c.workspace_id = p_workspace_id and c.kind = 'person' and lower(c.name) = lower(v_name)
        order by c.created_at, c.id limit 1;
        if v_member is null and v_name ~ '\S\s+\S' then
          select c.id into v_member from public.connections c
          where c.workspace_id = p_workspace_id and c.kind = 'person' and not c.is_us
            and lower(c.name) = lower(v_name)
            and not exists (select 1 from public.connection_band_details d
              where d.workspace_id = p_workspace_id and d.connection_id = c.id and d.archived_at is not null)
            and (select count(*) from public.connections o
              where o.workspace_id = p_workspace_id and o.kind = 'person' and lower(o.name) = lower(v_name)) = 1;
        end if;
        if v_member is null then
          insert into public.connections (workspace_id, name, kind, person_roles)
          values (p_workspace_id, v_name, 'person', '{musician}')
          returning id into v_member;
        end if;
        insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, role, is_current)
        values (p_workspace_id, v_member, v_id, 'member', v_role, v_current)
        on conflict (from_connection_id, to_connection_id, kind) do nothing;
        if found then
          v_members := v_members + 1;
        elsif v_role is not null then
          -- Already a member: fill in their roles if they had none.
          update public.affiliations set role = v_role
          where from_connection_id = v_member and to_connection_id = v_id and kind = 'member' and role is null;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'filled', v_filled, 'bookers_added', v_people, 'booking_links', v_links,
    'member_links', v_members);
end;
$$;
