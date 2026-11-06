-- Deleting an account: a band keeps an owner, your email doesn't linger on
-- invites, and what you added stays with the band.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('de111111-1111-1111-1111-111111111111', 'del-alex@example.com'),
  ('de222222-2222-2222-2222-222222222222', 'del-sam@example.com');
insert into public.workspaces (id, name) values
  ('deaaaaaa-0000-0000-0000-0000000000a1', 'Delete Band'),
  ('deaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('deaaaaaa-0000-0000-0000-0000000000a1', 'de111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('deaaaaaa-0000-0000-0000-0000000000a1', 'de222222-2222-2222-2222-222222222222', 'member', 'Sam'),
  ('deaaaaaa-0000-0000-0000-0000000000b2', 'de111111-1111-1111-1111-111111111111', 'member', 'Alex'),
  ('deaaaaaa-0000-0000-0000-0000000000b2', 'de222222-2222-2222-2222-222222222222', 'owner', 'Sam');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('de500000-0000-0000-0000-000000000001', 'deaaaaaa-0000-0000-0000-0000000000a1', 'Delete Venue', 'group', '{}', 'venue');
insert into public.outreach_entries (workspace_id, connection_id, summary, author_id) values
  ('deaaaaaa-0000-0000-0000-0000000000a1', 'de500000-0000-0000-0000-000000000001', 'Emailed the booker',
   'de111111-1111-1111-1111-111111111111');
insert into public.invites (workspace_id, email, token_hash, invited_by_name, accepted_at, accepted_by) values
  ('deaaaaaa-0000-0000-0000-0000000000b2', 'del-alex@example.com', 'del-hash-1', 'Sam', now(),
   'de111111-1111-1111-1111-111111111111');

set local role anon;
select throws_ok($$ select public.prepare_account_deletion() $$, '42501', null, 'not for anon');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"de111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(public.prepare_account_deletion(), array['Delete Band'], 'the only owner of a band is stopped');
reset role;
select is((select email from public.invites where token_hash = 'del-hash-1'), 'del-alex@example.com',
  'and nothing changes');

update public.workspace_members set role = 'owner'
where workspace_id = 'deaaaaaa-0000-0000-0000-0000000000a1' and user_id = 'de222222-2222-2222-2222-222222222222';

set local role authenticated;
select is(public.prepare_account_deletion(), '{}'::text[], 'with another owner, nothing in the way');
reset role;
select is((select email from public.invites where token_hash = 'del-hash-1'), null, 'your email is off invites you accepted');

-- What the admin API does next.
delete from auth.users where id = 'de111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.workspace_members where user_id = 'de111111-1111-1111-1111-111111111111'), 0,
  'memberships go with the account');
select is((select count(*)::int from public.connections where id = 'de500000-0000-0000-0000-000000000001'), 1,
  'the band keeps its connections');
select is((select summary from public.outreach_entries where connection_id = 'de500000-0000-0000-0000-000000000001'),
  'Emailed the booker', 'and its outreach');
select is((select author_id from public.outreach_entries where connection_id = 'de500000-0000-0000-0000-000000000001'),
  null, 'shown as a former member');
select is((select count(*)::int from public.workspace_members where user_id = 'de222222-2222-2222-2222-222222222222'), 2,
  'bandmates stay');

select * from finish();
rollback;
