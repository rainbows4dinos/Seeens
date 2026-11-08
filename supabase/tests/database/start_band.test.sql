-- Start a band (#68).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('5b111111-1111-1111-1111-111111111111', 'sb-admin@example.com'),
  ('5b222222-2222-2222-2222-222222222222', 'sb-member@example.com'),
  ('5b333333-3333-3333-3333-333333333333', 'sb-new@example.com');
insert into public.workspaces (id, name) values ('5baaaaaa-0000-0000-0000-0000000000a1', 'Existing Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('5baaaaaa-0000-0000-0000-0000000000a1', '5b111111-1111-1111-1111-111111111111', 'owner', 'Ada'),
  ('5baaaaaa-0000-0000-0000-0000000000a1', '5b222222-2222-2222-2222-222222222222', 'member', 'Mo');
insert into public.app_admins (user_id) values ('5b111111-1111-1111-1111-111111111111');

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;

set local role authenticated;

-- Not an admin.
select set_config('request.jwt.claims', '{"sub":"5b222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select * from public.start_band('Nope', 'x@example.com', null) $$,
  '42501', 'only admins can start bands', 'members can''t start bands');
select is((select count(*)::int from public.list_bands()), 0, 'members see no band list');

-- An admin starts one.
select set_config('request.jwt.claims', '{"sub":"5b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into t select 'b1', workspace_id || '|' || invite_id || '|' || token
  from public.start_band('  Wet Paint  ', ' SB-New@Example.com ', 'Nell');
reset role;
select is((select name from public.workspaces where id = split_part((select v from t where k = 'b1'), '|', 1)::uuid),
  'Wet Paint', 'the band is made, name trimmed');
select is((select email || ' ' || role || ' ' || invited_by_name || ' ' || name from public.invites
  where id = split_part((select v from t where k = 'b1'), '|', 2)::uuid),
  'sb-new@example.com owner Ada Nell', 'an owner invite, sent by the admin by name');
set local role authenticated;
select is((select length(split_part(v, '|', 3)) from t where k = 'b1'), 64, 'the token comes back once');
select is((select status || ' ' || band || ' ' || role from public.invite_preview(
  (select split_part(v, '|', 3) from t where k = 'b1'))), 'open Wet Paint owner', 'the invite page can show it');
select is((select members || ' ' || invite_email from public.list_bands() where name = 'Wet Paint'),
  '0 sb-new@example.com', 'the list shows it waiting on the owner');

select throws_ok($$ select * from public.start_band('wet paint', null, null) $$,
  '23505', 'a band with that name', 'band names don''t repeat');
select throws_ok($$ select * from public.start_band('Another', 'sb-member@example.com', null) $$,
  '23505', 'already in a band', 'someone already in a band can''t start another');
select throws_ok($$ select * from public.start_band('', null, null) $$,
  '23514', null, 'a band needs a name');
select throws_ok($$ select * from public.start_band('Another', 'not-an-email', null) $$,
  '22023', 'not an email address', 'a bad address');
select lives_ok($$ insert into t select 'b2', token from public.start_band('Link Band', null, null) $$,
  'a link invite, no email');

-- A fresh link.
insert into t select 'r1', public.renew_band_invite(split_part((select v from t where k = 'b1'), '|', 2)::uuid);
select is((select status from public.invite_preview((select split_part(v, '|', 3) from t where k = 'b1'))),
  null, 'the old link stops working');
select is((select status from public.invite_preview((select v from t where k = 'r1'))), 'open', 'the new one works');

-- The owner joins.
select set_config('request.jwt.claims', '{"sub":"5b333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ select public.accept_invite((select v from t where k = 'r1'), 'Nell') $$, 'the owner accepts');
reset role;
select is((select role::text from public.workspace_members
  where user_id = '5b333333-3333-3333-3333-333333333333'), 'owner', 'and owns the new band');

select * from finish();
rollback;
