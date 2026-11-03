-- Add several members to a band at once, from a pasted lineup (#75).
--
-- p_rows is a JSON array, one object per person:
--   { "name": "Jo Example", "roles": "Vocals, Guitar", "former": false,
--     "person_id": null }
-- person_id links an existing person in the directory; null adds a new
-- person (kind person, role musician).
--
-- One transaction: every row lands or nothing changes. Someone who is
-- already a member of the band is skipped, not an error. Returns one result
-- per row, in order: { "person_id": uuid, "added": true | false }.
--
-- SECURITY INVOKER, so RLS applies to every read and write.

create function public.add_band_members(
  p_workspace_id uuid,
  p_band_id uuid,
  p_rows jsonb
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
      insert into public.connections (workspace_id, name, kind, person_roles)
      values (p_workspace_id, v_name, 'person', array['musician']::public.person_role[])
      returning id into v_person_id;
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

revoke all on function public.add_band_members from public, anon;
grant execute on function public.add_band_members to authenticated;
