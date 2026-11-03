-- Warn instead of overwriting when a bandmate saved first (#82).
--
-- The edit form sends the updated_at it was opened with. If the connection
-- has been saved since (an edit, a status tap, archiving), save_connection
-- changes nothing and raises PT409, which the API returns as HTTP 409 with
-- code "PT409", so the app can tell the member and keep what they typed.
-- (Not 40001: clients treat serialization failures as retryable.) Leaving p_expected_updated_at
-- out skips the check, as before.

drop function public.save_connection(
  uuid, text, public.connection_kind, public.person_role[], public.connection_status,
  boolean, boolean, text[], uuid[], text[], jsonb, uuid, public.group_type, text, text,
  text, integer, uuid
);

create function public.save_connection(
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
  p_expected_updated_at timestamptz default null  -- edit only: the version the form was opened on
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
      (workspace_id, name, kind, person_roles, group_type, status, played_together,
       is_us, can_help_with, locality_id, email, phone, notes)
    values
      (p_workspace_id, p_name, p_kind, coalesce(p_person_roles, '{}'), p_group_type, p_status,
       p_played_together, p_is_us, coalesce(p_can_help_with, '{}'), v_locality_id,
       p_email, p_phone, p_notes)
    returning id into v_id;
  else
    update public.connections set
      name = p_name,
      kind = p_kind,
      person_roles = coalesce(p_person_roles, '{}'),
      group_type = p_group_type,
      status = p_status,
      played_together = p_played_together,
      is_us = p_is_us,
      can_help_with = coalesce(p_can_help_with, '{}'),
      locality_id = v_locality_id,
      email = p_email,
      phone = p_phone,
      notes = p_notes
    where id = v_id
      and workspace_id = p_workspace_id
      and (p_expected_updated_at is null or updated_at = p_expected_updated_at);

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

revoke all on function public.save_connection from public, anon;
grant execute on function public.save_connection to authenticated;
