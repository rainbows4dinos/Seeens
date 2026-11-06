-- Merging duplicates and undoing it (#169).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

insert into auth.users (id, email) values
  ('ae111111-1111-1111-1111-111111111111', 'merge-alex@example.com'),
  ('ae222222-2222-2222-2222-222222222222', 'merge-outsider@example.com');
insert into public.workspaces (id, name) values
  ('aeaaaaaa-0000-0000-0000-0000000000a1', 'Merge Band'),
  ('aeaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('aeaaaaaa-0000-0000-0000-0000000000a1', 'ae111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('aeaaaaaa-0000-0000-0000-0000000000b2', 'ae222222-2222-2222-2222-222222222222', 'owner', 'Sam');
insert into public.localities (id, workspace_id, name, region, country) values
  ('ae100000-0000-0000-0000-000000000001', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Portland', 'Oregon', 'United States'),
  ('ae100000-0000-0000-0000-000000000002', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Eugene', 'Oregon', 'United States');
insert into public.scenes (id, workspace_id, name) values
  ('ae200000-0000-0000-0000-000000000001', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Merge punk'),
  ('ae200000-0000-0000-0000-000000000002', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Merge garage');

-- K is kept. G1 has more to it than G2, so it fills blanks first.
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, locality_id, email, phone, notes, played_together, status) values
  ('aec00000-0000-0000-0000-00000000000a', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'GAB', 'group', '{}', 'band', 'ae100000-0000-0000-0000-000000000001', null, null, 'Kept notes.', false, 'homies'),
  ('aec00000-0000-0000-0000-0000000000b1', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Gab', 'group', '{}', 'band', 'ae100000-0000-0000-0000-000000000002', 'gab@example.com', null, 'From the sheet.', true, 'neutral'),
  ('aec00000-0000-0000-0000-0000000000b2', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'G.A.B.', 'group', '{}', 'band', null, 'other@example.com', '555-0100', null, false, 'neutral'),
  ('aec00000-0000-0000-0000-0000000000c1', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Isabel Example', 'person', '{musician}', null, null, null, null, null, false, 'neutral'),
  ('aec00000-0000-0000-0000-0000000000c2', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'Quinn Example', 'person', '{musician}', null, null, null, null, null, false, 'neutral'),
  ('aec00000-0000-0000-0000-0000000000d1', 'aeaaaaaa-0000-0000-0000-0000000000b2', 'Elsewhere', 'group', '{}', 'band', null, null, null, null, false, 'neutral');

insert into public.connection_links (id, workspace_id, connection_id, label, url, position) values
  ('ae300000-0000-0000-0000-000000000001', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-00000000000a', 'Bandcamp', 'https://gab.bandcamp.com', 0),
  ('ae300000-0000-0000-0000-000000000002', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'Bandcamp', 'https://www.gab.bandcamp.com/', 0),
  ('ae300000-0000-0000-0000-000000000003', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'Website', 'https://gab.example.com', 1);
insert into public.connection_scenes (workspace_id, connection_id, scene_id) values
  ('aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-00000000000a', 'ae200000-0000-0000-0000-000000000001'),
  ('aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'ae200000-0000-0000-0000-000000000001'),
  ('aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'ae200000-0000-0000-0000-000000000002');
-- Isabel is in both; Quinn only in G1; G1 lists K as a related band.
insert into public.affiliations (id, workspace_id, from_connection_id, to_connection_id, kind, role) values
  ('ae400000-0000-0000-0000-000000000001', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000c1', 'aec00000-0000-0000-0000-00000000000a', 'member', null),
  ('ae400000-0000-0000-0000-000000000002', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000c1', 'aec00000-0000-0000-0000-0000000000b1', 'member', 'vocals'),
  ('ae400000-0000-0000-0000-000000000003', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000c2', 'aec00000-0000-0000-0000-0000000000b1', 'member', 'drums'),
  ('ae400000-0000-0000-0000-000000000004', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'aec00000-0000-0000-0000-00000000000a', 'related', null);
insert into public.outreach_entries (id, workspace_id, connection_id, summary) values
  ('ae500000-0000-0000-0000-000000000001', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'Emailed about a bill.');
insert into public.next_actions (id, workspace_id, connection_id, description) values
  ('ae600000-0000-0000-0000-000000000001', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-00000000000a', 'Kept plan'),
  ('ae600000-0000-0000-0000-000000000002', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b1', 'G1 plan'),
  ('ae600000-0000-0000-0000-000000000003', 'aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-0000000000b2', 'G2 plan');

create temp table made (k text primary key, id uuid) on commit drop;
grant all on made to authenticated;

set local role authenticated;

-- The outsider can't merge someone else's connections.
select set_config('request.jwt.claims', '{"sub":"ae222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select public.merge_connections('aec00000-0000-0000-0000-00000000000a', '{aec00000-0000-0000-0000-0000000000b1}') $$,
  'P0002', 'connection not found', 'an outsider can''t merge');
select throws_ok($$ select public.merge_connections('aec00000-0000-0000-0000-0000000000d1', '{aec00000-0000-0000-0000-0000000000b1}') $$,
  'P0002', 'connection not found', 'or pull another workspace''s connection into theirs');

select set_config('request.jwt.claims', '{"sub":"ae111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select public.merge_connections('aec00000-0000-0000-0000-00000000000a', '{aec00000-0000-0000-0000-00000000000a}') $$,
  '22023', null, 'can''t merge into itself');

insert into made values ('m1', public.merge_connections('aec00000-0000-0000-0000-00000000000a',
  '{aec00000-0000-0000-0000-0000000000b2,aec00000-0000-0000-0000-0000000000b1}'));
select isnt((select id from made where k = 'm1'), null, 'merge returns its id');

-- Hidden, not deleted.
select is((select count(*)::int from public.connections where name in ('GAB', 'Gab', 'G.A.B.')), 1, 'merged ones are hidden');
select is(public.merged_target('aec00000-0000-0000-0000-0000000000b1'), 'aec00000-0000-0000-0000-00000000000a'::uuid, 'old id points at the kept one');
select is(public.merged_target('aec00000-0000-0000-0000-00000000000a'), null, 'the kept one points nowhere');

-- The kept one wins; blanks fill from the fuller one first.
select is((select email from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'), 'gab@example.com', 'email from the fuller duplicate');
select is((select phone from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'), '555-0100', 'phone from the other');
select is((select locality_id from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'),
  'ae100000-0000-0000-0000-000000000001'::uuid, 'town stays');
select is((select status::text from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'), 'homies', 'status stays');
select is((select notes from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'),
  E'Kept notes.\n\nFrom Gab:\nFrom the sheet.', 'notes go below');
select ok((select played_together from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'), 'played together carries');

-- Lists combine without repeats.
select is((select array_agg(url order by position) from public.connection_links where connection_id = 'aec00000-0000-0000-0000-00000000000a'),
  array['https://gab.bandcamp.com', 'https://gab.example.com'], 'same Bandcamp dropped, website added after');
select is((select count(*)::int from public.connection_scenes where connection_id = 'aec00000-0000-0000-0000-00000000000a'), 2, 'scenes combine');
select is((select array_agg(role order by role) from public.affiliations where to_connection_id = 'aec00000-0000-0000-0000-00000000000a' and kind = 'member'),
  array['drums', 'vocals'], 'members combine; the repeat fills its role');
select is((select count(*)::int from public.affiliations where from_connection_id = to_connection_id
  or (from_connection_id = 'aec00000-0000-0000-0000-00000000000a' and kind = 'related')), 0, 'the link between them is dropped');
select is((select count(*)::int from public.outreach_entries where connection_id = 'aec00000-0000-0000-0000-00000000000a'), 1, 'outreach moves');
select is((select array_agg(description || ':' || status order by description) from public.next_actions where connection_id = 'aec00000-0000-0000-0000-00000000000a'),
  array['G1 plan:dropped', 'G2 plan:dropped', 'Kept plan:open'], 'one open plan; the others close');
select is((select merged_ids from public.connection_merges where id = (select id from made where k = 'm1')),
  array['aec00000-0000-0000-0000-0000000000b1', 'aec00000-0000-0000-0000-0000000000b2']::uuid[], 'fuller one first in the record');
select throws_ok($$ select public.merge_connections('aec00000-0000-0000-0000-00000000000a', '{aec00000-0000-0000-0000-0000000000b1}') $$,
  'P0002', 'connection not found', 'a merged one can''t be merged again');

-- Someone edits the kept one before undoing: their edit stays.
update public.connections set phone = '555-0199' where id = 'aec00000-0000-0000-0000-00000000000a';

select is(public.undo_merge((select id from made where k = 'm1')), 'aec00000-0000-0000-0000-00000000000a'::uuid, 'undo returns the kept one');
select is((select count(*)::int from public.connections where name in ('GAB', 'Gab', 'G.A.B.')), 3, 'all three are back');
select is((select row(email, phone, notes, played_together)::text from public.connections where id = 'aec00000-0000-0000-0000-00000000000a'),
  '(,555-0199,"Kept notes.",f)', 'filled values revert; the edit stays');
select is((select array_agg(url order by position) from public.connection_links where connection_id = 'aec00000-0000-0000-0000-0000000000b1'),
  array['https://www.gab.bandcamp.com/', 'https://gab.example.com'], 'links go back, the dropped one too');
select is((select count(*)::int from public.connection_scenes where connection_id = 'aec00000-0000-0000-0000-0000000000b1'), 2, 'scenes go back');
select is((select count(*)::int from public.connection_scenes where connection_id = 'aec00000-0000-0000-0000-00000000000a'), 1, 'and the kept one has its own');
select is((select array_agg(id order by id) from public.affiliations where workspace_id = 'aeaaaaaa-0000-0000-0000-0000000000a1'),
  array['ae400000-0000-0000-0000-000000000001', 'ae400000-0000-0000-0000-000000000002', 'ae400000-0000-0000-0000-000000000003', 'ae400000-0000-0000-0000-000000000004']::uuid[],
  'every link is back');
select is((select role from public.affiliations where id = 'ae400000-0000-0000-0000-000000000001'), null, 'the filled role reverts');
select is((select to_connection_id from public.affiliations where id = 'ae400000-0000-0000-0000-000000000003'),
  'aec00000-0000-0000-0000-0000000000b1'::uuid, 'Quinn is in Gab again');
select is((select connection_id from public.outreach_entries where id = 'ae500000-0000-0000-0000-000000000001'),
  'aec00000-0000-0000-0000-0000000000b1'::uuid, 'outreach goes back');
select is((select array_agg(description || ':' || status order by description) from public.next_actions where workspace_id = 'aeaaaaaa-0000-0000-0000-0000000000a1'),
  array['G1 plan:open', 'G2 plan:open', 'Kept plan:open'], 'closed plans reopen');
select throws_ok(format('select public.undo_merge(%L)', (select id from made where k = 'm1')),
  '23514', 'that merge was already undone', 'undo once');

-- Not duplicates.
insert into public.connection_not_duplicates (workspace_id, connection_a, connection_b)
values ('aeaaaaaa-0000-0000-0000-0000000000a1', 'aec00000-0000-0000-0000-00000000000a', 'aec00000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.connection_not_duplicates), 1, 'a member can mark two as different');
select throws_ok($$ insert into public.connection_not_duplicates (workspace_id, connection_a, connection_b)
  values ('aeaaaaaa-0000-0000-0000-0000000000b2', 'aec00000-0000-0000-0000-0000000000d1', 'aec00000-0000-0000-0000-0000000000d2') $$,
  '42501', null, 'but not in another workspace');

-- After 30 days: no undo, the merged one is deleted, its old id still redirects.
insert into made values ('m2', public.merge_connections('aec00000-0000-0000-0000-00000000000a', '{aec00000-0000-0000-0000-0000000000b2}'));
reset role;
update public.connection_merges set merged_at = now() - interval '31 days' where id = (select id from made where k = 'm2');
update public.connections set merged_at = now() - interval '31 days' where id = 'aec00000-0000-0000-0000-0000000000b2';
select is(private.purge_merged('aeaaaaaa-0000-0000-0000-0000000000a1'), 1, 'purge deletes the merged one');
set local role authenticated;
select is(public.merged_target('aec00000-0000-0000-0000-0000000000b2'), 'aec00000-0000-0000-0000-00000000000a'::uuid, 'its old id still redirects');
select throws_ok(format('select public.undo_merge(%L)', (select id from made where k = 'm2')),
  '23514', 'that merge is more than 30 days old', 'and it can''t be undone');

select * from finish();
rollback;
