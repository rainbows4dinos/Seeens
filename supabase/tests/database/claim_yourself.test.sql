-- Claim yourself: the owner's person on a band invite, and Find Yourself
-- listing the claimed band's members, even private ones.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('6c111111-1111-1111-1111-111111111111', 'cy-admin@example.com'),
  ('6c222222-2222-2222-2222-222222222222', 'cy-tif@example.com'),
  ('6c333333-3333-3333-3333-333333333333', 'cy-mate@example.com'),
  ('6c444444-4444-4444-4444-444444444444', 'cy-member@example.com');
insert into public.workspaces (id, name) values ('6caaaaaa-0000-0000-0000-0000000000a1', 'Home Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('6caaaaaa-0000-0000-0000-0000000000a1', '6c111111-1111-1111-1111-111111111111', 'owner', 'Ada'),
  ('6caaaaaa-0000-0000-0000-0000000000a1', '6c444444-4444-4444-4444-444444444444', 'member', 'Mo');
insert into public.app_admins (user_id) values ('6c111111-1111-1111-1111-111111111111');
-- Home Band added a band it knows and three people, all private (people
-- start private): Tif and Pat play in Fit Band, Quinn doesn't.
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, created_by) values
  ('6ccccccc-0000-0000-0000-000000000001', '6caaaaaa-0000-0000-0000-0000000000a1', 'Home Band', 'group', 'band', '{}', true, null),
  ('6ccccccc-0000-0000-0000-000000000002', '6caaaaaa-0000-0000-0000-0000000000a1', 'Fit Band', 'group', 'band', '{}', false, null),
  ('6ccccccc-0000-0000-0000-000000000003', '6caaaaaa-0000-0000-0000-0000000000a1', 'Tif Example', 'person', null, '{musician}', false, null),
  ('6ccccccc-0000-0000-0000-000000000004', '6caaaaaa-0000-0000-0000-0000000000a1', 'Pat Example', 'person', null, '{musician}', false, null),
  ('6ccccccc-0000-0000-0000-000000000005', '6caaaaaa-0000-0000-0000-0000000000a1', 'Quinn Example', 'person', null, '{booker}', false, null);
update public.workspaces set listing_id = '6ccccccc-0000-0000-0000-000000000001' where id = '6caaaaaa-0000-0000-0000-0000000000a1';
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind) values
  ('6caaaaaa-0000-0000-0000-0000000000a1', '6ccccccc-0000-0000-0000-000000000003', '6ccccccc-0000-0000-0000-000000000002', 'member'),
  ('6caaaaaa-0000-0000-0000-0000000000a1', '6ccccccc-0000-0000-0000-000000000004', '6ccccccc-0000-0000-0000-000000000002', 'member');
select is((select count(*)::int from public.connections where id::text like '6ccccccc-%' and kind = 'person' and keep_private), 3,
  'the people start private');

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;
set local role authenticated;

-- Only admins see who could be invited.
select set_config('request.jwt.claims', '{"sub":"6c444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.invitable_people()), 0, 'members see no invitable people');

-- The admin invites Fit Band, with Tif as its owner.
select set_config('request.jwt.claims', '{"sub":"6c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select keep_private from public.invitable_people() where name = 'Tif Example'), true,
  'admins can pick private people');
select throws_ok($$ select * from public.invite_band('6ccccccc-0000-0000-0000-000000000002', null, null, null,
  '6ccccccc-0000-0000-0000-000000000002') $$, '23514', 'not a person', 'the owner''s profile is a person');
insert into t select 'inv', token from public.invite_band('6ccccccc-0000-0000-0000-000000000002', null, 'cy-tif@example.com', null,
  '6ccccccc-0000-0000-0000-000000000003');
reset role;
select is((select name from public.invites where email = 'cy-tif@example.com'), 'Tif Example',
  'the invite takes the person''s name');
set local role authenticated;

-- Tif joins, and is linked to her person.
select set_config('request.jwt.claims', '{"sub":"6c222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.accept_invite((select v from t where k = 'inv'), 'Tif') $$, 'Tif accepts');
reset role;
select is((select connection_id::text from public.workspace_members where user_id = '6c222222-2222-2222-2222-222222222222'),
  '6ccccccc-0000-0000-0000-000000000003', 'her account is linked to her person');
select is((select keep_private from public.connections where id = '6ccccccc-0000-0000-0000-000000000003'), false,
  'which is shared now');
select is((select workspace_id::text from public.connections where id = '6ccccccc-0000-0000-0000-000000000003'),
  '6caaaaaa-0000-0000-0000-0000000000a1', 'and stays with the band that added it');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.invitable_people() where name = 'Tif Example'), 0,
  'a linked person drops out of the picker');
select throws_ok($$ select * from public.invite_band(null, 'Second Try', null, null, '6ccccccc-0000-0000-0000-000000000003') $$,
  '23505', 'someone else', 'and can''t be named on another invite');

-- Tif invites Pat, who finds himself though Home Band kept him private.
select set_config('request.jwt.claims', '{"sub":"6c222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
reset role;
insert into public.workspace_members (workspace_id, user_id, role, display_name)
select w.id, '6c333333-3333-3333-3333-333333333333', 'member', 'Pat' from public.workspaces w where w.name = 'Fit Band';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into t select 'fit', id from public.workspaces where name = 'Fit Band';
select is((select in_band from public.findable_people((select v::uuid from t where k = 'fit')) where name = 'Pat Example'), true,
  'a private member of your band is findable, marked as in the band');
select is((select count(*)::int from public.findable_people((select v::uuid from t where k = 'fit')) where name = 'Quinn Example'), 0,
  'other private people aren''t');
select throws_ok($$ select public.link_me_to_person((select v::uuid from t where k = 'fit'), '6ccccccc-0000-0000-0000-000000000005') $$,
  '23514', 'not a person here', 'or linkable');
select lives_ok($$ select public.link_me_to_person((select v::uuid from t where k = 'fit'), '6ccccccc-0000-0000-0000-000000000004') $$,
  'Pat links himself');
reset role;
select is((select keep_private from public.connections where id = '6ccccccc-0000-0000-0000-000000000004'), false,
  'and is shared now');
select is((select keep_private from public.connections where id = '6ccccccc-0000-0000-0000-000000000005'), true,
  'Quinn stays private');

select * from finish();
rollback;
