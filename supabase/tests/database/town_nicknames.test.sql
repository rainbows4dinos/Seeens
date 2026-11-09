-- Town nicknames (#234).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, email) values
  ('8a111111-1111-1111-1111-111111111111', 'tn-member@example.com'),
  ('8a222222-2222-2222-2222-222222222222', 'tn-mod@example.com');
insert into public.workspaces (id, name) values ('8aaaaaaa-0000-0000-0000-0000000000a1', 'Nick Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('8aaaaaaa-0000-0000-0000-0000000000a1', '8a111111-1111-1111-1111-111111111111', 'owner', 'Mem');
insert into public.app_moderators (user_id) values ('8a222222-2222-2222-2222-222222222222');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Town search.
select is((select name from public.search_places('PDX') limit 1), 'Portland', 'PDX finds Portland');
select is((select region_code from public.search_places('pdx') limit 1), 'OR', 'the Oregon one');
select is((select name from public.search_places('Sactown') limit 1), 'Sacramento', 'Sactown finds Sacramento');

-- Whole words, caps for all-caps nicknames.
select ok(private.has_word('LA Egg Punk', 'LA'), 'LA in LA Egg Punk');
select ok(not private.has_word('La Luz', 'LA'), 'not in La Luz');
select ok(not private.has_word('Salsa', 'LA'), 'not inside a word');
select ok(private.has_word('sactown hardcore', 'Sactown'), 'Sactown in any case');

-- New scenes find their town, and the town's scene.
insert into public.scenes (workspace_id, name) values ('8aaaaaaa-0000-0000-0000-0000000000a1', 'LA');
insert into public.scenes (workspace_id, name) values ('8aaaaaaa-0000-0000-0000-0000000000a1', 'LA Egg Punk');
insert into public.scenes (workspace_id, name) values ('8aaaaaaa-0000-0000-0000-0000000000a1', 'Los Angeles Noise');
select is((select l.name from public.scenes s join public.localities l on l.id = s.locality_id where s.name = 'LA'),
  'Los Angeles', 'LA gets Los Angeles');
select is((select parent_id from public.scenes where name = 'LA'), null, 'and is the town''s own scene');
select is((select p.name from public.scenes s join public.scenes p on p.id = s.parent_id where s.name = 'LA Egg Punk'),
  'LA', 'LA Egg Punk goes inside LA');
select is((select p.name from public.scenes s join public.scenes p on p.id = s.parent_id where s.name = 'Los Angeles Noise'),
  'LA', 'the full name finds it too');

-- A choice someone made stays.
insert into public.scenes (workspace_id, name, parent_id) values ('8aaaaaaa-0000-0000-0000-0000000000a1', 'SoCal', null);
insert into public.scenes (workspace_id, name, parent_id)
  select '8aaaaaaa-0000-0000-0000-0000000000a1', 'LA Hardcore', id from public.scenes where name = 'SoCal';
select is((select p.name from public.scenes s join public.scenes p on p.id = s.parent_id where s.name = 'LA Hardcore'),
  'SoCal', 'a chosen parent stays');

-- Nothing to match: left alone.
insert into public.scenes (workspace_id, name) values ('8aaaaaaa-0000-0000-0000-0000000000a1', 'Basement Shows');
select is((select locality_id from public.scenes where name = 'Basement Shows'), null, 'no town in the name, none set');

-- Existing scenes: suggestions to confirm.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.scenes (id, workspace_id, name) values
  ('8adddddd-0000-0000-0000-000000000001', '8aaaaaaa-0000-0000-0000-0000000000a1', 'temp');
update public.scenes set name = 'PDX Garage', locality_id = null, parent_id = null where id = '8adddddd-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select town from public.scene_suggestions('8aaaaaaa-0000-0000-0000-0000000000a1') where scene_name = 'PDX Garage'),
  'Portland, OR', 'an old scene gets a suggestion');
select lives_ok($$ select public.apply_scene_suggestion('8adddddd-0000-0000-0000-000000000001') $$, 'apply it');
select is((select l.name from public.scenes s join public.localities l on l.id = s.locality_id
  where s.id = '8adddddd-0000-0000-0000-000000000001'), 'Portland', 'it takes the town');
select is((select count(*)::int from public.scene_suggestions('8aaaaaaa-0000-0000-0000-0000000000a1') where scene_name = 'PDX Garage'),
  0, 'and the suggestion goes');

-- Moderators keep the list.
select throws_ok($$ select public.add_place_alias('Sac Town', 5389489) $$, '42501', 'only moderators', 'members can''t add nicknames');
select set_config('request.jwt.claims', '{"sub":"8a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$ select public.add_place_alias('Sac Town', 5389489) $$, 'a moderator adds one');
select throws_ok($$ select public.add_place_alias('pdx', 5389489) $$, '23505', 'already a nickname', 'no repeats, any case');

select * from finish();
rollback;
