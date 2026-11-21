-- A label runs its roster (#365): adds any band it can see, or a new one,
-- takes off ones it added, and fixes its roster bands' details until they
-- claim their own listing.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('8e111111-1111-1111-1111-111111111111', 'rr-label@example.com'),
  ('8e222222-2222-2222-2222-222222222222', 'rr-band@example.com');
insert into public.workspaces (id, name, kind) values
  ('8eaaaaaa-0000-0000-0000-0000000000a1', 'Pole Tapes', 'label'),
  ('8eaaaaaa-0000-0000-0000-0000000000a2', 'Adding Band', 'band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('8eaaaaaa-0000-0000-0000-0000000000a1', '8e111111-1111-1111-1111-111111111111', 'owner', 'Jo'),
  ('8eaaaaaa-0000-0000-0000-0000000000a2', '8e222222-2222-2222-2222-222222222222', 'owner', 'Lu');
-- The other band added the label's listing and two bands; the label claimed the listing.
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, keep_private, created_by) values
  ('8ecccccc-0000-0000-0000-000000000001', '8eaaaaaa-0000-0000-0000-0000000000a2', 'Pole Tapes', 'group', 'label', '{}', false, false, null),
  ('8ecccccc-0000-0000-0000-000000000002', '8eaaaaaa-0000-0000-0000-0000000000a2', 'Shared Band', 'group', 'band', '{}', false, false, null),
  ('8ecccccc-0000-0000-0000-000000000003', '8eaaaaaa-0000-0000-0000-0000000000a2', 'Hidden Band', 'group', 'band', '{}', false, true, null),
  ('8ecccccc-0000-0000-0000-000000000004', '8eaaaaaa-0000-0000-0000-0000000000a2', 'A Venue', 'group', 'venue', '{}', false, false, null);
update public.workspaces set listing_id = '8ecccccc-0000-0000-0000-000000000001' where id = '8eaaaaaa-0000-0000-0000-0000000000a1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"8e111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok($$ select public.roster_add('8eaaaaaa-0000-0000-0000-0000000000a1', '8ecccccc-0000-0000-0000-000000000002') $$,
  'a label adds a band another band shared');
select lives_ok($$ select public.roster_add('8eaaaaaa-0000-0000-0000-0000000000a1', '8ecccccc-0000-0000-0000-000000000002') $$,
  'adding it again is fine');
select throws_ok($$ select public.roster_add('8eaaaaaa-0000-0000-0000-0000000000a1', '8ecccccc-0000-0000-0000-000000000004') $$,
  '23514', 'only bands go on a roster', 'not a venue');
select throws_ok($$ select public.roster_add('8eaaaaaa-0000-0000-0000-0000000000a1', '8ecccccc-0000-0000-0000-000000000003') $$,
  '23514', 'only bands go on a roster', 'not a band it can''t see');
select isnt(public.roster_add_new('8eaaaaaa-0000-0000-0000-0000000000a1', 'Brand New Band'), null, 'or a new band');

select is((select string_agg(c.name, ',' order by c.name) from public.label_roster('8eaaaaaa-0000-0000-0000-0000000000a1') r
  join public.connections c on c.id = r.connection_id where r.is_current), 'Brand New Band,Shared Band', 'both on the roster');
select is((select string_agg(name || ':' || added_here, ',' order by name) from public.listing_roster('8ecccccc-0000-0000-0000-000000000001')),
  'Brand New Band:true,Shared Band:true', 'and on the label''s page, as the label''s own');
select is((select workspace_id from public.connections where name = 'Brand New Band'), '8eaaaaaa-0000-0000-0000-0000000000a1'::uuid,
  'the new band is the label''s own listing');

-- The label fixes its roster band, logged as the label's.
select lives_ok($$ select public.moderate_connection('8ecccccc-0000-0000-0000-000000000002', 'Shared Band!', 'group', '{}', 'band', '{}', '[]'::jsonb) $$,
  'the label fixes its roster band''s details');
select is((select by_band from public.connection_edits where connection_id = '8ecccccc-0000-0000-0000-000000000002' order by edited_at desc limit 1),
  'Pole Tapes', 'logged as the label''s');
select throws_ok($$ select public.moderate_connection('8ecccccc-0000-0000-0000-000000000002', 'Shared Band', 'person', '{dj}', null, '{}', '[]'::jsonb) $$,
  '23514', null, 'it stays a band');
select lives_ok($$ select public.set_not_active('8ecccccc-0000-0000-0000-000000000002', true) $$, 'and can mark it Not Active');

-- Off the roster: no more fixing.
select lives_ok($$ select public.roster_remove('8eaaaaaa-0000-0000-0000-0000000000a1', '8ecccccc-0000-0000-0000-000000000002') $$,
  'the label takes it off');
select throws_ok($$ select public.moderate_connection('8ecccccc-0000-0000-0000-000000000002', 'Shared Band', 'group', '{}', 'band', '{}', '[]'::jsonb) $$,
  '42501', null, 'and can''t fix it anymore');

-- Another band can't change the label's roster.
select set_config('request.jwt.claims', '{"sub":"8e222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select public.roster_add('8eaaaaaa-0000-0000-0000-0000000000a1', '8ecccccc-0000-0000-0000-000000000002') $$,
  '42501', null, 'only the label''s members');
select is((select count(*)::int from public.roster_links), 0, 'and can''t read its roster links');

select * from finish();
rollback;
