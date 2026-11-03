-- Catalog numbers for connections (#106).
--
-- Every connection gets a number in the order it was added, counted per
-- workspace: the 42nd connection added to a directory is 42. The app shows
-- it with a prefix worked out from the current type or first role, like
-- BND-0042 or MUS-0012 (lib/connections/card.ts), so only the number is
-- stored. A number never changes and is never reused, even after a delete.
--
-- Numbers come from a counter row per workspace, taken under a row lock, so
-- two people adding at the same moment can't get the same one.

create table public.workspace_counters (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  next_catalog_no integer not null default 1 check (next_catalog_no > 0)
);

-- Only the trigger below touches the counters.
alter table public.workspace_counters enable row level security;
revoke all on public.workspace_counters from public, anon, authenticated;

alter table public.connections add column catalog_no integer;

-- Existing connections, numbered in the order they were added.
update public.connections c
set catalog_no = n.no
from (
  select id, row_number() over (partition by workspace_id order by created_at, id) as no
  from public.connections
) n
where n.id = c.id;

insert into public.workspace_counters (workspace_id, next_catalog_no)
select w.id, coalesce(max(c.catalog_no), 0) + 1
from public.workspaces w
left join public.connections c on c.workspace_id = w.id
group by w.id;

-- Gives each new connection the next number. SECURITY DEFINER because
-- members can't write the counters; it only ever reads and bumps the row for
-- the connection's own workspace, which RLS has already let them insert into.
create function private.assign_catalog_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_counters (workspace_id, next_catalog_no)
  values (new.workspace_id, 2)
  on conflict (workspace_id)
    do update set next_catalog_no = public.workspace_counters.next_catalog_no + 1
  returning next_catalog_no - 1 into new.catalog_no;
  return new;
end;
$$;

revoke all on function private.assign_catalog_no() from public;

create trigger connections_assign_catalog_no
  before insert on public.connections
  for each row execute function private.assign_catalog_no();

-- The number is permanent: an update can't change it.
create function private.keep_catalog_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.catalog_no := old.catalog_no;
  return new;
end;
$$;

create trigger connections_keep_catalog_no
  before update of catalog_no on public.connections
  for each row execute function private.keep_catalog_no();

alter table public.connections
  alter column catalog_no set not null,
  add constraint connections_catalog_no_unique unique (workspace_id, catalog_no);

-- Directory search also finds a connection by its catalog number: "VEN-0007",
-- "0007", or "7". The prefix is ignored, so an old prefix (after a type
-- change) still finds it.
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
      case when c.is_us then 0
        else array_position(enum_range(null::public.connection_status), c.status) end as rank,
      lower(c.name) as sort_name,
      c.status,
      c.is_us,
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
      and (c.archived_at is not null) = p_archived
  ),
  matched as (
    -- Status: the asked-for statuses, or everyone but Avoid (Us always shows).
    select h.* from half h
    where h.passes and (
      case when cardinality(p_statuses) > 0 then h.status = any (p_statuses)
      else not (p_hide_avoid and h.status = 'avoid' and not h.is_us) end)
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
          'label_mate', pr.us is not null and p.id <> pr.us and not p_archived and exists (
            select 1
            from public.affiliations mine
            join public.affiliations ours on ours.to_connection_id = mine.to_connection_id
            where mine.from_connection_id = p.id and mine.kind = 'on_label'
              and ours.from_connection_id = pr.us and ours.kind = 'on_label'),
          'shares_member', pr.us is not null and p.id <> pr.us and exists (
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
            'us', count(*) filter (where m.is_us),
            'homies', count(*) filter (where not m.is_us and m.status = 'homies'),
            'lets_play', count(*) filter (where not m.is_us and m.status = 'lets_play'),
            'prospect', count(*) filter (where not m.is_us and m.status = 'prospect'),
            'neutral', count(*) filter (where not m.is_us and m.status = 'neutral'),
            'avoid', count(*) filter (where not m.is_us and m.status = 'avoid'))
          from matched m),
        'hidden_avoid', case when cardinality(p_statuses) = 0 and p_hide_avoid then (
            select count(*) from half h where h.passes and h.status = 'avoid' and not h.is_us)
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
