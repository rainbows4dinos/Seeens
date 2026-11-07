-- Shared directory, phase 2, step 3b (#185): the directory shows everything.
--
-- The directory lists this band's records and the ones every other band
-- shares, with this band's own status and archive on each. Towns are one
-- per place, so two bands' Portland is one Portland. Members can read the
-- name of a band that shares records, to say who shared one.

create policy "Members can see bands that share records" on public.workspaces
  for select to authenticated
  using (
    exists (select 1 from private.my_workspace_ids())
    and exists (
      select 1 from public.connections c
      where c.workspace_id = workspaces.id and not c.keep_private and c.merged_into is null)
  );

create or replace function public.directory_page(p_workspace_id uuid, p_archived boolean, p_q text default ''::text, p_statuses public.connection_status[] default '{}'::public.connection_status[], p_list_status public.connection_status default null::public.connection_status, p_kind public.connection_kind default null::public.connection_kind, p_group_type public.group_type default null::public.group_type, p_person_role public.person_role default null::public.person_role, p_scene_ids uuid[] DEFAULT NULL::uuid[], p_town uuid DEFAULT NULL::uuid, p_hide_avoid boolean DEFAULT true, p_after jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 48, p_counts boolean DEFAULT true, p_type text DEFAULT NULL::text, p_instrument text DEFAULT NULL::text, p_ages text DEFAULT NULL::text, p_capacity text DEFAULT NULL::text)
returns jsonb
language sql
stable
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
        where c.workspace_id = p_workspace_id and c.is_us limit 1) as us,
      -- A town is a place: every band's locality for it matches (#185).
      (select coalesce(l.place_id::text, l.id::text) from public.localities l where l.id = p_town) as town_key
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
        and (p_town is null or coalesce(loc.place_id::text, loc.id::text) = pr.town_key)
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
    left join public.localities loc on loc.id = c.locality_id
    -- This band's private layer (#181); a record it never touched reads as Known.
    left join public.connection_band_details cd on cd.workspace_id = p_workspace_id and cd.connection_id = c.id
    left join lateral (
      select gd.status, g.name
      from public.affiliations a
      join public.connections g on g.id = a.to_connection_id
      join public.connection_band_details gd on gd.workspace_id = p_workspace_id and gd.connection_id = g.id
      where c.kind = 'person' and coalesce(cd.status, 'neutral') = 'neutral'
        and a.workspace_id = p_workspace_id
        and a.from_connection_id = c.id and a.kind = 'member' and a.is_current
        and gd.archived_at is null and not g.is_us
        -- Only closer than Heard of; a band in Avoid never pulls a person there.
        and gd.status in ('homies', 'lets_play', 'prospect')
      order by array_position(enum_range(null::public.connection_status), gd.status), lower(g.name)
      limit 1
    ) b on true
    -- This band's records, and the ones other bands share (#185). Not our own
    -- page, and nothing for a band you're not in.
    where p_workspace_id in (select private.my_workspace_ids())
      and (c.workspace_id = p_workspace_id or not c.keep_private)
      and not (c.is_us and c.workspace_id = p_workspace_id)
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
            where (a.workspace_id = p_workspace_id or not a.keep_private)
              and not (a.is_us and a.workspace_id = p_workspace_id) and ad.archived_at is not null
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
          join public.affiliations a on a.from_connection_id = h.id and a.kind = 'member' and a.workspace_id = p_workspace_id
          cross join unnest(public.role_instruments(a.role)) i
          where h.kind = 'person'), '[]'::jsonb),
        -- One per place, as this band's locality when it has one.
        'towns', coalesce((
          select jsonb_agg(jsonb_build_object(
              'id', t.id, 'name', t.name, 'region', t.region, 'region_code', t.region_code,
              'country', t.country, 'country_code', t.country_code))
          from (
            select distinct on (coalesce(l.place_id::text, l.id::text)) l.*
            from public.localities l
            where l.id in (select h.locality_id from half h where h.locality_id is not null)
            order by coalesce(l.place_id::text, l.id::text), (l.workspace_id = p_workspace_id) desc, l.id
          ) t), '[]'::jsonb)
      )) end
  );
$$;

-- Saving another band's record reads as not found, not as "changed since it
-- was opened", now that the record is visible.
create or replace function public.save_connection(p_workspace_id uuid, p_name text, p_kind public.connection_kind, p_person_roles public.person_role[], p_status public.connection_status, p_played_together boolean, p_is_us boolean, p_can_help_with text[], p_scene_ids uuid[], p_new_scenes text[], p_links jsonb, p_id uuid DEFAULT NULL::uuid, p_group_type public.group_type DEFAULT NULL::public.group_type, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_place_id integer DEFAULT NULL::integer, p_keep_locality_id uuid DEFAULT NULL::uuid, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_attributes jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $fn$
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
      -- Only a band you're in: another band's shared record is visible now (#185),
      -- but it's not yours to save, so it reads as not found.
      if exists (select 1 from public.connections where id = v_id and workspace_id = p_workspace_id
          and workspace_id in (select private.my_workspace_ids())) then
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
$fn$;
