-- #124: adding a member can carry the band's town, scenes, and "played
-- together" over to the new person. The app only offers the band's own values,
-- and each can be unticked before saving;
-- the new person keeps their own copy (nothing is stored as inherited).
-- Both functions keep their old arguments and add three optional ones.

drop function public.create_linked_connection(
  uuid, uuid, boolean, text, public.connection_kind, public.person_role[],
  public.affiliation_kind, boolean, public.group_type, text);
drop function public.add_band_members(uuid, uuid, jsonb);

create function public.create_linked_connection(
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

  insert into public.connections (workspace_id, name, kind, person_roles, group_type, locality_id, played_together)
  values (p_workspace_id, p_name, p_kind, coalesce(p_person_roles, '{}'), p_group_type,
          p_locality_id, coalesce(p_played_together, false))
  returning id into v_new_id;

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

create function public.add_band_members(
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
      insert into public.connections (workspace_id, name, kind, person_roles, locality_id, played_together)
      values (p_workspace_id, v_name, 'person', array['musician']::public.person_role[],
              p_locality_id, coalesce(p_played_together, false))
      returning id into v_person_id;

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

revoke all on function public.create_linked_connection from public, anon;
revoke all on function public.add_band_members from public, anon;
grant execute on function public.create_linked_connection to authenticated;
grant execute on function public.add_band_members to authenticated;
