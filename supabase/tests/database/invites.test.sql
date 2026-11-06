-- Band Settings and invites (#69).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

insert into auth.users (id, email) values
  ('1a111111-1111-1111-1111-111111111111', 'inv-owner@example.com'),
  ('1a222222-2222-2222-2222-222222222222', 'inv-member@example.com'),
  ('1a333333-3333-3333-3333-333333333333', 'inv-new@example.com'),
  ('1a444444-4444-4444-4444-444444444444', 'inv-other@example.com'),
  ('1a555555-5555-5555-5555-555555555555', 'inv-outsider@example.com');
insert into public.workspaces (id, name) values
  ('1aaaaaaa-0000-0000-0000-0000000000a1', 'Invite Band'),
  ('1aaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('1aaaaaaa-0000-0000-0000-0000000000a1', '1a111111-1111-1111-1111-111111111111', 'owner', 'Olive'),
  ('1aaaaaaa-0000-0000-0000-0000000000a1', '1a222222-2222-2222-2222-222222222222', 'member', 'Max'),
  ('1aaaaaaa-0000-0000-0000-0000000000b2', '1a555555-5555-5555-5555-555555555555', 'owner', 'Out');

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;

set local role authenticated;
-- A member invites by email.
select set_config('request.jwt.claims', '{"sub":"1a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into t select 'e1', token from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', ' Inv-New@Example.com ', 'Nia', 'member');
select is((select email || ' ' || invited_by_name from public.invites), 'inv-new@example.com Max', 'any member can invite; the address is cleaned up');
select is((select length(v) from t where k = 'e1'), 64, 'the token comes back once');
select throws_ok($$ select token_hash from public.invites $$, '42501', null, 'members can''t read the token hash');
select throws_ok($$ select * from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'x@example.com', null, 'owner') $$,
  '42501', 'only owners can invite owners', 'a member can''t invite an owner');
select throws_ok($$ select * from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'inv-owner@example.com', null, 'member') $$,
  '23505', 'already a member', 'inviting a member says so');
select throws_ok($$ select * from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'not-an-email', null, 'member') $$,
  '22023', 'not an email address', 'a bad address');
-- Inviting the same address again gives back the open one, with a new link.
select set_config('request.jwt.claims', '{"sub":"1a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into t select 'e2', token || '|' || existing || '|' || first_sent_by from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'inv-new@example.com', null, 'member');
select is((select split_part(v, '|', 2) || ' ' || split_part(v, '|', 3) from t where k = 'e2'), 'true Max', 'no duplicate: the open one, and who sent it');
select is((select count(*)::int from public.invites), 1, 'still one invite');
select is((select status from public.invite_preview((select v from t where k = 'e1'))), null, 'the old link stopped working');
update t set v = split_part(v, '|', 1) where k = 'e2';

-- Outsiders can't see, invite, or manage.
select set_config('request.jwt.claims', '{"sub":"1a555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.invites), 0, 'outsiders don''t see invites');
select throws_ok($$ select * from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'y@example.com', null, 'member') $$,
  '42501', 'not a member', 'or send them');
select is((select count(*)::int from public.band_members('1aaaaaaa-0000-0000-0000-0000000000a1')), 0, 'or list members');

-- The invite page, signed out.
set local role anon;
select is((select band || ' ' || invited_by || ' ' || status from public.invite_preview((select v from t where k = 'e2'))),
  'Invite Band Max open', 'the link shows who invited you to which band');

-- The wrong person can't use an email invite.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"1a444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok(format('select public.accept_invite(%L, null)', (select v from t where k = 'e2')), '42501', 'wrong email', 'only the invited address');

-- The right person joins, once.
select set_config('request.jwt.claims', '{"sub":"1a333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.accept_invite((select v from t where k = 'e2'), null), '1aaaaaaa-0000-0000-0000-0000000000a1'::uuid, 'accepting joins the band');
select is((select role::text || ' ' || display_name from public.workspace_members where user_id = '1a333333-3333-3333-3333-333333333333'),
  'member Nia', 'as the role invited, with the name given');
select throws_ok(format('select public.accept_invite(%L, null)', (select v from t where k = 'e2')), '23514', 'invite closed', 'single use');
select is((select status from public.invite_preview((select v from t where k = 'e2'))), 'used', 'and the page says so');

-- Link invites: anyone with the link, once.
select set_config('request.jwt.claims', '{"sub":"1a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into t select 'l1', token from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', null, null, 'owner');
select set_config('request.jwt.claims', '{"sub":"1a444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok(format('select public.accept_invite(%L, %L)', (select v from t where k = 'l1'), 'Odie'), 'a link invite works for whoever opens it');
select is((select role::text from public.workspace_members where user_id = '1a444444-4444-4444-4444-444444444444' and workspace_id = '1aaaaaaa-0000-0000-0000-0000000000a1'),
  'owner', 'an owner invite makes an owner');

-- Expired and revoked.
select set_config('request.jwt.claims', '{"sub":"1a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into t select 'x1', token from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'late@example.com', null, 'member');
insert into t select 'r1', token from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'gone@example.com', null, 'member');
reset role;
update public.invites set expires_at = now() - interval '1 minute' where email = 'late@example.com';
set local role authenticated;
select is((select status from public.invite_preview((select v from t where k = 'x1'))), 'expired', 'an old link says it expired');
select set_config('request.jwt.claims', '{"sub":"1a555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(format('select public.accept_invite(%L, null)', (select v from t where k = 'x1')), '23514', 'invite closed', 'and doesn''t work');
select set_config('request.jwt.claims', '{"sub":"1a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(format('select public.revoke_invite(%L)', (select id from public.invites where email = 'gone@example.com')), 'an owner can revoke anyone''s');
select is((select status from public.invite_preview((select v from t where k = 'r1'))), 'revoked', 'a revoked link says so');
-- Inviting an address whose invite expired starts a new one.
insert into t select 'x2', existing::text from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'late@example.com', null, 'member');
select is((select v from t where k = 'x2'), 'false', 'an expired invite is replaced');

-- Opting out.
select set_config('request.jwt.claims', '{"sub":"1a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into t select 'o1', token from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'stop@example.com', null, 'member');
set local role anon;
select lives_ok(format('select public.opt_out_of_invites(%L)', (select v from t where k = 'o1')), 'don''t email me again');
set local role authenticated;
select throws_ok($$ select * from public.create_invite('1aaaaaaa-0000-0000-0000-0000000000a1', 'stop@example.com', null, 'member') $$,
  '23514', 'opted out', 'that address can''t be emailed again');

-- Members, roles, and removal.
select is((select count(*)::int from public.band_members('1aaaaaaa-0000-0000-0000-0000000000a1')), 4, 'members see the band, with emails');
select throws_ok($$ select public.set_member_role('1aaaaaaa-0000-0000-0000-0000000000a1', '1a333333-3333-3333-3333-333333333333', 'owner') $$,
  '42501', 'owners only', 'members can''t change roles');
select throws_ok($$ select public.remove_member('1aaaaaaa-0000-0000-0000-0000000000a1', '1a333333-3333-3333-3333-333333333333') $$,
  '42501', 'owners only', 'or remove anyone');
select throws_ok($$ select public.rename_band('1aaaaaaa-0000-0000-0000-0000000000a1', 'Max''s Band') $$,
  '42501', 'owners only', 'or rename the band');
select set_config('request.jwt.claims', '{"sub":"1a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ select public.set_member_role('1aaaaaaa-0000-0000-0000-0000000000a1', '1a444444-4444-4444-4444-444444444444', 'member') $$, 'an owner changes a role');
select throws_ok($$ select public.set_member_role('1aaaaaaa-0000-0000-0000-0000000000a1', '1a111111-1111-1111-1111-111111111111', 'member') $$,
  '23514', 'a band needs an owner', 'but not the last owner''s');
select lives_ok($$ select public.remove_member('1aaaaaaa-0000-0000-0000-0000000000a1', '1a333333-3333-3333-3333-333333333333') $$, 'an owner removes a member');
select lives_ok($$ select public.rename_band('1aaaaaaa-0000-0000-0000-0000000000a1', '  Renamed Band ') $$, 'and renames the band');
select is((select name from public.workspaces where id = '1aaaaaaa-0000-0000-0000-0000000000a1'), 'Renamed Band', 'trimmed');

select * from finish();
rollback;
