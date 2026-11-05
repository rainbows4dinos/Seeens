-- #140: what people play, read from their band roles, and "close to us".
--
-- role_instruments() turns a member role ("Vox / keys") into instruments
-- (vocals, keyboards). The alias list mirrors src/lib/affiliations/
-- instruments.ts; a unit test checks the two match.
--
-- directory_page:
--   p_instrument filters to people who play it in any band role, now or before.
--   A person who's Heard of takes the closest status (Homies, Let's play,
--   Crush) of the bands they're currently in, for grouping and the status
--   filter, and the row says which band ("via"). Any status set on the person
--   wins, and a band in Avoid never pulls a person there.
--   counts.instruments lists the instruments people in this half play.

create function public.role_instruments(p_role text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(distinct a.instrument), '{}')
  from regexp_split_to_table(lower(coalesce(p_role, '')), '\s*(?:/|,|&|\+|;|\mand\M)\s*') as part
  join (values
-- instrument aliases: begin
    ('vocals', 'vocals'),
    ('guitar', 'guitar'),
    ('bass', 'bass'),
    ('drums', 'drums'),
    ('keyboards', 'keyboards'),
    ('piano', 'piano'),
    ('organ', 'organ'),
    ('synth', 'synth'),
    ('electronics', 'electronics'),
    ('turntables', 'turntables'),
    ('percussion', 'percussion'),
    ('saxophone', 'saxophone'),
    ('trumpet', 'trumpet'),
    ('trombone', 'trombone'),
    ('clarinet', 'clarinet'),
    ('flute', 'flute'),
    ('violin', 'violin'),
    ('viola', 'viola'),
    ('cello', 'cello'),
    ('banjo', 'banjo'),
    ('mandolin', 'mandolin'),
    ('ukulele', 'ukulele'),
    ('pedal_steel', 'pedal_steel'),
    ('harmonica', 'harmonica'),
    ('accordion', 'accordion'),
    ('theremin', 'theremin'),
    ('vox', 'vocals'),
    ('vocal', 'vocals'),
    ('voice', 'vocals'),
    ('singer', 'vocals'),
    ('singing', 'vocals'),
    ('lead vocals', 'vocals'),
    ('backing vocals', 'vocals'),
    ('bvs', 'vocals'),
    ('gtr', 'guitar'),
    ('gtrs', 'guitar'),
    ('guitars', 'guitar'),
    ('lead guitar', 'guitar'),
    ('rhythm guitar', 'guitar'),
    ('acoustic guitar', 'guitar'),
    ('bass guitar', 'bass'),
    ('electric bass', 'bass'),
    ('double bass', 'bass'),
    ('upright bass', 'bass'),
    ('drum', 'drums'),
    ('kit', 'drums'),
    ('keys', 'keyboards'),
    ('key', 'keyboards'),
    ('keyboard', 'keyboards'),
    ('synths', 'synth'),
    ('synthesizer', 'synth'),
    ('synthesizers', 'synth'),
    ('electronic', 'electronics'),
    ('programming', 'electronics'),
    ('samples', 'electronics'),
    ('laptop', 'electronics'),
    ('decks', 'turntables'),
    ('perc', 'percussion'),
    ('sax', 'saxophone'),
    ('tenor sax', 'saxophone'),
    ('alto sax', 'saxophone'),
    ('baritone sax', 'saxophone'),
    ('fiddle', 'violin'),
    ('uke', 'ukulele'),
    ('steel guitar', 'pedal_steel'),
    ('lap steel', 'pedal_steel'),
    ('pedal steel', 'pedal_steel')
-- instrument aliases: end
  ) as a(alias, instrument)
    on a.alias = regexp_replace(btrim(regexp_replace(part, '[.\s]+$', '')), '\s+', ' ', 'g')
$$;

grant execute on function public.role_instruments to authenticated;

drop function public.directory_page(
  uuid, boolean, text, public.connection_status[], public.connection_status, public.connection_kind,
  public.group_type, public.person_role, uuid[], uuid, boolean, jsonb, integer, boolean, text);

create function public.directory_page(
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
  p_instrument text default null
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
      array_position(enum_range(null::public.connection_status), coalesce(b.status, c.status)) as rank,
      lower(c.name) as sort_name,
      -- "Close to us" (#140): someone who's Heard of takes the closest status
      -- of the bands they're in now; any status set on the person wins.
      coalesce(b.status, c.status) as status,
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
            and p_instrument = any (public.role_instruments(a.role)))) as passes
    from public.connections c
    cross join params pr
    left join lateral (
      select g.status, g.name
      from public.affiliations a
      join public.connections g on g.id = a.to_connection_id
      where c.kind = 'person' and c.status = 'neutral'
        and a.from_connection_id = c.id and a.kind = 'member' and a.is_current
        and g.archived_at is null and not g.is_us
        -- Only closer than Heard of; a band in Avoid never pulls a person there.
        and g.status in ('homies', 'lets_play', 'prospect')
      order by array_position(enum_range(null::public.connection_status), g.status), lower(g.name)
      limit 1
    ) b on true
    where c.workspace_id = p_workspace_id
      and not c.is_us
      and (c.archived_at is not null) = p_archived
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

revoke all on function public.directory_page from public, anon;
grant execute on function public.directory_page to authenticated;
