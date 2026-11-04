-- One page of the directory at a time (#109). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('d9111111-1111-1111-1111-111111111111', 'page-alex@example.com'),
  ('d9333333-3333-3333-3333-333333333333', 'page-cora@example.com');

insert into public.workspaces (id, name) values
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'Paging Band'),
  ('d9bbbbbb-0000-0000-0000-0000000000b2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('d9bbbbbb-0000-0000-0000-0000000000b2', 'd9333333-3333-3333-3333-333333333333', 'member', 'Cora');

insert into public.localities (id, workspace_id, name, region, country) values
  ('d9100000-0000-0000-0000-000000000001', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Portland', 'Oregon', 'United States'),
  ('d9100000-0000-0000-0000-000000000002', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Olympia', 'Washington', 'United States');

insert into public.scenes (id, workspace_id, name) values
  ('d9200000-0000-0000-0000-000000000001', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Basement shows');

-- Us (neutral), three homies with mixed case, a let's play band, an
-- avoid, an archived band, a label, a person who plays in both bands, and a
-- name with a literal percent sign.
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, status, is_us, locality_id, archived_at) values
  ('d9c00000-0000-0000-0000-000000000001', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Merwulf', 'group', '{}', 'band', 'neutral', true, 'd9100000-0000-0000-0000-000000000001', null),
  ('d9c00000-0000-0000-0000-000000000002', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'bees', 'group', '{}', 'band', 'homies', false, 'd9100000-0000-0000-0000-000000000001', null),
  ('d9c00000-0000-0000-0000-000000000003', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Ants', 'group', '{}', 'band', 'homies', false, 'd9100000-0000-0000-0000-000000000002', null),
  ('d9c00000-0000-0000-0000-000000000004', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Cats', 'group', '{}', 'venue', 'homies', false, null, null),
  ('d9c00000-0000-0000-0000-000000000005', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Dogs', 'group', '{}', 'band', 'lets_play', false, null, null),
  ('d9c00000-0000-0000-0000-000000000006', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Eels', 'group', '{}', 'band', 'avoid', false, 'd9100000-0000-0000-0000-000000000001', null),
  ('d9c00000-0000-0000-0000-000000000007', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Old Band', 'group', '{}', 'band', 'homies', false, null, now()),
  ('d9c00000-0000-0000-0000-000000000008', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Grey Static', 'group', '{}', 'label', 'neutral', false, null, null),
  ('d9c00000-0000-0000-0000-000000000009', 'd9aaaaaa-0000-0000-0000-0000000000a1', 'Jo Example', 'person', '{musician,dj}', null, 'neutral', false, null, null),
  ('d9c00000-0000-0000-0000-000000000010', 'd9aaaaaa-0000-0000-0000-0000000000a1', '100% Noise', 'group', '{}', 'band', 'neutral', false, null, null),
  ('d9c00000-0000-0000-0000-0000000000b1', 'd9bbbbbb-0000-0000-0000-0000000000b2', 'Their Band', 'group', '{}', 'band', 'homies', true, null, null);

-- bees and Old Band share our label; Dogs shares a member with us.
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind) values
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000001', 'd9c00000-0000-0000-0000-000000000008', 'on_label'),
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000002', 'd9c00000-0000-0000-0000-000000000008', 'on_label'),
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000007', 'd9c00000-0000-0000-0000-000000000008', 'on_label'),
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000009', 'd9c00000-0000-0000-0000-000000000001', 'member'),
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000009', 'd9c00000-0000-0000-0000-000000000005', 'member');

insert into public.connection_scenes (workspace_id, connection_id, scene_id) values
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000003', 'd9200000-0000-0000-0000-000000000001'),
  ('d9aaaaaa-0000-0000-0000-0000000000a1', 'd9c00000-0000-0000-0000-000000000005', 'd9200000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d9111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Names of a page, in order.
create function pg_temp.names(r jsonb) returns text[] language sql as $$
  select coalesce(array_agg(c.name order by e.n), '{}')
  from jsonb_array_elements(r -> 'rows') with ordinality as e(v, n)
  join public.connections c on c.id = (e.v ->> 'id')::uuid
$$;

create temp table pages (k text primary key, r jsonb) on commit drop;
grant all on pages to authenticated;
insert into pages values
  ('all', public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false)),
  ('p1', public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_limit => 3));
insert into pages values
  ('p2', public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_limit => 3,
    p_after => (select r -> 'next' from pages where k = 'p1'), p_counts => false));
insert into pages values
  ('p3', public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_limit => 3,
    p_after => (select r -> 'next' from pages where k = 'p2'), p_counts => false));

-- Order and paging
select is(pg_temp.names(r), array['Ants', 'bees', 'Cats', 'Dogs', '100% Noise', 'Grey Static', 'Jo Example'],
  'status groups in order, names case-insensitive; Us, Avoid and archived left out')
  from pages where k = 'all';
select is(pg_temp.names(r), array['Ants', 'bees', 'Cats'], 'first page of three') from pages where k = 'p1';
select is(pg_temp.names(r), array['Dogs', '100% Noise', 'Grey Static'], 'second page picks up after the first') from pages where k = 'p2';
select is(pg_temp.names(r), array['Jo Example'], 'last page') from pages where k = 'p3';
select ok((select r -> 'next' from pages where k = 'p1') is not null, 'a full page with more after it has a next cursor');
select ok((select r -> 'next' from pages where k = 'p3') = 'null'::jsonb, 'the last page has no next cursor');
select ok((select r -> 'counts' from pages where k = 'p2') = 'null'::jsonb, 'counts are skipped when not asked for');

-- Counts
select is((select r -> 'counts' from pages where k = 'all') - 'towns' - 'types',
  '{"view": 8, "total": 8, "matched": 7, "hidden_avoid": 1,
    "groups": {"homies": 3, "lets_play": 1, "prospect": 0, "neutral": 3, "avoid": 0}}'::jsonb,
  'view, total, matched, per-group counts, and the hidden Avoid count; Us counted nowhere');
select is((select jsonb_array_length(r -> 'counts' -> 'towns') from pages where k = 'all'), 2, 'towns in this half');

-- Tags
select is(
  (select jsonb_object_agg(c.name, jsonb_build_array(e ->> 'label_mate', e ->> 'shares_member'))
   from pages p, jsonb_array_elements(p.r -> 'rows') e
   join public.connections c on c.id = (e ->> 'id')::uuid
   where p.k = 'all' and c.name in ('bees', 'Dogs', 'Ants')),
  '{"bees": ["true", "false"], "Dogs": ["false", "true"], "Ants": ["false", "false"]}'::jsonb,
  'label mate and shared member tags still come from Us');

-- Filters
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_q => 'E')),
  array['bees', '100% Noise', 'Grey Static', 'Jo Example'], 'name search is a case-insensitive substring');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_q => 'merwulf')),
  '{}'::text[], 'searching for Us finds nothing');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_q => '0%')),
  array['100% Noise'], 'a percent sign in the search is literal');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_q => '_')),
  '{}'::text[], 'an underscore in the search is literal');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_statuses => '{homies,avoid}')),
  array['Ants', 'bees', 'Cats', 'Eels'], 'asked-for statuses, Avoid included');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_statuses => '{neutral}')),
  array['100% Noise', 'Grey Static', 'Jo Example'], 'Us stays out even when its status is asked for');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_kind => 'group', p_group_type => 'venue')),
  array['Cats'], 'group type');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_kind => 'person', p_person_role => 'dj')),
  array['Jo Example'], 'person role');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_scene_ids => '{d9200000-0000-0000-0000-000000000001}')),
  array['Ants', 'Dogs'], 'scene');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_town => 'd9100000-0000-0000-0000-000000000001')),
  array['bees'], 'town');
select is(
  (public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false,
    p_statuses => '{lets_play}', p_list_status => 'lets_play') -> 'counts') ->> 'total',
  '1', 'a list view totals its own status');

-- Type tabs (#122)
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'bands')),
  array['Ants', 'bees', 'Dogs', '100% Noise'], 'Bands tab: bands only, Avoid still hidden');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'people')),
  array['Jo Example'], 'People tab');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues')),
  array['Cats'], 'Venues tab');
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'more')),
  array['Grey Static'], 'Labels & more tab: groups that are not bands or venues');
select is((select r -> 'counts' -> 'types' from pages where k = 'all'),
  '{"bands": 4, "people": 1, "venues": 1, "more": 1, "all": 7}'::jsonb, 'tab counts follow the other filters');
select is(
  (public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'people') -> 'counts') - 'towns' - 'types',
  '{"view": 8, "total": 1, "matched": 1, "hidden_avoid": 0,
    "groups": {"homies": 0, "lets_play": 0, "prospect": 0, "neutral": 1, "avoid": 0}}'::jsonb,
  'a tab counts only its own rows (the empty workspace check still sees everyone)');

-- Archived half
select is(pg_temp.names(public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', true, p_hide_avoid => false)),
  array['Old Band'], 'the archived half');
select is((public.directory_page('d9aaaaaa-0000-0000-0000-0000000000a1', true, p_hide_avoid => false) -> 'rows' -> 0 ->> 'label_mate'),
  'false', 'archived bands are not label mates');

-- Another band's directory stays out of reach.
select is(pg_temp.names(public.directory_page('d9bbbbbb-0000-0000-0000-0000000000b2', false)),
  '{}'::text[], 'no rows from a workspace you are not in');

select * from finish();
rollback;
