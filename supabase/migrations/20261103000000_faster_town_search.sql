-- Town search uses its prefix indexes (#78).
--
-- The old search_places built its LIKE pattern inside the query, so Postgres
-- couldn't use places_ascii_prefix_idx or places_name_prefix_idx and scanned
-- all ~135,000 places on every keystroke (about 130 ms). Passing the pattern
-- as a literal lets both indexes work (1 to 3 ms).
--
-- Also:
--   * % and _ in the search are matched literally, not as wildcards.
--   * When prefer_countries isn't given, it defaults to the countries the
--     caller's workspace already has towns in, so the app no longer loads
--     every locality on each keystroke to work that out.
--
-- Search as you type: "portland", "portland, or", "vancouver, bc",
-- "berlin, germany". Prefix match on the town name; an optional qualifier
-- after a comma matches state, province, or country. Exact names first, then
-- biggest, with a 20x boost for preferred countries: Walla Walla beats
-- Wallasey, but Berlin, Germany still beats Berlin, New Hampshire.

-- "a_b%" -> 'a\_b\%%': match the text literally, then anything after it.
create function private.like_prefix(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

revoke all on function private.like_prefix from public;
grant execute on function private.like_prefix to authenticated;

drop function public.search_places(text, integer, text[]);

create function public.search_places(
  q text,
  max_results integer default 8,
  prefer_countries text[] default null
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
    -- RLS limits this to the caller's own workspace.
    select coalesce(array_agg(distinct country_code), '{}') into v_prefer
    from public.localities
    where country_code is not null;
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
