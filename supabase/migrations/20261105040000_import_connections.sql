-- #148: spreadsheet import. One call adds every row, or nothing changes.
--
-- p_rows is a JSON array the import page builds after the member reviews
-- it. Each row is either new (added through save_connection, so towns,
-- scenes, links, and venue details land exactly as a form save would) or
-- has match_id, for a connection already in the directory: then only its
-- blanks are filled. Nothing already there is overwritten; sheet notes are
-- added under the existing ones, and new links and scenes are added.
--
-- A venue row's booked_by names become "books" links (#48): an existing
-- person or promoter with that name, or a new one (a promoter/collective
-- when the name says "Presents", "Collective", and so on; otherwise a
-- person who books).
create function public.import_connections(p_workspace_id uuid, p_rows jsonb)
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
        email = coalesce(c.email, nullif(r ->> 'email', '')),
        phone = coalesce(c.phone, nullif(r ->> 'phone', '')),
        locality_id = coalesce(c.locality_id, v_locality),
        played_together = c.played_together or coalesce((r ->> 'played_together')::boolean, false),
        notes = case
          when nullif(r ->> 'notes', '') is null then c.notes
          when coalesce(c.notes, '') = '' then r ->> 'notes'
          when position(r ->> 'notes' in c.notes) > 0 then c.notes
          else c.notes || E'\n\n' || (r ->> 'notes') end,
        -- Details it already has win; new ones are stamped today.
        attributes = case
          when (v_venue - array(select jsonb_object_keys(c.attributes))) = '{}'::jsonb then c.attributes
          else v_venue || c.attributes || jsonb_build_object('checked_on', current_date) end
      where c.id = v_id and c.workspace_id = p_workspace_id;
      if not found then
        raise exception 'connection not found' using errcode = 'no_data_found';
      end if;

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
        where c.workspace_id = p_workspace_id and c.archived_at is null and not c.is_us
          and lower(c.name) = lower(v_name)
          and (c.kind = 'person' or c.group_type = 'promoter_collective')
        order by c.created_at, c.id limit 1;
        if v_booker is null then
          if v_name ~* '\m(presents|collective|productions|promotions|booking|bookings|records)\M' then
            insert into public.connections (workspace_id, name, kind, group_type, status)
            values (p_workspace_id, v_name, 'group', 'promoter_collective', 'neutral')
            returning id into v_booker;
          else
            insert into public.connections (workspace_id, name, kind, person_roles, status)
            values (p_workspace_id, v_name, 'person', '{booker}', 'neutral')
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

revoke all on function public.import_connections from public, anon;
grant execute on function public.import_connections to authenticated;
