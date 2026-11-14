-- Not Active (#335). Run with: npm run db:test.
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

delete from public.connections;

insert into auth.users (id, email) values
  ('e2111111-1111-1111-1111-111111111111', 'quiet-alex@example.com'),
  ('e2222222-2222-2222-2222-222222222222', 'quiet-bea@example.com'),
  ('e2333333-3333-3333-3333-333333333333', 'quiet-mod@example.com');
insert into public.workspaces (id, name) values
  ('e2aaaaaa-0000-0000-0000-0000000000a1', 'Quiet Band A'),
  ('e2aaaaaa-0000-0000-0000-0000000000b2', 'Quiet Band B'),
  ('e2aaaaaa-0000-0000-0000-0000000000c3', 'Quiet Band C');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('e2aaaaaa-0000-0000-0000-0000000000a1', 'e2111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('e2aaaaaa-0000-0000-0000-0000000000b2', 'e2222222-2222-2222-2222-222222222222', 'owner', 'Bea'),
  ('e2aaaaaa-0000-0000-0000-0000000000c3', 'e2333333-3333-3333-3333-333333333333', 'owner', 'Mo');
insert into public.app_moderators (user_id) values ('e2333333-3333-3333-3333-333333333333');

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('e2500000-0000-0000-0000-000000000001', 'e2aaaaaa-0000-0000-0000-0000000000a1', 'Aardvark Example', 'group', '{}', 'band'),
  ('e2500000-0000-0000-0000-000000000002', 'e2aaaaaa-0000-0000-0000-0000000000a1', 'Zebra Example', 'group', '{}', 'band');

set local role authenticated;

-- Its band marks it Not Active.
select set_config('request.jwt.claims', '{"sub":"e2111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.set_not_active('e2500000-0000-0000-0000-000000000001', true), current_date, 'its band marks it Not Active');
select is((select count(*)::int from public.connection_edits), 0, 'its own band''s change isn''t logged as a fix');
select is(public.set_not_active('e2500000-0000-0000-0000-000000000001', true), current_date, 'marking it again keeps the date');

-- Sorted after the active ones with the same status, whatever the name.
select is((select string_agg(c.name, ',' order by (r.ord))
  from jsonb_array_elements(public.directory_page('e2aaaaaa-0000-0000-0000-0000000000a1', false, p_limit => 100) -> 'rows')
    with ordinality as r (row, ord)
  join public.connections c on c.id = (r.row ->> 'id')::uuid),
  'Zebra Example,Aardvark Example', 'Not Active sorts after the active ones');

-- Another band can't.
select set_config('request.jwt.claims', '{"sub":"e2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$select public.set_not_active('e2500000-0000-0000-0000-000000000002', true)$$, '42501', null,
  'another band can''t change it');
select is((select inactive_since from public.connections where id = 'e2500000-0000-0000-0000-000000000001'), current_date,
  'but every band sees it');

-- A moderator can, and it's logged.
select set_config('request.jwt.claims', '{"sub":"e2333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.set_not_active('e2500000-0000-0000-0000-000000000001', false), null, 'a moderator turns it back on');
reset role;
select is((select changes from public.connection_edits where connection_id = 'e2500000-0000-0000-0000-000000000001'),
  '{"not_active": [true, false]}'::jsonb, 'and the change is logged');
select is((select inactive_since from public.connections where id = 'e2500000-0000-0000-0000-000000000001'), null,
  'active again');

select * from finish();
rollback;
