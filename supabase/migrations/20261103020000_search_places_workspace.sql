-- Town search favors the current band's countries (#80).
--
-- With no prefer_countries, search_places boosted countries from every
-- workspace the caller belongs to. It now takes the current workspace_id so
-- someone in two bands gets suggestions for the band they're working in.
-- Without workspace_id it behaves as before.

drop function public.search_places(text, integer, text[]);

create function public.search_places(
  q text,
  max_results integer default 8,
  prefer_countries text[] default null,
  workspace_id uuid default null
)
returns setof public.places
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_town text := lower(trim(split_part(q, ',', 1)));
  v_qual text := nullif(lower(trim(split_part(q, ',', 2))), '');
  v_prefer text[] := prefer_countries;
begin
  if length(v_town) < 2 then
    return;
  end if;

  if v_prefer is null then
    -- RLS limits this to workspaces the caller belongs to; workspace_id
    -- narrows it to the band they're working in.
    select coalesce(array_agg(distinct l.country_code), '{}') into v_prefer
    from public.localities l
    where l.country_code is not null
      and (search_places.workspace_id is null or l.workspace_id = search_places.workspace_id);
  end if;

  -- The town prefix goes in as a literal so the planner can use the indexes.
  return query execute format($sql$
    select p.*
    from public.places p
    where (lower(p.ascii_name) like %1$L or lower(p.name) like %1$L)
      and (
        $1 is null
        or lower(p.region_code) = $1
        or lower(p.region_name) like $2
        or lower(p.country_code) = $1
        or lower(p.country_name) like $2
      )
    order by (lower(p.ascii_name) = $3 or lower(p.name) = $3) desc,
             p.population::bigint * (case when p.country_code = any ($4) then 20 else 1 end) desc
    limit least(greatest($5, 1), 20)
  $sql$, private.like_prefix(v_town))
  using v_qual, private.like_prefix(v_qual), v_town, v_prefer, max_results;
end;
$$;

revoke all on function public.search_places from public, anon;
grant execute on function public.search_places to authenticated;
