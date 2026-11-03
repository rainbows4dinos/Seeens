-- Adding several band members at once (#75). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('b4111111-1111-1111-1111-111111111111', 'lineup-alex@example.com'),
  ('b4333333-3333-3333-3333-333333333333', 'lineup-cora@example.com');

insert into public.workspaces (id, name) values
  ('b4aaaaaa-0000-0000-0000-0000000000a1', 'Lineup Band'),
  ('b4bbbbbb-0000-0000-0000-0000000000b2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('b4aaaaaa-0000-0000-0000-0000000000a1', 'b4111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('b4bbbbbb-0000-0000-0000-0000000000b2', 'b4333333-3333-3333-3333-333333333333', 'member', 'Cora');

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('b4c00000-0000-0000-0000-000000000001', 'b4aaaaaa-0000-0000-0000-0000000000a1', 'The Tin Hollows', 'group', '{}', 'band'),
  ('b4c00000-0000-0000-0000-000000000002', 'b4aaaaaa-0000-0000-0000-0000000000a1', 'Jo Example', 'person', '{musician}', null),
  ('b4c00000-0000-0000-0000-000000000003', 'b4aaaaaa-0000-0000-0000-0000000000a1', 'Static Basement', 'group', '{}', 'venue'),
  ('b4c00000-0000-0000-0000-000000000004', 'b4aaaaaa-0000-0000-0000-0000000000a1', 'Riley Drums', 'person', '{musician}', null),
  ('b4c00000-0000-0000-0000-0000000000b1', 'b4bbbbbb-0000-0000-0000-0000000000b2', 'Their Person', 'person', '{musician}', null);

-- Riley is already a member.
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, role) values
  ('b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000004', 'b4c00000-0000-0000-0000-000000000001', 'member', 'Drums');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b4111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

create temp table result (r jsonb) on commit drop;
grant all on result to authenticated;

select lives_ok(
  $$insert into result select public.add_band_members(
    'b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000001',
    '[{"name": "Jo Example", "roles": "Vocals, Guitar", "former": false, "person_id": "b4c00000-0000-0000-0000-000000000002"},
      {"name": "Ana Test", "roles": "Bass", "former": false, "person_id": null},
      {"name": "Sam Sample", "roles": "", "former": true, "person_id": null},
      {"name": "Riley Drums", "roles": "Drums", "former": false, "person_id": "b4c00000-0000-0000-0000-000000000004"}]'
  )$$,
  'a member can add a lineup'
);

select is(
  (select jsonb_agg(x -> 'added') from result, jsonb_array_elements(r) x),
  '[true, true, true, false]'::jsonb,
  'one result per row; someone already in the band is skipped'
);
select is(
  (select role from public.affiliations
   where from_connection_id = 'b4c00000-0000-0000-0000-000000000002' and to_connection_id = 'b4c00000-0000-0000-0000-000000000001'),
  'Vocals, Guitar',
  'an existing person is linked with their roles'
);
select is(
  (select count(*) from public.connections where name = 'Jo Example'),
  1::bigint,
  'linking an existing person doesn''t add a duplicate'
);
select is(
  (select row(c.kind::text, c.person_roles::text, a.role)::text
   from public.connections c join public.affiliations a on a.from_connection_id = c.id
   where c.name = 'Ana Test'),
  row('person', '{musician}', 'Bass')::text,
  'a new person is added as a musician and linked'
);
select is(
  (select row(a.is_current, a.role)::text
   from public.connections c join public.affiliations a on a.from_connection_id = c.id
   where c.name = 'Sam Sample'),
  row(false, null::text)::text,
  'former members are linked as former; no roles is null'
);
select is(
  (select role from public.affiliations where from_connection_id = 'b4c00000-0000-0000-0000-000000000004'),
  'Drums',
  'an existing membership is left as it was'
);

-- Anything wrong fails the whole batch.
select throws_ok(
  $$select public.add_band_members(
    'b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000001',
    '[{"name": "Never Added", "roles": "", "former": false, "person_id": null},
      {"name": "", "roles": "", "former": false, "person_id": null}]'
  )$$,
  '23514', null,
  'a blank name fails the batch'
);
select is((select count(*) from public.connections where name = 'Never Added'), 0::bigint,
  'a failed batch adds nobody');

select throws_ok(
  $$select public.add_band_members(
    'b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000003',
    '[{"name": "Anyone", "roles": "", "former": false, "person_id": null}]'
  )$$,
  'P0002', null,
  'members can only be added to a band'
);
select throws_ok(
  $$select public.add_band_members(
    'b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000001',
    '[{"name": "Their Person", "roles": "", "former": false, "person_id": "b4c00000-0000-0000-0000-0000000000b1"}]'
  )$$,
  'P0002', null,
  'another band''s person can''t be linked'
);

-- Someone outside the workspace.
select set_config('request.jwt.claims', '{"sub":"b4333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select public.add_band_members(
    'b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000001',
    '[{"name": "Sneaky", "roles": "", "former": false, "person_id": null}]'
  )$$,
  'P0002', null,
  'a non-member can''t add members to the band'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.add_band_members(
    'b4aaaaaa-0000-0000-0000-0000000000a1', 'b4c00000-0000-0000-0000-000000000001', '[]'
  )$$,
  '42501', null,
  'anon can''t call it'
);

select * from finish();
rollback;
