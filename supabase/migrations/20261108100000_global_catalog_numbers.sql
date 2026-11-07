-- Shared directory, phase 2, step 2: one catalog series for every band.
--
-- Catalog numbers were counted per band, so once the directory opens two
-- bands could both have BND-0001. Now there's one series. The band that's
-- been on Seeens longest keeps its numbers; every other band's records are
-- renumbered after it, in the order they were added. New records take the
-- next number in the series. Numbers still never change after that and are
-- never reused; the series can skip a number (a cancelled save).

-- The longest-standing band with any records keeps its numbers.
create temp table keep_band as
  select c.workspace_id
  from public.connections c
  join public.workspaces w on w.id = c.workspace_id
  group by c.workspace_id, w.created_at
  order by w.created_at, c.workspace_id
  limit 1;

alter table public.connections drop constraint connections_catalog_no_unique;

-- Numbers are permanent to updates; let this one renumber through.
alter table public.connections disable trigger connections_keep_catalog_no;
alter table public.connections disable trigger connections_set_updated_at;

update public.connections c
set catalog_no = n.no
from (
  select c2.id,
    (select coalesce(max(k.catalog_no), 0) from public.connections k
      where k.workspace_id in (select workspace_id from keep_band))
    + row_number() over (order by c2.created_at, c2.id) as no
  from public.connections c2
  where c2.workspace_id not in (select workspace_id from keep_band)
) n
where n.id = c.id;

alter table public.connections enable trigger connections_keep_catalog_no;
alter table public.connections enable trigger connections_set_updated_at;

alter table public.connections
  add constraint connections_catalog_no_unique unique (catalog_no);

-- Merge notices remember a merged-away record's number; keep them current.
update public.connection_merges m
set merged_summary = (
  select coalesce(jsonb_agg(
    case when c.id is not null then e || jsonb_build_object('catalog_no', c.catalog_no) else e end
    order by n), '[]'::jsonb)
  from jsonb_array_elements(m.merged_summary) with ordinality as x(e, n)
  left join public.connections c on c.id = (e ->> 'id')::uuid
)
where m.workspace_id not in (select workspace_id from keep_band)
  and jsonb_typeof(m.merged_summary) = 'array';

create sequence public.catalog_no_seq as integer minvalue 1;
select setval('public.catalog_no_seq', coalesce((select max(catalog_no) from public.connections), 0) + 1, false);
revoke all on sequence public.catalog_no_seq from public, anon, authenticated;

create or replace function private.assign_catalog_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.catalog_no := nextval('public.catalog_no_seq');
  return new;
end;
$$;

drop table public.workspace_counters;
drop table keep_band;
