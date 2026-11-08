-- Roles (#195): moderators fix shared records, logged; admins make them;
-- Keep Private follows who may decide. Run with: npm run db:test.
-- Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

-- Only this file's records: other data (the local seed) would show as shared.
delete from public.connections;

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'roles-owner@example.com'),
  ('d2222222-2222-2222-2222-222222222222', 'roles-member@example.com'),
  ('d3333333-3333-3333-3333-333333333333', 'roles-mod@example.com'),
  ('d4444444-4444-4444-4444-444444444444', 'roles-admin@example.com'),
  ('d5555555-5555-5555-5555-555555555555', 'roles-linked@example.com');
insert into public.workspaces (id, name) values
  ('d0aaaaaa-0000-0000-0000-0000000000a1', 'Roles Band A'),
  ('d0aaaaaa-0000-0000-0000-0000000000b2', 'Roles Band B');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('d0aaaaaa-0000-0000-0000-0000000000a1', 'd1111111-1111-1111-1111-111111111111', 'owner', 'Owen'),
  ('d0aaaaaa-0000-0000-0000-0000000000a1', 'd2222222-2222-2222-2222-222222222222', 'member', 'Mel'),
  ('d0aaaaaa-0000-0000-0000-0000000000a1', 'd5555555-5555-5555-5555-555555555555', 'member', 'Lin'),
  ('d0aaaaaa-0000-0000-0000-0000000000b2', 'd3333333-3333-3333-3333-333333333333', 'owner', 'Mo');
insert into public.app_admins (user_id) values ('d4444444-4444-4444-4444-444444444444');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('d0500000-0000-0000-0000-000000000001', 'd0aaaaaa-0000-0000-0000-0000000000a1', 'Roles Venue', 'group', '{}', 'venue'),
  ('d0500000-0000-0000-0000-000000000002', 'd0aaaaaa-0000-0000-0000-0000000000a1', 'Pat Person', 'person', '{booker}', null),
  ('d0500000-0000-0000-0000-000000000003', 'd0aaaaaa-0000-0000-0000-0000000000a1', 'Lin Linked', 'person', '{musician}', null);
update public.workspace_members set connection_id = 'd0500000-0000-0000-0000-000000000003'
  where user_id = 'd5555555-5555-5555-5555-555555555555';
insert into public.connection_links (workspace_id, connection_id, url, position) values
  ('d0aaaaaa-0000-0000-0000-0000000000a1', 'd0500000-0000-0000-0000-000000000001', 'https://example.com/old', 0);
update public.connection_band_details set notes = 'A''s note'
  where connection_id = 'd0500000-0000-0000-0000-000000000001';

set local role authenticated;

-- Admins make moderators.
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select ok(not public.is_moderator(), 'nobody is a moderator to start with');
select throws_ok($$ select public.grant_moderator('roles-mod@example.com') $$, '42501', null, 'only an admin makes moderators');
select is((select count(*)::int from public.list_moderators()), 0, 'or see who they are');
select is((select count(*)::int from public.list_accounts()), 0, 'or who''s on Seeens');
select throws_ok($$ select public.grant_moderator_user('d3333333-3333-3333-3333-333333333333') $$, '42501', null, 'or pick themselves');
select set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select ok(public.is_moderator(), 'an admin is a moderator too');
select is(public.grant_moderator(' ROLES-MOD@example.com '), 'd3333333-3333-3333-3333-333333333333'::uuid, 'an admin makes one by email');
select throws_ok($$ select public.grant_moderator('nobody@example.com') $$, 'P0002', null, 'not without an account');
select is((select string_agg(email || ':' || admin, ',') from public.list_moderators() where email like 'roles-%'),
  'roles-admin@example.com:true,roles-mod@example.com:false', 'admins list moderators, admins first');
select throws_ok($$ select * from public.app_moderators $$, '42501', null, 'the table itself is closed');
select is((select string_agg(display_name || ':' || bands || ':' || moderator, ',') from public.list_accounts() where email like 'roles-%' and bands is not null),
  'Lin:Roles Band A:false,Mel:Roles Band A:false,Mo:Roles Band B:true,Owen:Roles Band A:false', 'admins see everyone, with their bands, by name');
select lives_ok($$ select public.grant_moderator_user('d2222222-2222-2222-2222-222222222222') $$, 'and pick a moderator by account');
select lives_ok($$ select public.revoke_moderator('d2222222-2222-2222-2222-222222222222') $$, '(undone)');

-- A moderator fixes another band's record, logged.
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select ok(public.is_moderator(), 'and they are one');
update public.connections set name = 'Direct' where id = 'd0500000-0000-0000-0000-000000000001';
select lives_ok($$ select public.moderate_connection('d0500000-0000-0000-0000-000000000001', 'Roles Venue Hall', 'group', '{}',
  'venue', '{sound}', '[{"url":"https://example.com/new","label":"Site"}]'::jsonb) $$, 'a moderator saves another band''s record');
select is((select name || '|' || array_to_string(can_help_with, ',') from public.connections where id = 'd0500000-0000-0000-0000-000000000001'),
  'Roles Venue Hall|sound', 'its details change (a direct update still does nothing)');
select is((select string_agg(url, ',') from public.connection_links where connection_id = 'd0500000-0000-0000-0000-000000000001'),
  'https://example.com/new', 'and its links');
select is((select string_agg(k, ',' order by k) from public.connection_edits e, jsonb_object_keys(e.changes) k
  where e.connection_id = 'd0500000-0000-0000-0000-000000000001'), 'can_help_with,links,name', 'what changed is logged');
select is((select edited_by from public.connection_edits where connection_id = 'd0500000-0000-0000-0000-000000000001'),
  'd3333333-3333-3333-3333-333333333333'::uuid, 'with who');
select lives_ok($$ select public.moderate_connection('d0500000-0000-0000-0000-000000000001', 'Roles Venue Hall', 'group', '{}',
  'venue', '{sound}', '[{"url":"https://example.com/new","label":"Site"}]'::jsonb) $$, 'saving it unchanged');
select is((select count(*)::int from public.connection_edits where connection_id = 'd0500000-0000-0000-0000-000000000001'),
  1, 'logs nothing');
select throws_ok($$ select public.moderate_connection('d0500000-0000-0000-0000-000000000001', 'X', 'group', '{}', 'venue', '{}', '[]'::jsonb,
  p_expected_updated_at => '2000-01-01') $$, 'PT409', null, 'a stale save is refused');

-- Members can't moderate, or read the edits of a band they're not in.
select set_config('request.jwt.claims', '{"sub":"d2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.connection_edits), 1, 'the record''s band reads its edits');
select is((select notes from public.connection_band_details where connection_id = 'd0500000-0000-0000-0000-000000000001'),
  'A''s note', 'and its private layer is untouched');

-- Keep Private: a member can't hide a venue; the owner can.
select is(public.set_keep_private(array['d0500000-0000-0000-0000-000000000001'::uuid], true),
  '{"changed": 0, "refused": 1}'::jsonb, 'a member can''t keep a venue private');
select throws_ok($$ update public.connections set keep_private = true where id = 'd0500000-0000-0000-0000-000000000001' $$,
  '42501', null, 'not even directly');
select is(public.set_keep_private(array['d0500000-0000-0000-0000-000000000002'::uuid], false),
  '{"changed": 1, "refused": 0}'::jsonb, 'but can share a person the band added');
select is(public.set_keep_private(array['d0500000-0000-0000-0000-000000000003'::uuid], false),
  '{"changed": 0, "refused": 1}'::jsonb, 'not a person who''s linked their account');

select set_config('request.jwt.claims', '{"sub":"d5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is(public.set_keep_private(array['d0500000-0000-0000-0000-000000000003'::uuid], false),
  '{"changed": 1, "refused": 0}'::jsonb, 'that''s their own call');

select set_config('request.jwt.claims', '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.set_keep_private(array['d0500000-0000-0000-0000-000000000001'::uuid], true),
  '{"changed": 1, "refused": 0}'::jsonb, 'an owner keeps a venue private');

-- A moderator can't edit it while it's private; can share it again.
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.moderate_connection('d0500000-0000-0000-0000-000000000001', 'X', 'group', '{}', 'venue', '{}', '[]'::jsonb) $$,
  'P0002', null, 'a private record is the band''s alone');
select is(public.set_keep_private(array['d0500000-0000-0000-0000-000000000001'::uuid], false),
  '{"changed": 0, "refused": 1}'::jsonb, 'and out of a moderator''s sight');

-- A record stays with its band.
reset role;
select throws_ok($$ update public.connections set workspace_id = 'd0aaaaaa-0000-0000-0000-0000000000b2'
  where id = 'd0500000-0000-0000-0000-000000000002' $$, '42501', null, 'a record can''t move to another band');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ select public.revoke_moderator('d3333333-3333-3333-3333-333333333333') $$, 'an admin removes a moderator');
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.moderate_connection('d0500000-0000-0000-0000-000000000002', 'X', 'person', '{booker}', null, '{}', '[]'::jsonb) $$,
  '42501', null, 'who can''t moderate any more');

select * from finish();
rollback;
