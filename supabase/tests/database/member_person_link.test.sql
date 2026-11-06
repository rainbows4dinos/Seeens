-- Linking member accounts to their person (#44): only you link yourself,
-- one person per account and per person, and the link goes with the
-- membership. Run with: npm run db:test. Fixture data is fictional.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values
  ('ab111111-1111-1111-1111-111111111111', 'link-alex@example.com'),
  ('ab222222-2222-2222-2222-222222222222', 'link-sam@example.com'),
  ('ab444444-4444-4444-4444-444444444444', 'link-outsider@example.com');
insert into public.workspaces (id, name) values ('abaaaaaa-0000-0000-0000-0000000000a1', 'Link Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('abaaaaaa-0000-0000-0000-0000000000a1', 'ab111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('abaaaaaa-0000-0000-0000-0000000000a1', 'ab222222-2222-2222-2222-222222222222', 'member', 'Sam');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, is_us) values
  ('ab500000-0000-0000-0000-000000000001', 'abaaaaaa-0000-0000-0000-0000000000a1', 'Link Band', 'group', '{}', 'band', true),
  ('ab500000-0000-0000-0000-000000000002', 'abaaaaaa-0000-0000-0000-0000000000a1', 'Alex Example', 'person', '{musician}', null, false),
  ('ab500000-0000-0000-0000-000000000003', 'abaaaaaa-0000-0000-0000-0000000000a1', 'Alex E.', 'person', '{musician}', null, false),
  ('ab500000-0000-0000-0000-000000000004', 'abaaaaaa-0000-0000-0000-0000000000a1', 'The Venue', 'group', '{}', 'venue', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ab111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok($$ select public.link_me_to_person('abaaaaaa-0000-0000-0000-0000000000a1', 'ab500000-0000-0000-0000-000000000002') $$,
  'a member claims their person');
select is((select connection_id from public.workspace_members where user_id = 'ab111111-1111-1111-1111-111111111111'),
  'ab500000-0000-0000-0000-000000000002'::uuid, 'and it''s linked');
select throws_ok($$ select public.link_me_to_person('abaaaaaa-0000-0000-0000-0000000000a1', 'ab500000-0000-0000-0000-000000000004') $$,
  '23514', 'not a person here', 'only a person, not a group');
select throws_ok($$ update public.workspace_members set connection_id = 'ab500000-0000-0000-0000-000000000003'
  where user_id = 'ab222222-2222-2222-2222-222222222222' $$, '42501', null, 'no setting anyone''s link directly');
select throws_ok($$ select public.create_my_person('abaaaaaa-0000-0000-0000-0000000000a1') $$,
  '23505', 'already linked', 'one person per account');

-- Sam can't take Alex's person, and can't link Alex to anything.
select set_config('request.jwt.claims', '{"sub":"ab222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select public.link_me_to_person('abaaaaaa-0000-0000-0000-0000000000a1', 'ab500000-0000-0000-0000-000000000002') $$,
  '23505', 'someone else', 'one account per person');
select lives_ok($$ select public.unlink_me('abaaaaaa-0000-0000-0000-0000000000a1') $$, 'unlinking only touches you');
select is((select connection_id from public.workspace_members where user_id = 'ab111111-1111-1111-1111-111111111111'),
  'ab500000-0000-0000-0000-000000000002'::uuid, 'so Alex is still linked');

-- Sam makes a page instead: a person, in the band, linked.
select isnt(public.create_my_person('abaaaaaa-0000-0000-0000-0000000000a1'), null, 'make your page');
select is((select c.name from public.connections c join public.workspace_members m on m.connection_id = c.id
  where m.user_id = 'ab222222-2222-2222-2222-222222222222'), 'Sam', 'named as you are in the band');
select is((select count(*)::int from public.affiliations a join public.workspace_members m on m.connection_id = a.from_connection_id
  where m.user_id = 'ab222222-2222-2222-2222-222222222222' and a.to_connection_id = 'ab500000-0000-0000-0000-000000000001' and a.kind = 'member'),
  1, 'and a member of the band');

-- An outsider can't link into the band.
select set_config('request.jwt.claims', '{"sub":"ab444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$ select public.link_me_to_person('abaaaaaa-0000-0000-0000-0000000000a1', 'ab500000-0000-0000-0000-000000000003') $$,
  '42501', 'not a member', 'a non-member can''t link');
select throws_ok($$ select public.create_my_person('abaaaaaa-0000-0000-0000-0000000000a1') $$,
  '42501', 'not a member', 'or make a page');

reset role;

-- Merging Alex's person into another moves the link along.
update public.connections set merged_into = 'ab500000-0000-0000-0000-000000000003', merged_at = now()
where id = 'ab500000-0000-0000-0000-000000000002';
select is((select connection_id from public.workspace_members where user_id = 'ab111111-1111-1111-1111-111111111111'),
  'ab500000-0000-0000-0000-000000000003'::uuid, 'a merge moves the link to the one kept');

-- Unlinking yourself.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ab111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.unlink_me('abaaaaaa-0000-0000-0000-0000000000a1') $$, 'unlink yourself');
select is((select connection_id from public.workspace_members where user_id = 'ab111111-1111-1111-1111-111111111111'),
  null, 'and it''s gone');
reset role;

-- Removing a member drops the link; the person stays.
delete from public.workspace_members where user_id = 'ab222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.connections where name = 'Sam' and workspace_id = 'abaaaaaa-0000-0000-0000-0000000000a1'),
  1, 'their person stays');
select is((select count(*)::int from public.affiliations where to_connection_id = 'ab500000-0000-0000-0000-000000000001'),
  1, 'with their band link');

-- Deleting a linked person (a purge) clears the link.
update public.workspace_members set connection_id = 'ab500000-0000-0000-0000-000000000003'
where user_id = 'ab111111-1111-1111-1111-111111111111';
delete from public.connections where id = 'ab500000-0000-0000-0000-000000000003';
select is((select connection_id from public.workspace_members where user_id = 'ab111111-1111-1111-1111-111111111111'),
  null, 'a deleted person unlinks');

select * from finish();
rollback;
