-- Venue types (#262). "Space" was DIY or Licensed; now a venue picks the
-- kinds of room it is (connections.attributes.venue_types, a list), and DIY
-- or licensed follows from them (still stored as attributes.space, so cards
-- and the filter read one value).

-- Old DIY becomes Underground (DIY, not a house). Licensed stays as it is,
-- showing "Licensed" until someone picks a type.
update public.connections
set attributes = attributes || jsonb_build_object('venue_types', jsonb_build_array('underground'))
where group_type = 'venue' and attributes ->> 'space' = 'diy' and not attributes ? 'venue_types';

-- The directory gets a Space filter: DIY, licensed, or one type.
drop function public.directory_page(uuid, boolean, text, public.connection_status[], public.connection_status, public.connection_kind, public.group_type, public.person_role, uuid[], uuid, boolean, jsonb, integer, boolean, text, text, text, text, text, boolean);
create function public.directory_page(p_workspace_id uuid, p_archived boolean, p_q text default ''::text, p_statuses public.connection_status[] default '{}'::public.connection_status[], p_list_status public.connection_status default null::public.connection_status, p_kind public.connection_kind default null::public.connection_kind, p_group_type public.group_type default null::public.group_type, p_person_role public.person_role default null::public.person_role, p_scene_ids uuid[] DEFAULT NULL::uuid[], p_town uuid DEFAULT NULL::uuid, p_hide_avoid boolean DEFAULT true, p_after jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 48, p_counts boolean DEFAULT true, p_type text DEFAULT NULL::text, p_instrument text DEFAULT NULL::text, p_ages text DEFAULT NULL::text, p_capacity text DEFAULT NULL::text, p_scope text default 'all', p_no_status boolean default false, p_space text default null)
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
      -- No status (#192) sorts after the five.
      coalesce(array_position(enum_range(null::public.connection_status), coalesce(b.status, cd.status)), 6) as rank,
      lower(c.name) as sort_name,
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
          else coalesce(c.attributes -> 'venue_types', '[]'::jsonb) ? p_space end) as passes
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
