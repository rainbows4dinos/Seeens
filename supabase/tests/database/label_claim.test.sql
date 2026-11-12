-- Labels claim their listing (#298): an admin invites a label's owner like
-- a band's, and the workspace says it's a label.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('7c111111-1111-1111-1111-111111111111', 'lc-admin@example.com'),
  ('7c222222-2222-2222-2222-222222222222', 'lc-owner@example.com');
insert into public.workspaces (id, name) values ('7caaaaaa-0000-0000-0000-0000000000a1', 'Home Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('7caaaaaa-0000-0000-0000-0000000000a1', '7c111111-1111-1111-1111-111111111111', 'owner', 'Ada');
insert into public.app_admins (user_id) values ('7c111111-1111-1111-1111-111111111111');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, created_by) values
  ('7ccccccc-0000-0000-0000-000000000001', '7caaaaaa-0000-0000-0000-0000000000a1', 'Home Band', 'group', 'band', '{}', true, null),
  ('7ccccccc-0000-0000-0000-000000000002', '7caaaaaa-0000-0000-0000-0000000000a1', 'Spare Records', 'group', 'label', '{}', false, null),
  ('7ccccccc-0000-0000-0000-000000000003', '7caaaaaa-0000-0000-0000-0000000000a1', 'Some Room', 'group', 'venue', '{}', false, null);
update public.workspaces set listing_id = '7ccccccc-0000-0000-0000-000000000001' where id = '7caaaaaa-0000-0000-0000-0000000000a1';

select is((select kind from public.workspaces where id = '7caaaaaa-0000-0000-0000-0000000000a1'), 'band',
  'workspaces are bands by default');

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select group_type from public.invitable_bands() where name = 'Spare Records'), 'label',
  'labels can be invited, and say so');
select is((select count(*)::int from public.invitable_bands() where name = 'Some Room'), 0,
  'venues cannot');
select throws_ok($$ select * from public.invite_band('7ccccccc-0000-0000-0000-000000000003', null, null, null) $$,
  '23514', 'not a band listing', 'inviting a venue fails');

-- The admin invites Spare Records.
insert into t select 'ws', workspace_id from public.invite_band('7ccccccc-0000-0000-0000-000000000002', null, 'lc-owner@example.com', null);
reset role;
select is((select kind from public.workspaces where id = (select v::uuid from t where k = 'ws')), 'label',
  'a label listing makes a label workspace');
select is((select listing_id from public.workspaces where id = (select v::uuid from t where k = 'ws')),
  '7ccccccc-0000-0000-0000-000000000002'::uuid, 'which claims the listing');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select kind from public.list_bands() where name = 'Spare Records'), 'label', 'the admin list says label');
select is((select count(*)::int from public.invitable_bands() where name = 'Spare Records'), 0,
  'a claimed label drops off the list');

-- A label that isn't listed yet gets a label listing.
insert into t select 'new', workspace_id from public.invite_band(null, 'Fresh Tapes', null, null, null, 'label');
reset role;
select is((select kind from public.workspaces where id = (select v::uuid from t where k = 'new')), 'label',
  'a new label makes a label workspace');
select is((select c.group_type::text from public.connections c join public.workspaces w on w.listing_id = c.id
  where w.id = (select v::uuid from t where k = 'new')), 'label', 'and a label listing');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_band(null, 'spare records', null, null, null, 'label') $$,
  '23505', 'already listed', 'a listed label has to be picked');
select throws_ok($$ select * from public.invite_band(null, 'Odd One', null, null, null, 'venue') $$,
  '23514', 'not a band or label', 'only bands and labels');

-- The roster: bands on the label from anyone's records, once each.
reset role;
insert into auth.users (id, email) values ('7c333333-3333-3333-3333-333333333333', 'lc-other@example.com');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ((select v::uuid from t where k = 'ws'), '7c222222-2222-2222-2222-222222222222', 'owner', 'Tam');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, keep_private, created_by) values
  ('7ccccccc-0000-0000-0000-000000000004', '7caaaaaa-0000-0000-0000-0000000000a1', 'Old Act', 'group', 'band', '{}', false, false, null),
  ('7ccccccc-0000-0000-0000-000000000005', '7caaaaaa-0000-0000-0000-0000000000a1', 'Secret Act', 'group', 'band', '{}', false, true, null);
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current) values
  ('7caaaaaa-0000-0000-0000-0000000000a1', '7ccccccc-0000-0000-0000-000000000001', '7ccccccc-0000-0000-0000-000000000002', 'on_label', true),
  ('7caaaaaa-0000-0000-0000-0000000000a1', '7ccccccc-0000-0000-0000-000000000004', '7ccccccc-0000-0000-0000-000000000002', 'on_label', false),
  ('7caaaaaa-0000-0000-0000-0000000000a1', '7ccccccc-0000-0000-0000-000000000005', '7ccccccc-0000-0000-0000-000000000002', 'on_label', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7c222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
create temp table r on commit drop as select * from public.label_roster((select v::uuid from t where k = 'ws'));
select is((select count(*)::int from r), 2, 'the roster has the shared bands on the label');
select is((select joined from r where connection_id = '7ccccccc-0000-0000-0000-000000000001'), true,
  'a band on Seeens says so');
select is((select is_current from r where connection_id = '7ccccccc-0000-0000-0000-000000000004'), false,
  'a past band says so');
select set_config('request.jwt.claims', '{"sub":"7c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.label_roster((select v::uuid from t where k = 'ws'))), 0,
  'only the label sees its roster here');
select set_config('request.jwt.claims', '{"sub":"7c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.label_roster('7caaaaaa-0000-0000-0000-0000000000a1')), 0,
  'a band has no roster');

select * from finish();
rollback;
