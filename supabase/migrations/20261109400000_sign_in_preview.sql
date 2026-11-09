-- The sign-in page's preview (#255): shared bands and venues with photos,
-- for people who aren't signed in. Only what other bands already see on a
-- listing's face: name, type, catalog number, town, the adding band's
-- scenes, and the photo. Never people, never anything kept private, and
-- nothing from any band's own layer (status, plans, notes, archive).
-- Keep Private takes a listing off it.

create or replace function public.preview_cards(p_limit integer default 24)
returns table (
  id uuid,
  name text,
  group_type public.group_type,
  catalog_no integer,
  town text,
  scenes text[],
  photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.group_type,
    c.catalog_no,
    case when l.id is null then null
      else concat_ws(', ', l.name, coalesce(l.region_code, l.region, l.country)) end,
    coalesce(
      (select array_agg(s.name order by s.name)
         from public.connection_scenes cs
         join public.scenes s on s.id = cs.scene_id
        where cs.connection_id = c.id and cs.workspace_id = c.workspace_id),
      '{}'
    ),
    c.photo_path
  from public.connections c
  left join public.localities l on l.id = c.locality_id
  where c.kind = 'group'
    and c.group_type in ('band', 'venue')
    and not c.keep_private
    and c.merged_into is null
    and c.photo_path is not null
  order by random()
  limit least(greatest(coalesce(p_limit, 24), 1), 48);
$$;

-- The photo for one preview card, if that listing is still on it.
create or replace function public.preview_photo_path(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.photo_path
  from public.connections c
  where c.id = p_id
    and c.kind = 'group'
    and c.group_type in ('band', 'venue')
    and not c.keep_private
    and c.merged_into is null
    and c.photo_path is not null;
$$;

revoke all on function public.preview_cards(integer) from public;
revoke all on function public.preview_photo_path(uuid) from public;
grant execute on function public.preview_cards(integer) to anon, authenticated;
grant execute on function public.preview_photo_path(uuid) to anon, authenticated;
