-- Invite a bandmate who's already in the directory (#225).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('6d111111-1111-1111-1111-111111111111', 'ib-owner@example.com'),
  ('6d222222-2222-2222-2222-222222222222', 'ib-mate@example.com'),
  ('6d333333-3333-3333-3333-333333333333', 'ib-other@example.com');
insert into public.workspaces (id, name) values
  ('6daaaaaa-0000-0000-0000-0000000000a1', 'Our Band'),
  ('6daaaaaa-0000-0000-0000-0000000000a2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('6daaaaaa-0000-0000-0000-0000000000a1', '6d111111-1111-1111-1111-111111111111', 'owner', 'Oona'),
  ('6daaaaaa-0000-0000-0000-0000000000a2', '6d333333-3333-3333-3333-333333333333', 'owner', 'Otto');
-- Other Band added Our Band's listing and its drummer (kept private); Our
-- Band claimed the listing. Our Band added Mae. Other Band's stranger is
-- private and nothing to do with Our Band.
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, created_by) values
  ('6dcccccc-0000-0000-0000-000000000001', '6daaaaaa-0000-0000-0000-0000000000a2', 'Our Band', 'group', 'band', '{}', false, null),
  ('6dcccccc-0000-0000-0000-000000000002', '6daaaaaa-0000-0000-0000-0000000000a1', 'Mae Example', 'person', null, '{musician}', false, null),
  ('6dcccccc-0000-0000-0000-000000000003', '6daaaaaa-0000-0000-0000-0000000000a2', 'Dru Example', 'person', null, '{musician}', false, null),
  ('6dcccccc-0000-0000-0000-000000000004', '6daaaaaa-0000-0000-0000-0000000000a2', 'Stranger Example', 'person', null, '{booker}', false, null);
update public.workspaces set listing_id = '6dcccccc-0000-0000-0000-000000000001' where id = '6daaaaaa-0000-0000-0000-0000000000a1';
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind) values
  ('6daaaaaa-0000-0000-0000-0000000000a2', '6dcccccc-0000-0000-0000-000000000003', '6dcccccc-0000-0000-0000-000000000001', 'member');
insert into public.connection_band_details (workspace_id, connection_id, email) values
  ('6daaaaaa-0000-0000-0000-0000000000a1', '6dcccccc-0000-0000-0000-000000000002', 'ib-mate@example.com')
on conflict (workspace_id, connection_id) do update set email = excluded.email;

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select array_agg(name) from public.invitable_bandmates('6daaaaaa-0000-0000-0000-0000000000a1')),
  array['Dru Example', 'Mae Example'], 'the band''s members first, then its own people; not other private people');
select is(
  (select email from public.invitable_bandmates('6daaaaaa-0000-0000-0000-0000000000a1') where name = 'Mae Example'),
  'ib-mate@example.com', 'with the email the band saved');
select is(
  (select in_band from public.invitable_bandmates('6daaaaaa-0000-0000-0000-0000000000a1') where name = 'Dru Example'),
  true, 'marked as in the band');
select throws_ok($$ select * from public.create_invite('6daaaaaa-0000-0000-0000-0000000000a1', null, null, 'member',
  '6dcccccc-0000-0000-0000-000000000004') $$, '23514', 'not a person here', 'another band''s private person can''t be named');

-- Invite Mae by her person; the invite takes her name.
insert into t select 'mae', token from public.create_invite('6daaaaaa-0000-0000-0000-0000000000a1', 'ib-mate@example.com', null, 'member',
  '6dcccccc-0000-0000-0000-000000000002');
reset role;
select is((select name from public.invites where email = 'ib-mate@example.com'), 'Mae Example', 'the invite takes her name');
select is((select connection_id::text from public.invites where email = 'ib-mate@example.com'),
  '6dcccccc-0000-0000-0000-000000000002', 'and names her person');
set local role authenticated;

-- Inviting her again keeps the person on the open invite.
select set_config('request.jwt.claims', '{"sub":"6d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into t select 'mae2', token from public.create_invite('6daaaaaa-0000-0000-0000-0000000000a1', 'ib-mate@example.com', null, 'member');
reset role;
select is((select count(*)::int from public.invites where email = 'ib-mate@example.com' and connection_id is not null), 1,
  'sending it again keeps her person');
set local role authenticated;

-- She joins and is linked.
select set_config('request.jwt.claims', '{"sub":"6d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.accept_invite((select v from t where k = 'mae2'), 'Mae') $$, 'Mae accepts');
reset role;
select is((select connection_id::text from public.workspace_members where user_id = '6d222222-2222-2222-2222-222222222222'),
  '6dcccccc-0000-0000-0000-000000000002', 'her account is linked to her person');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.invitable_bandmates('6daaaaaa-0000-0000-0000-0000000000a1') where name = 'Mae Example'), 0,
  'a linked person drops out of the list');
select throws_ok($$ select * from public.create_invite('6daaaaaa-0000-0000-0000-0000000000a1', null, null, 'member',
  '6dcccccc-0000-0000-0000-000000000002') $$, '23505', 'someone else', 'and can''t be named again');

-- Someone outside the band sees nobody.
select set_config('request.jwt.claims', '{"sub":"6d333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.invitable_bandmates('6daaaaaa-0000-0000-0000-0000000000a1')), 0, 'not for other bands');

select * from finish();
rollback;
