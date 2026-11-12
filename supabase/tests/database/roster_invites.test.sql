-- A label invites its roster (#298): a label's owner invites a band on the
-- label to claim its listing.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('8c111111-1111-1111-1111-111111111111', 'ri-owner@example.com'),
  ('8c222222-2222-2222-2222-222222222222', 'ri-member@example.com'),
  ('8c333333-3333-3333-3333-333333333333', 'ri-band@example.com');
insert into public.workspaces (id, name, kind) values
  ('8caaaaaa-0000-0000-0000-0000000000a1', 'Spare Records', 'label'),
  ('8caaaaaa-0000-0000-0000-0000000000a2', 'Other Band', 'band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('8caaaaaa-0000-0000-0000-0000000000a1', '8c111111-1111-1111-1111-111111111111', 'owner', 'Tam'),
  ('8caaaaaa-0000-0000-0000-0000000000a1', '8c222222-2222-2222-2222-222222222222', 'member', 'Mo'),
  ('8caaaaaa-0000-0000-0000-0000000000a2', '8c333333-3333-3333-3333-333333333333', 'owner', 'Bo');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, keep_private, created_by) values
  ('8ccccccc-0000-0000-0000-000000000001', '8caaaaaa-0000-0000-0000-0000000000a1', 'Spare Records', 'group', 'label', '{}', true, false, null),
  ('8ccccccc-0000-0000-0000-000000000002', '8caaaaaa-0000-0000-0000-0000000000a1', 'Roster Band', 'group', 'band', '{}', false, false, null),
  ('8ccccccc-0000-0000-0000-000000000003', '8caaaaaa-0000-0000-0000-0000000000a1', 'Stranger Band', 'group', 'band', '{}', false, false, null),
  ('8ccccccc-0000-0000-0000-000000000004', '8caaaaaa-0000-0000-0000-0000000000a1', 'Other Band', 'group', 'band', '{}', false, false, null);
update public.workspaces set listing_id = '8ccccccc-0000-0000-0000-000000000001' where id = '8caaaaaa-0000-0000-0000-0000000000a1';
-- Other Band already claimed its listing.
update public.workspaces set listing_id = '8ccccccc-0000-0000-0000-000000000004' where id = '8caaaaaa-0000-0000-0000-0000000000a2';
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current) values
  ('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000002', '8ccccccc-0000-0000-0000-000000000001', 'on_label', true),
  ('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000004', '8ccccccc-0000-0000-0000-000000000001', 'on_label', true);

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;
set local role authenticated;

-- Members who aren't owners can't.
select set_config('request.jwt.claims', '{"sub":"8c222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000002', null, null) $$,
  '42501', 'only label owners', 'members cannot invite the roster');
-- Bands can't.
select set_config('request.jwt.claims', '{"sub":"8c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a2', '8ccccccc-0000-0000-0000-000000000002', null, null) $$,
  '42501', 'only label owners', 'a band cannot');

select set_config('request.jwt.claims', '{"sub":"8c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000003', null, null) $$,
  '23514', 'not on the roster', 'only bands on the roster');
select throws_ok($$ select * from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000004', null, null) $$,
  '23505', 'already claimed', 'not a band that is already on Seeens');
select is((select joined from public.label_roster('8caaaaaa-0000-0000-0000-0000000000a1') where connection_id = '8ccccccc-0000-0000-0000-000000000004'),
  true, 'a band on Seeens shows as joined');

-- The owner invites Roster Band.
insert into t select 'first', invite_id from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000002', 'ri-new@example.com', 'Ree');
select is((select invited from public.label_roster('8caaaaaa-0000-0000-0000-0000000000a1') where connection_id = '8ccccccc-0000-0000-0000-000000000002'),
  true, 'the roster shows it invited');
select is((select joined from public.label_roster('8caaaaaa-0000-0000-0000-0000000000a1') where connection_id = '8ccccccc-0000-0000-0000-000000000002'),
  false, 'but not joined');
select lives_ok($$ select public.mark_invite_sent((select v::uuid from t where k = 'first')) $$, 'the label can mark it sent');

-- Asking again: the old invite closes, a new one opens, same band.
insert into t select 'second', invite_id from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000002', null, null);
reset role;
select isnt((select revoked_at from public.invites where id = (select v::uuid from t where k = 'first')), null, 'the old invite closes');
select is((select count(*)::int from public.workspaces where listing_id = '8ccccccc-0000-0000-0000-000000000002'), 1, 'still one band');
select is((select kind || ' ' || invited_by_workspace::text from public.workspaces where listing_id = '8ccccccc-0000-0000-0000-000000000002'),
  'band 8caaaaaa-0000-0000-0000-0000000000a1', 'a band, invited by the label');
select is((select role::text || ' ' || invited_by_name from public.invites where id = (select v::uuid from t where k = 'second')),
  'owner Tam at Spare Records', 'an owner invite, from the label');
select isnt((select sent_at from public.invites where id = (select v::uuid from t where k = 'first')), null, 'marked sent');

-- Once someone's in, it's theirs.
insert into public.workspace_members (workspace_id, user_id, role, display_name)
select id, '8c222222-2222-2222-2222-222222222222', 'owner', 'Mo' from public.workspaces where listing_id = '8ccccccc-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_roster_band('8caaaaaa-0000-0000-0000-0000000000a1', '8ccccccc-0000-0000-0000-000000000002', null, null) $$,
  '23505', 'already claimed', 'a claimed band cannot be invited again');

select * from finish();
rollback;
