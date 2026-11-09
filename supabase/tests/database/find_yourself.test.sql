-- Find yourself anywhere (#68).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('7a111111-1111-1111-1111-111111111111', 'fy-lee@example.com'),
  ('7a222222-2222-2222-2222-222222222222', 'fy-owner@example.com'),
  ('7a333333-3333-3333-3333-333333333333', 'fy-other@example.com');
insert into public.workspaces (id, name) values
  ('7aaaaaaa-0000-0000-0000-0000000000a1', 'First Band'),
  ('7aaaaaaa-0000-0000-0000-0000000000b2', 'Second Band');
-- Lee plays in both. First Band added Lee's person; Second Band never did.
insert into public.workspace_members (workspace_id, user_id, role, display_name, created_at) values
  ('7aaaaaaa-0000-0000-0000-0000000000a1', '7a222222-2222-2222-2222-222222222222', 'owner', 'Owner', now() - interval '2 days'),
  ('7aaaaaaa-0000-0000-0000-0000000000a1', '7a111111-1111-1111-1111-111111111111', 'member', 'Lee', now() - interval '1 day'),
  ('7aaaaaaa-0000-0000-0000-0000000000b2', '7a111111-1111-1111-1111-111111111111', 'owner', 'Lee', now()),
  ('7aaaaaaa-0000-0000-0000-0000000000b2', '7a333333-3333-3333-3333-333333333333', 'member', 'Other', now());
insert into public.connections (id, workspace_id, name, kind, person_roles, keep_private, created_by) values
  ('7acccccc-0000-0000-0000-000000000001', '7aaaaaaa-0000-0000-0000-0000000000a1', 'Lee Example', 'person', '{musician}', false, null),
  ('7acccccc-0000-0000-0000-000000000002', '7aaaaaaa-0000-0000-0000-0000000000a1', 'Kept Quiet', 'person', '{musician}', true, null);

-- People start private; First Band shared Lee's.
update public.connections set keep_private = (name = 'Kept Quiet') where id::text like '7acccccc-%';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- From Second Band, Lee can find the person First Band added.
select is((select added_by from public.findable_people('7aaaaaaa-0000-0000-0000-0000000000b2') where name = 'Lee Example'),
  'First Band', 'another band''s person is findable, with who added them');
select is((select count(*)::int from public.findable_people('7aaaaaaa-0000-0000-0000-0000000000b2') where name = 'Kept Quiet'), 1,
  'private people from a band you''re in are findable too');
select lives_ok($$ select public.link_me_to_person('7aaaaaaa-0000-0000-0000-0000000000b2', '7acccccc-0000-0000-0000-000000000001') $$,
  'Lee links to it from Second Band');
select is((select count(*)::int from public.workspace_members
  where user_id = '7a111111-1111-1111-1111-111111111111' and connection_id = '7acccccc-0000-0000-0000-000000000001'), 2,
  'and it fills in First Band too: one person everywhere');
reset role;
select is((select workspace_id::text from public.connections where id = '7acccccc-0000-0000-0000-000000000001'),
  '7aaaaaaa-0000-0000-0000-0000000000a1', 'the person stays with the band that added it');
set local role authenticated;

-- Someone else can't take it.
select set_config('request.jwt.claims', '{"sub":"7a333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.findable_people('7aaaaaaa-0000-0000-0000-0000000000b2') where name = 'Lee Example'), 0,
  'a linked person isn''t findable for anyone else');
select throws_ok($$ select public.link_me_to_person('7aaaaaaa-0000-0000-0000-0000000000b2', '7acccccc-0000-0000-0000-000000000001') $$,
  '23505', 'someone else', 'or linkable');
select is((select count(*)::int from public.findable_people('7aaaaaaa-0000-0000-0000-0000000000b2') where name = 'Kept Quiet'), 0,
  'but not to someone outside that band');

-- Lee fixes their own details from Second Band, logged as Lee.
select set_config('request.jwt.claims', '{"sub":"7a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.moderate_connection('7acccccc-0000-0000-0000-000000000001', 'Lee Example', 'person', '{musician,booker}',
  null, '{}', '[]') $$, 'Lee fixes their own details');
select throws_ok($$ select public.moderate_connection('7acccccc-0000-0000-0000-000000000001', 'Lee Example', 'group', '{}',
  'band', '{}', '[]') $$, '23514', 'you stay a person', 'and stays a person');
-- Even kept private by the band that added them.
reset role;
select set_config('request.jwt.claims', '', true);
update public.connections set keep_private = true where id = '7acccccc-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.moderate_connection('7acccccc-0000-0000-0000-000000000001', 'Lee Example', 'person', '{musician}',
  null, '{}', '[]') $$, 'kept private, still yours to fix');
reset role;
select set_config('request.jwt.claims', '', true);
update public.connections set keep_private = false where id = '7acccccc-0000-0000-0000-000000000001';
select is((select distinct by_band from public.connection_edits where connection_id = '7acccccc-0000-0000-0000-000000000001'), 'Lee',
  'the fix is logged as theirs');

-- First Band's owner can't keep it private now.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select (public.set_keep_private(array['7acccccc-0000-0000-0000-000000000001'::uuid], true) ->> 'refused')::int), 1,
  'linked from another band, it stays shared');

select * from finish();
rollback;
