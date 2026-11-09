-- Invite a band (#68): claims, fixes, and new listings.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('5b111111-1111-1111-1111-111111111111', 'ib-admin@example.com'),
  ('5b222222-2222-2222-2222-222222222222', 'ib-member@example.com'),
  ('5b333333-3333-3333-3333-333333333333', 'ib-owner@example.com'),
  ('5b444444-4444-4444-4444-444444444444', 'ib-new@example.com');
insert into public.workspaces (id, name) values ('5baaaaaa-0000-0000-0000-0000000000a1', 'Home Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('5baaaaaa-0000-0000-0000-0000000000a1', '5b111111-1111-1111-1111-111111111111', 'owner', 'Ada'),
  ('5baaaaaa-0000-0000-0000-0000000000a1', '5b222222-2222-2222-2222-222222222222', 'member', 'Mo');
insert into public.app_admins (user_id) values ('5b111111-1111-1111-1111-111111111111');
-- Home Band's listings: itself, a band it knows, a private one, a venue.
insert into public.connections (id, workspace_id, name, kind, group_type, is_us, keep_private, created_by) values
  ('5bcccccc-0000-0000-0000-000000000001', '5baaaaaa-0000-0000-0000-0000000000a1', 'Home Band', 'group', 'band', true, false, null),
  ('5bcccccc-0000-0000-0000-000000000002', '5baaaaaa-0000-0000-0000-0000000000a1', 'Wet Paint', 'group', 'band', false, false, null),
  ('5bcccccc-0000-0000-0000-000000000003', '5baaaaaa-0000-0000-0000-0000000000a1', 'Quiet Ones', 'group', 'band', false, true, null),
  ('5bcccccc-0000-0000-0000-000000000004', '5baaaaaa-0000-0000-0000-0000000000a1', 'The Hall', 'group', 'venue', false, false, null);
-- Bands already here claim their own page (as the migration did).
update public.workspaces set listing_id = '5bcccccc-0000-0000-0000-000000000001' where id = '5baaaaaa-0000-0000-0000-0000000000a1';

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;

set local role authenticated;

-- Not an admin.
select set_config('request.jwt.claims', '{"sub":"5b222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_band(null, 'Nope', 'x@example.com', null) $$,
  '42501', 'only admins can invite bands', 'members can''t invite bands');
select is((select count(*)::int from public.invitable_bands()), 0, 'members see no invitable bands');
select is((select count(*)::int from public.list_bands()), 0, 'members see no band list');

-- The admin.
select set_config('request.jwt.claims', '{"sub":"5b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select array_agg(name order by name) from public.invitable_bands() where connection_id::text like '5bcccccc-%'), array['Wet Paint'],
  'invitable: shared band listings, not our own page, private ones, or venues');

-- Claim Wet Paint.
insert into t select 'b1', workspace_id || '|' || invite_id || '|' || token || '|' || band
  from public.invite_band('5bcccccc-0000-0000-0000-000000000002', 'ignored', ' IB-Owner@Example.com ', 'Nell');
select is((select split_part(v, '|', 4) from t where k = 'b1'), 'Wet Paint', 'the band takes the listing''s name');
select is((select length(split_part(v, '|', 3)) from t where k = 'b1'), 64, 'the token comes back once');
select is((select status || ' ' || band || ' ' || role from public.invite_preview(
  (select split_part(v, '|', 3) from t where k = 'b1'))), 'open Wet Paint owner', 'the invite page can show it');
select is((select members || ' ' || listing_from || ' ' || invite_email from public.list_bands() where name = 'Wet Paint'),
  '0 Home Band ib-owner@example.com', 'the list shows whose listing it claimed and who it''s waiting on');
select is((select count(*)::int from public.invitable_bands() where connection_id::text like '5bcccccc-%'), 0, 'a claimed listing drops out of the picker');
select throws_ok($$ select * from public.invite_band('5bcccccc-0000-0000-0000-000000000002', null, null, null) $$,
  '23505', 'already claimed', 'a listing is claimed once');
select throws_ok($$ select * from public.invite_band('5bcccccc-0000-0000-0000-000000000003', null, null, null) $$,
  '23514', 'not a band listing', 'not a private listing');
select throws_ok($$ select * from public.invite_band('5bcccccc-0000-0000-0000-000000000004', null, null, null) $$,
  '23514', 'not a band listing', 'not a venue');
select throws_ok($$ select * from public.invite_band(null, 'wet paint', null, null) $$,
  '23505', 'already listed', 'typing a listed band''s name says to pick it');
select throws_ok($$ select * from public.invite_band(null, 'Another', 'ib-member@example.com', null) $$,
  '23505', 'already in a band', 'someone already in a band can''t start another');
select throws_ok($$ select * from public.invite_band(null, '', null, null) $$, '23514', null, 'a new band needs a name');
select throws_ok($$ select * from public.invite_band(null, 'Another', 'not-an-email', null) $$,
  '22023', 'not an email address', 'a bad address');

-- Before anyone joins, nobody has claimed it yet as far as others can tell.
select is((select count(*)::int from public.listing_claim('5bcccccc-0000-0000-0000-000000000002')), 0,
  'no "Uses Seeens" until the band has members');

-- A band that isn't listed gets a listing of its own.
insert into t select 'b2', workspace_id || '|' || token from public.invite_band(null, ' Link Band ', null, null);
reset role;
select is((select c.name || ' ' || c.is_us || ' ' || c.group_type from public.connections c
  join public.workspaces w on w.listing_id = c.id and w.id = c.workspace_id
  where w.id = split_part((select v from t where k = 'b2'), '|', 1)::uuid), 'Link Band true band',
  'a new band''s listing is its own page');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- A fresh link.
insert into t select 'r1', public.renew_band_invite(split_part((select v from t where k = 'b1'), '|', 2)::uuid);
select is((select count(*)::int from public.invite_preview((select split_part(v, '|', 3) from t where k = 'b1'))),
  0, 'the old link stops working');

-- The owner joins.
select set_config('request.jwt.claims', '{"sub":"5b333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ select public.accept_invite((select v from t where k = 'r1'), 'Nell') $$, 'the owner accepts');
select is((select band || ' ' || mine from public.listing_claim('5bcccccc-0000-0000-0000-000000000002')),
  'Wet Paint true', 'their band claims the listing');

-- They fix their listing's details, logged as theirs.
select lives_ok($$ select public.moderate_connection('5bcccccc-0000-0000-0000-000000000002', 'Wet Paint!', 'group', '{}', 'band',
  '{shows}', '[{"label":"Bandcamp","url":"https://wetpaint.example.com"}]') $$, 'the claimed band fixes its details');
select throws_ok($$ select public.moderate_connection('5bcccccc-0000-0000-0000-000000000002', 'Wet Paint!', 'group', '{}', 'venue',
  '{}', '[]') $$, '23514', 'a claimed band stays a band', 'and it stays a band');
select throws_ok($$ select public.moderate_connection('5bcccccc-0000-0000-0000-000000000004', 'The Hall', 'group', '{}', 'venue',
  '{}', '[]') $$, '42501', null, 'but can''t fix other listings');
select is((select (public.set_keep_private(array['5bcccccc-0000-0000-0000-000000000002'::uuid], true) ->> 'refused')::int), 1,
  'the claimed band can''t keep it private');

-- Home Band sees who uses it, and who fixed it.
select set_config('request.jwt.claims', '{"sub":"5b222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select band || ' ' || mine from public.listing_claim('5bcccccc-0000-0000-0000-000000000002')),
  'Wet Paint false', 'the band that added it sees it''s claimed');
select is((select by_band from public.connection_edits where connection_id = '5bcccccc-0000-0000-0000-000000000002'),
  'Wet Paint', 'the fix is logged as the band''s');
select is((select name from public.connections where id = '5bcccccc-0000-0000-0000-000000000002'), 'Wet Paint!',
  'the listing changed in place');
select set_config('request.jwt.claims', '{"sub":"5b111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select (public.set_keep_private(array['5bcccccc-0000-0000-0000-000000000002'::uuid], true) ->> 'refused')::int), 0,
  'a moderator still can');
reset role;
select is((select role::text from public.workspace_members
  where user_id = '5b333333-3333-3333-3333-333333333333'), 'owner', 'the owner owns the new band');

select * from finish();
rollback;
