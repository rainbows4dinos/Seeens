-- Town search (#78). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('7a111111-1111-1111-1111-111111111111', 'search-alex@example.com'),
  ('7a444444-4444-4444-4444-444444444444', 'search-dana@example.com');

insert into public.workspaces (id, name) values ('7aaaaaaa-0000-0000-0000-0000000000a1', 'Search Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('7aaaaaaa-0000-0000-0000-0000000000a1', '7a111111-1111-1111-1111-111111111111', 'owner', 'Alex');

-- The band already has a US town.
insert into public.localities (workspace_id, place_id, name, region_code, country, country_code)
select '7aaaaaaa-0000-0000-0000-0000000000a1', id, name, region_code, country_name, country_code
from public.places where name = 'Portland' and region_code = 'OR';

-- ---------------------------------------------------------------------------
-- Signed up, no membership (dana): no preferred countries
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7a444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select is(
  (select name from public.search_places('walla') limit 1),
  'Wallasey',
  'without preferred countries, the biggest town wins'
);
select is(
  (select count(*) from public.search_places('p_r', 20)),
  0::bigint,
  'an underscore is matched literally, not as a wildcard'
);
select is(
  (select count(*) from public.search_places('port%', 20)),
  0::bigint,
  'a percent sign is matched literally, not as a wildcard'
);
select is(
  (select count(*) from public.search_places('portland, %', 20)),
  0::bigint,
  'wildcards in the qualifier are matched literally too'
);
select is(
  (select count(*) from public.search_places('p')),
  0::bigint,
  'one letter returns nothing'
);
select is(
  (select count(*) from public.search_places('san', 50)),
  20::bigint,
  'results are capped at 20'
);

-- ---------------------------------------------------------------------------
-- Member (alex): the workspace's countries are preferred by default
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"7a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select name || ', ' || region_code from public.search_places('walla') limit 1),
  'Walla Walla, WA',
  'by default, countries the band already has towns in are preferred'
);
select is(
  (select name from public.search_places('walla', 8, '{}') limit 1),
  'Wallasey',
  'an explicit empty preference turns the boost off'
);
select is(
  (select country_code from public.search_places('berlin') limit 1),
  'DE',
  'a much bigger town abroad still wins over a preferred country'
);

select * from finish();
rollback;
