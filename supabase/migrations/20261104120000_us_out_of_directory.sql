-- #123: our own band leaves the directory. The connection marked "This is us"
-- is no longer a row, a group, or a count in directory_page; the header's band
-- chip opens its page instead. It still powers the label mate and shared
-- member tags, and stays in pickers, search for affiliations, and CSV export.
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
  p_counts boolean default true
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
      array_position(enum_range(null::public.connection_status), c.status) as rank,
      lower(c.name) as sort_name,
      c.status,
      c.locality_id,
      -- Every filter except status.
      (pr.pattern is null or c.name ilike pr.pattern or c.catalog_no = pr.catalog_no)
        and (p_kind is null or c.kind = p_kind)
        and (p_group_type is null or c.group_type = p_group_type)
        and (p_person_role is null or p_person_role = any (c.person_roles))
        and (p_scene_ids is null or exists (
          select 1 from public.connection_scenes cs
          where cs.connection_id = c.id and cs.scene_id = any (p_scene_ids)))
        and (p_town is null or c.locality_id = p_town) as passes
    from public.connections c, params pr
    where c.workspace_id = p_workspace_id
      and not c.is_us
      and (c.archived_at is not null) = p_archived
  ),
  matched as (
    -- Status: the asked-for statuses, or everyone but Avoid.
    select h.* from half h
    where h.passes and (
      case when cardinality(p_statuses) > 0 then h.status = any (p_statuses)
      else not (p_hide_avoid and h.status = 'avoid') end)
  ),
  -- One row past the page, to know whether there's a next one.
  page as (
    select m.id, m.rank, m.sort_name, row_number() over (order by m.rank, m.sort_name, m.id) as n
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
        'total', (select count(*) from half h where p_list_status is null or h.status = p_list_status),
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
            select count(*) from half h where h.passes and h.status = 'avoid')
          else 0 end,
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
