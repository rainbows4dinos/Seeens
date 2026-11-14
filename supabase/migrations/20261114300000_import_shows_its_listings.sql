-- After an import, See Them in the Directory shows just that import's
-- listings (#321): the ones it added and the ones it filled in.
--
-- Each import keeps the list of its records. Only the band that ran it can
-- read it back, through the functions below; nothing else reads the table.
-- import_connections is 20261114100000_import_member_roles.sql plus that
-- record, and directory_page is 20261114200000_directory_missing_filter.sql
-- plus p_import.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  connection_ids uuid[] not null check (cardinality(connection_ids) <= 1000)
);
create index imports_workspace_idx on public.imports (workspace_id, created_at desc);
alter table public.imports enable row level security;
-- No policies: only the functions below read or write it.

create function private.record_import(p_workspace_id uuid, p_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if private.my_role(p_workspace_id) is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  insert into public.imports (workspace_id, connection_ids)
  values (p_workspace_id, coalesce(p_ids, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;

-- An import's records, for the band that ran it; empty for anyone else.
create function private.import_ids(p_import uuid, p_workspace_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select i.connection_ids from public.imports i
    where i.id = p_import and i.workspace_id = p_workspace_id
      and private.my_role(p_workspace_id) is not null
  ), '{}')
$$;

revoke all on function private.record_import from public;
revoke all on function private.import_ids from public;
grant execute on function private.record_import to authenticated;
grant execute on function private.import_ids to authenticated;

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
  v_ids uuid[] := '{}';
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

    v_ids := v_ids || v_id;

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
    'member_links', v_members, 'import_id', private.record_import(p_workspace_id, v_ids));
end;
$$;

drop function public.directory_page(uuid, boolean, text, public.connection_status[], public.connection_status,
  public.connection_kind, public.group_type, public.person_role, uuid[], uuid, boolean, jsonb, integer, boolean,
  text, text, text, text, text, boolean, text, text);

create function public.directory_page(p_workspace_id uuid, p_archived boolean, p_q text default ''::text, p_statuses public.connection_status[] default '{}'::public.connection_status[], p_list_status public.connection_status default null::public.connection_status, p_kind public.connection_kind default null::public.connection_kind, p_group_type public.group_type default null::public.group_type, p_person_role public.person_role default null::public.person_role, p_scene_ids uuid[] DEFAULT NULL::uuid[], p_town uuid DEFAULT NULL::uuid, p_hide_avoid boolean DEFAULT true, p_after jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 48, p_counts boolean DEFAULT true, p_type text DEFAULT NULL::text, p_instrument text DEFAULT NULL::text, p_ages text DEFAULT NULL::text, p_capacity text DEFAULT NULL::text, p_scope text default 'all', p_no_status boolean default false, p_space text default null, p_missing text default null, p_import uuid default null)
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
      -- No status (#192) sorts after the first four, and Avoid comes last
      -- (#273): the Directory shows everyone, and few scroll that far.
      case coalesce(b.status, cd.status)
        when 'avoid' then 7
        else coalesce(array_position(enum_range(null::public.connection_status), coalesce(b.status, cd.status)), 6)
      end as rank,
      public.name_sort_key(c.name) as sort_name,
      -- "Close to us" (#140): someone who's Heard of, or has no status, takes
      -- the closest status of the bands they're in now; any other status set
      -- on the person wins. A record this band never gave a status has none.
      coalesce(b.status, cd.status) as status,
      b.name as via,
      c.kind,
      -- My network (#192): what this band added, or has touched since: a
      -- status, notes, contacts, played together, an archive, a plan, outreach.
      (c.workspace_id = p_workspace_id
        or (cd.connection_id is not null and (cd.status is not null or cd.played_together or cd.notes is not null
          or cd.email is not null or cd.phone is not null or cd.archived_at is not null))
        or exists (select 1 from public.next_actions n where n.workspace_id = p_workspace_id and n.connection_id = c.id)
        or exists (select 1 from public.outreach_entries o where o.workspace_id = p_workspace_id and o.connection_id = c.id)
      ) as in_network,
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
        and (p_capacity is null or c.attributes ->> 'capacity' = p_capacity)
        -- Space (#262): DIY or licensed, or one venue type.
        and (p_space is null or case
          when p_space in ('diy', 'licensed') then c.attributes ->> 'space' = p_space
          else coalesce(c.attributes -> 'venue_types', '[]'::jsonb) ? p_space end)
        -- Missing (#321): what a listing doesn't have yet. The app only sends
        -- it for moderators and admins.
        and (p_missing is null or private.listing_missing(c.id, p_workspace_id, p_missing))
        -- One import's listings (#321), from its done screen.
        and (p_import is null or c.id = any (private.import_ids(p_import, p_workspace_id))) as passes
    from public.connections c
    cross join params pr
    left join public.localities loc on loc.id = c.locality_id
    -- This band's private layer (#181); a record it never touched has none.
    left join public.connection_band_details cd on cd.workspace_id = p_workspace_id and cd.connection_id = c.id
    left join lateral (
      select gd.status, g.name
      from public.affiliations a
      join public.connections g on g.id = a.to_connection_id
      join public.connection_band_details gd on gd.workspace_id = p_workspace_id and gd.connection_id = g.id
      where c.kind = 'person' and (cd.status is null or cd.status = 'neutral')
        and a.workspace_id = p_workspace_id
        and a.from_connection_id = c.id and a.kind = 'member' and a.is_current
        and gd.archived_at is null and not g.is_us
        -- Only closer than Heard of; a band in Avoid never pulls a person there.
        and gd.status in ('homies', 'lets_play', 'prospect')
      order by array_position(enum_range(null::public.connection_status), gd.status), public.name_sort_key(g.name)
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
  rated as (
    select h.*,
      case
        -- Only the ones with no status (#192).
        when p_no_status then h.status is null
        when cardinality(p_statuses) > 0 then coalesce(h.status = any (p_statuses), false)
        -- Everyone but Avoid; no status shows too.
        else h.status is null or not (p_hide_avoid and h.status = 'avoid')
      end as status_ok
    from half h
  ),
  -- My network or all scenes (#192).
  shown as (
    select r.* from rated r
    where r.passes and r.status_ok and (p_scope = 'all' or r.in_network)
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
            and (p_scope = 'all' or h.in_network)
            and (p_type is null or p_type = 'all' or h.tab = p_type)),
        'matched', (select count(*) from matched),
        'groups', (
          select jsonb_build_object(
            'homies', count(*) filter (where m.status = 'homies'),
            'lets_play', count(*) filter (where m.status = 'lets_play'),
            'prospect', count(*) filter (where m.status = 'prospect'),
            'neutral', count(*) filter (where m.status = 'neutral'),
            'avoid', count(*) filter (where m.status = 'avoid'),
            'none', count(*) filter (where m.status is null))
          from matched m),
        -- My network and all scenes, under every other filter.
        'scopes', (
          select jsonb_build_object(
            'network', count(*) filter (where r.in_network),
            'all', count(*))
          from rated r
          where r.passes and r.status_ok and (p_type is null or p_type = 'all' or r.tab = p_type)),
        'hidden_avoid', case when cardinality(p_statuses) = 0 and not p_no_status and p_hide_avoid then (
            select count(*) from half h where h.passes and h.status = 'avoid'
              and (p_scope = 'all' or h.in_network)
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
revoke all on function public.directory_page from public, anon;
grant execute on function public.directory_page to authenticated;
