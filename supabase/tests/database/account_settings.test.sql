-- Account settings: display name and leaving a band (#67).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('ac111111-1111-1111-1111-111111111111', 'acct-alex@example.com'),
  ('ac222222-2222-2222-2222-222222222222', 'acct-sam@example.com');
insert into public.workspaces (id, name) values
  ('acaaaaaa-0000-0000-0000-0000000000a1', 'Account Band'),
  ('acaaaaaa-0000-0000-0000-0000000000b2', 'Second Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('acaaaaaa-0000-0000-0000-0000000000a1', 'ac111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('acaaaaaa-0000-0000-0000-0000000000a1', 'ac222222-2222-2222-2222-222222222222', 'member', 'Sam'),
  ('acaaaaaa-0000-0000-0000-0000000000b2', 'ac111111-1111-1111-1111-111111111111', 'member', 'Alex');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('ac500000-0000-0000-0000-000000000001', 'acaaaaaa-0000-0000-0000-0000000000a1', 'Account Venue', 'group', '{}', 'venue');
insert into public.next_actions (id, workspace_id, connection_id, description, assignee_id) values
  ('ac600000-0000-0000-0000-000000000001', 'acaaaaaa-0000-0000-0000-0000000000a1', 'ac500000-0000-0000-0000-000000000001',
   'Call the venue', 'ac222222-2222-2222-2222-222222222222');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ac111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok($$ select public.update_my_display_name('  Alex R.  ') $$, 'change your name');
select is((select array_agg(distinct display_name) from public.workspace_members where user_id = 'ac111111-1111-1111-1111-111111111111'),
  array['Alex R.'], 'in every band, trimmed');
select is((select display_name from public.workspace_members where user_id = 'ac222222-2222-2222-2222-222222222222'), 'Sam', 'nobody else''s');
select throws_ok($$ select public.update_my_display_name('   ') $$, '23514', null, 'a name can''t be blank');

select throws_ok($$ select public.leave_workspace('acaaaaaa-0000-0000-0000-0000000000a1') $$,
  '23514', 'the last owner can''t leave', 'the last owner stays');
select lives_ok($$ select public.leave_workspace('acaaaaaa-0000-0000-0000-0000000000b2') $$, 'a member can leave');
select is((select count(*)::int from public.workspace_members where workspace_id = 'acaaaaaa-0000-0000-0000-0000000000b2'), 0,
  'and that band is gone from their list');
select throws_ok($$ select public.leave_workspace('acaaaaaa-0000-0000-0000-0000000000b2') $$, 'P0002', 'not a member', 'only bands you''re in');

select set_config('request.jwt.claims', '{"sub":"ac222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.leave_workspace('acaaaaaa-0000-0000-0000-0000000000a1') $$, 'Sam leaves');
reset role;
select is((select assignee_id from public.next_actions where id = 'ac600000-0000-0000-0000-000000000001'), null,
  'their plan stays, unassigned');

select * from finish();
rollback;
