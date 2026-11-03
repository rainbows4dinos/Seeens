-- Catalog numbers (#106). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values
  ('ca111111-1111-1111-1111-111111111111', 'catalog-alex@example.com'),
  ('ca222222-2222-2222-2222-222222222222', 'catalog-bea@example.com'),
  ('ca333333-3333-3333-3333-333333333333', 'catalog-cora@example.com');

insert into public.workspaces (id, name) values
  ('caaaaaaa-0000-0000-0000-0000000000a1', 'Catalog Band'),
  ('cabbbbbb-0000-0000-0000-0000000000b2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('caaaaaaa-0000-0000-0000-0000000000a1', 'ca111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('caaaaaaa-0000-0000-0000-0000000000a1', 'ca222222-2222-2222-2222-222222222222', 'member', 'Bea'),
  ('cabbbbbb-0000-0000-0000-0000000000b2', 'ca333333-3333-3333-3333-333333333333', 'member', 'Cora');

-- A plain member adds connections (the counter is not theirs to write).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ca222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('cac00000-0000-0000-0000-000000000001', 'caaaaaaa-0000-0000-0000-0000000000a1', 'First Band', 'group', '{}', 'band'),
  ('cac00000-0000-0000-0000-000000000002', 'caaaaaaa-0000-0000-0000-0000000000a1', 'Second Venue', 'group', '{}', 'venue'),
  ('cac00000-0000-0000-0000-000000000003', 'caaaaaaa-0000-0000-0000-0000000000a1', 'Third Person', 'person', '{dj}', null);

select results_eq(
  $$select catalog_no from public.connections
    where workspace_id = 'caaaaaaa-0000-0000-0000-0000000000a1' order by catalog_no$$,
  array[1, 2, 3],
  'numbers count up in the order connections are added, for a plain member too');

select throws_ok(
  $$select * from public.workspace_counters$$,
  '42501', null, 'members cannot read the counters');

-- An update can't change the number.
update public.connections set catalog_no = 99, name = 'First Band (renamed)'
  where id = 'cac00000-0000-0000-0000-000000000001';
select is((select catalog_no from public.connections where id = 'cac00000-0000-0000-0000-000000000001'), 1,
  'an update keeps the number');
select is((select name from public.connections where id = 'cac00000-0000-0000-0000-000000000001'), 'First Band (renamed)',
  'the rest of the update still applies');

-- Asking for a number on insert is ignored.
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, catalog_no) values
  ('cac00000-0000-0000-0000-000000000004', 'caaaaaaa-0000-0000-0000-0000000000a1', 'Fourth Band', 'group', '{}', 'band', 1);
select is((select catalog_no from public.connections where id = 'cac00000-0000-0000-0000-000000000004'), 4,
  'an insert gets the next number, whatever it asks for');

-- A deleted number is never handed out again.
reset role;
delete from public.connections where id = 'cac00000-0000-0000-0000-000000000004';
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('cac00000-0000-0000-0000-000000000005', 'caaaaaaa-0000-0000-0000-0000000000a1', 'Fifth Band', 'group', '{}', 'band');
set local role authenticated;
select is((select catalog_no from public.connections where id = 'cac00000-0000-0000-0000-000000000005'), 5,
  'numbers are not reused after a delete');

-- Another workspace counts on its own.
select set_config('request.jwt.claims', '{"sub":"ca333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('cac00000-0000-0000-0000-0000000000b1', 'cabbbbbb-0000-0000-0000-0000000000b2', 'Their Band', 'group', '{}', 'band');
select is((select catalog_no from public.connections where id = 'cac00000-0000-0000-0000-0000000000b1'), 1,
  'each workspace has its own count');

-- Search by number (directory_page).
select set_config('request.jwt.claims', '{"sub":"ca111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
create function pg_temp.ids(r jsonb) returns uuid[] language sql as $$
  select coalesce(array_agg((e ->> 'id')::uuid order by n), '{}')
  from jsonb_array_elements(r -> 'rows') with ordinality as x(e, n)
$$;
select is(pg_temp.ids(public.directory_page('caaaaaaa-0000-0000-0000-0000000000a1', false, p_q => 'VEN-0002')),
  array['cac00000-0000-0000-0000-000000000002'::uuid], 'search finds VEN-0002');
select is(pg_temp.ids(public.directory_page('caaaaaaa-0000-0000-0000-0000000000a1', false, p_q => '0003')),
  array['cac00000-0000-0000-0000-000000000003'::uuid], 'search finds 0003 without a prefix');
select is(pg_temp.ids(public.directory_page('caaaaaaa-0000-0000-0000-0000000000a1', false, p_q => 'BND-0002')),
  array['cac00000-0000-0000-0000-000000000002'::uuid], 'an old or wrong prefix still finds the number');
select is(pg_temp.ids(public.directory_page('caaaaaaa-0000-0000-0000-0000000000a1', false, p_q => '0001x')),
  '{}'::uuid[], 'anything that is not a number searches names only');

select * from finish();
rollback;
