-- Arrange Home (#313): each person's own Home layout, per band.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('9c111111-1111-1111-1111-111111111111', 'hl-a@example.com'),
  ('9c222222-2222-2222-2222-222222222222', 'hl-b@example.com'),
  ('9c333333-3333-3333-3333-333333333333', 'hl-out@example.com');
insert into public.workspaces (id, name) values ('9caaaaaa-0000-0000-0000-0000000000a1', 'Layout Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('9caaaaaa-0000-0000-0000-0000000000a1', '9c111111-1111-1111-1111-111111111111', 'owner', 'A'),
  ('9caaaaaa-0000-0000-0000-0000000000a1', '9c222222-2222-2222-2222-222222222222', 'member', 'B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.home_layout('9caaaaaa-0000-0000-0000-0000000000a1')), 0, 'nothing saved yet');
select public.set_home_layout('9caaaaaa-0000-0000-0000-0000000000a1', '{homies,up_next}', '{might_know}');
select is((select shown from public.home_layout('9caaaaaa-0000-0000-0000-0000000000a1')), '{homies,up_next}'::text[], 'saved in order');

select set_config('request.jwt.claims', '{"sub":"9c222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.home_layout('9caaaaaa-0000-0000-0000-0000000000a1')), 0, 'a bandmate keeps their own');

select set_config('request.jwt.claims', '{"sub":"9c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.set_home_layout('9caaaaaa-0000-0000-0000-0000000000a1', '{homies}', '{}') $$,
  '42501', 'not a member', 'only members');

select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.set_home_layout('9caaaaaa-0000-0000-0000-0000000000a1', null, null);
select is((select count(*)::int from public.home_layout('9caaaaaa-0000-0000-0000-0000000000a1')), 0, 'null resets to the default');
select throws_ok($$ select * from public.home_layouts $$, '42501', null, 'the table itself is closed');

select * from finish();
rollback;
