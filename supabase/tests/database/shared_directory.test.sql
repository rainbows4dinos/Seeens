-- The open directory (#185, step 3a): bands read what other bands share and
-- keep their own private layer on it; the record stays its band's to edit.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email) values
  ('ce111111-1111-1111-1111-111111111111', 'open-alex@example.com'),
  ('ce222222-2222-2222-2222-222222222222', 'open-bea@example.com'),
  ('ce333333-3333-3333-3333-333333333333', 'open-nobody@example.com');
insert into public.workspaces (id, name) values
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'Band A'),
  ('ceaaaaaa-0000-0000-0000-0000000000b2', 'Band B');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'ce111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('ceaaaaaa-0000-0000-0000-0000000000b2', 'ce222222-2222-2222-2222-222222222222', 'owner', 'Bea');
insert into public.localities (id, workspace_id, name, region, country) values
  ('ce400000-0000-0000-0000-000000000001', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Testville', 'OR', 'United States'),
  ('ce400000-0000-0000-0000-000000000002', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Hiddenburg', 'OR', 'United States');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, locality_id) values
  ('ce500000-0000-0000-0000-000000000001', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Open Venue', 'group', '{}', 'venue', 'ce400000-0000-0000-0000-000000000001'),
  ('ce500000-0000-0000-0000-000000000002', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Pat Private', 'person', '{booker}', null, 'ce400000-0000-0000-0000-000000000002'),
  ('ce500000-0000-0000-0000-000000000003', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Open Venue Dupe', 'group', '{}', 'venue', null);
insert into public.connection_links (workspace_id, connection_id, url) values
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'ce500000-0000-0000-0000-000000000001', 'https://example.com/open'),
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'ce500000-0000-0000-0000-000000000002', 'https://example.com/pat');
update public.connection_band_details set status = 'homies', notes = 'A''s note'
where connection_id = 'ce500000-0000-0000-0000-000000000001';

set local role authenticated;

-- Band B reads what A shares, and only that.
select set_config('request.jwt.claims', '{"sub":"ce222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select string_agg(name, ',' order by name) from public.connections where workspace_id = 'ceaaaaaa-0000-0000-0000-0000000000a1'),
  'Open Venue,Open Venue Dupe', 'another band sees shared records, not private ones');
select is((select string_agg(name, ',') from public.localities where workspace_id = 'ceaaaaaa-0000-0000-0000-0000000000a1'),
  'Testville', 'and the shared record''s town, not the private one''s');
select is((select string_agg(url, ',') from public.connection_links where workspace_id = 'ceaaaaaa-0000-0000-0000-0000000000a1'),
  'https://example.com/open', 'and its links');
select ok(private.can_view_photo_path('ceaaaaaa-0000-0000-0000-0000000000a1/ce500000-0000-0000-0000-000000000001/photo.webp'),
  'and its photo');
select ok(not private.can_view_photo_path('ceaaaaaa-0000-0000-0000-0000000000a1/ce500000-0000-0000-0000-000000000002/photo.webp'),
  'not a private record''s photo');
select ok(not private.can_use_photo_path('ceaaaaaa-0000-0000-0000-0000000000a1/ce500000-0000-0000-0000-000000000001/photo.webp'),
  'and can''t change the photo');
select is((select count(*)::int from public.connection_band_details where connection_id = 'ce500000-0000-0000-0000-000000000001'),
  0, 'A''s private layer stays A''s');

-- The record is A's to edit.
update public.connections set name = 'Renamed by B' where id = 'ce500000-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.connection_links (workspace_id, connection_id, url)
  values ('ceaaaaaa-0000-0000-0000-0000000000a1', 'ce500000-0000-0000-0000-000000000001', 'https://example.com/b') $$,
  '42501', null, 'another band can''t add links');

-- B keeps its own layer on it.
select lives_ok($$ insert into public.connection_band_details (workspace_id, connection_id, status, notes)
  values ('ceaaaaaa-0000-0000-0000-0000000000b2', 'ce500000-0000-0000-0000-000000000001', 'lets_play', 'B''s note') $$,
  'another band keeps its own status and notes on a shared record');
select is((select status::text || '|' || notes from public.connection_band_details where connection_id = 'ce500000-0000-0000-0000-000000000001'),
  'lets_play|B''s note', 'and sees only its own');
select is((select count(*)::int from public.connection_status_changes where connection_id = 'ce500000-0000-0000-0000-000000000001'),
  1, 'with its own status history');
select lives_ok($$ select public.set_next_action('ce500000-0000-0000-0000-000000000001', 'Ask about a Friday',
  p_workspace_id => 'ceaaaaaa-0000-0000-0000-0000000000b2') $$, 'its own plan');
select throws_ok($$ select public.set_next_action('ce500000-0000-0000-0000-000000000001', 'No band given') $$,
  '42501', null, 'a plan without a band goes to the record''s band, which isn''t B''s to write');
select lives_ok($$ insert into public.outreach_entries (workspace_id, connection_id, channel, summary, author_id, occurred_on)
  values ('ceaaaaaa-0000-0000-0000-0000000000b2', 'ce500000-0000-0000-0000-000000000001', 'email', 'Sent a link',
    'ce222222-2222-2222-2222-222222222222', current_date) $$, 'and its own outreach');

-- Not on a private record, and never as A.
select throws_ok($$ insert into public.connection_band_details (workspace_id, connection_id, status)
  values ('ceaaaaaa-0000-0000-0000-0000000000b2', 'ce500000-0000-0000-0000-000000000002', 'avoid') $$,
  '42501', null, 'no layer on a record kept private');
select throws_ok($$ select public.set_next_action('ce500000-0000-0000-0000-000000000002', 'Sneak',
  p_workspace_id => 'ceaaaaaa-0000-0000-0000-0000000000b2') $$, 'P0002', null, 'no plan on one either: it isn''t there for B');
select throws_ok($$ insert into public.connection_band_details (workspace_id, connection_id, status)
  values ('ceaaaaaa-0000-0000-0000-0000000000a1', 'ce500000-0000-0000-0000-000000000003', 'avoid') $$,
  '42501', null, 'no writing into A''s layer');

-- Someone in no band sees nothing.
select set_config('request.jwt.claims', '{"sub":"ce333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.connections), 0, 'no band, no directory');
select is((select count(*)::int from public.localities), 0, 'or towns');

-- A sees its own layer and plans, not B's.
select set_config('request.jwt.claims', '{"sub":"ce111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select status::text || '|' || notes from public.connection_band_details where connection_id = 'ce500000-0000-0000-0000-000000000001'),
  'homies|A''s note', 'A''s layer is untouched');
select is((select count(*)::int from public.next_actions where connection_id = 'ce500000-0000-0000-0000-000000000001'),
  0, 'B''s plan is B''s');
select lives_ok($$ select public.set_next_action('ce500000-0000-0000-0000-000000000001', 'Book the date',
  p_workspace_id => 'ceaaaaaa-0000-0000-0000-0000000000a1') $$, 'both bands can have an open plan');
select is((select name from public.connections where id = 'ce500000-0000-0000-0000-000000000001'),
  'Open Venue', 'B''s rename changed nothing');

select throws_ok($$ select public.merge_connections('ce500000-0000-0000-0000-000000000003',
  array['ce500000-0000-0000-0000-000000000001'::uuid]) $$,
  '23514', null, 'a record another band keeps notes on can''t be merged away yet');

-- Kept private later: B loses sight of it; its layer waits.
update public.connections set keep_private = true where id = 'ce500000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"ce222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.connections where id = 'ce500000-0000-0000-0000-000000000001'),
  0, 'kept private, another band no longer sees it');
reset role;
select is((select count(*)::int from public.connection_band_details where connection_id = 'ce500000-0000-0000-0000-000000000001'),
  2, 'and its layer is kept, in case it''s shared again');

select * from finish();
rollback;
