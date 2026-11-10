-- Bands you might know, for Getting Started: bands that have you in their
-- network, then shared bands in your town; not ones you've sorted.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('5d111111-1111-1111-1111-111111111111', 'sb-new@example.com'),
  ('5d222222-2222-2222-2222-222222222222', 'sb-friend@example.com'),
  ('5d333333-3333-3333-3333-333333333333', 'sb-admin@example.com');
insert into public.workspaces (id, name) values
  ('5daaaaaa-0000-0000-0000-0000000000a1', 'New Band'),
  ('5daaaaaa-0000-0000-0000-0000000000a2', 'Friend Band'),
  ('5daaaaaa-0000-0000-0000-0000000000a3', 'Grudge Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('5daaaaaa-0000-0000-0000-0000000000a1', '5d111111-1111-1111-1111-111111111111', 'owner', 'Nia'),
  ('5daaaaaa-0000-0000-0000-0000000000a2', '5d222222-2222-2222-2222-222222222222', 'owner', 'Fay'),
  ('5daaaaaa-0000-0000-0000-0000000000a1', '5d333333-3333-3333-3333-333333333333', 'member', 'Ada');
insert into public.app_admins (user_id) values ('5d333333-3333-3333-3333-333333333333');
insert into public.localities (id, workspace_id, name, region) values
  ('5dbbbbbb-0000-0000-0000-000000000001', '5daaaaaa-0000-0000-0000-0000000000a1', 'Portland', 'Oregon'),
  ('5dbbbbbb-0000-0000-0000-000000000002', '5daaaaaa-0000-0000-0000-0000000000a2', 'Portland', 'Oregon'),
  ('5dbbbbbb-0000-0000-0000-000000000003', '5daaaaaa-0000-0000-0000-0000000000a2', 'Seattle', 'Washington');
insert into public.connections (id, workspace_id, name, kind, group_type, is_us, locality_id, created_by) values
  ('5dcccccc-0000-0000-0000-000000000001', '5daaaaaa-0000-0000-0000-0000000000a1', 'New Band', 'group', 'band', true, '5dbbbbbb-0000-0000-0000-000000000001', null),
  ('5dcccccc-0000-0000-0000-000000000002', '5daaaaaa-0000-0000-0000-0000000000a2', 'Friend Band', 'group', 'band', true, '5dbbbbbb-0000-0000-0000-000000000003', null),
  ('5dcccccc-0000-0000-0000-000000000003', '5daaaaaa-0000-0000-0000-0000000000a3', 'Grudge Band', 'group', 'band', true, null, null),
  ('5dcccccc-0000-0000-0000-000000000004', '5daaaaaa-0000-0000-0000-0000000000a2', 'Porch Band', 'group', 'band', false, '5dbbbbbb-0000-0000-0000-000000000002', null),
  ('5dcccccc-0000-0000-0000-000000000005', '5daaaaaa-0000-0000-0000-0000000000a2', 'Secret Band', 'group', 'band', false, '5dbbbbbb-0000-0000-0000-000000000002', null),
  ('5dcccccc-0000-0000-0000-000000000006', '5daaaaaa-0000-0000-0000-0000000000a2', 'Far Band', 'group', 'band', false, '5dbbbbbb-0000-0000-0000-000000000003', null),
  ('5dcccccc-0000-0000-0000-000000000007', '5daaaaaa-0000-0000-0000-0000000000a2', 'Sorted Band', 'group', 'band', false, '5dbbbbbb-0000-0000-0000-000000000002', null);
update public.workspaces set listing_id = '5dcccccc-0000-0000-0000-000000000001' where id = '5daaaaaa-0000-0000-0000-0000000000a1';
update public.workspaces set listing_id = '5dcccccc-0000-0000-0000-000000000002' where id = '5daaaaaa-0000-0000-0000-0000000000a2';
-- Grudge Band has its own page but no listing_id: its own page counts.
update public.connections set keep_private = true where id = '5dcccccc-0000-0000-0000-000000000005';
insert into public.connection_band_details (workspace_id, connection_id, status) values
  ('5daaaaaa-0000-0000-0000-0000000000a2', '5dcccccc-0000-0000-0000-000000000001', 'homies'),
  ('5daaaaaa-0000-0000-0000-0000000000a3', '5dcccccc-0000-0000-0000-000000000001', 'avoid'),
  ('5daaaaaa-0000-0000-0000-0000000000a1', '5dcccccc-0000-0000-0000-000000000007', 'neutral');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  (select array_agg(name order by knows_you desc, name) from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1')),
  array['Friend Band', 'Porch Band'],
  'a band that has you in its network, then a shared band in your town');
select is(
  (select knows_you from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1') where name = 'Friend Band'), true,
  'marked as knowing you');
select is(
  (select array_agg(name) from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1')
   where name in ('Grudge Band', 'Secret Band', 'Far Band', 'Sorted Band')),
  null,
  'not a band that avoids you, a private band, one in another town, or one you sorted');
select is(
  (select town from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1') where name = 'Porch Band'),
  'Portland, Oregon', 'with its town');
select is(
  (select count(*)::int from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1', true) where name = 'Sorted Band'), 0,
  'a non-admin''s preview is the plain list');

-- Someone outside the band gets nothing.
select set_config('request.jwt.claims', '{"sub":"5d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1')), 0,
  'not for other bands');

-- An admin's preview shows what a new band would: sorted ones too.
select set_config('request.jwt.claims', '{"sub":"5d333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1', true) where name = 'Sorted Band'), 1,
  'an admin''s preview includes bands the band sorted');
select is((select count(*)::int from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1') where name = 'Sorted Band'), 0,
  'but not outside the preview');

-- Once the band sorts one, it drops off.
select set_config('request.jwt.claims', '{"sub":"5d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
reset role;
insert into public.connection_band_details (workspace_id, connection_id, status) values
  ('5daaaaaa-0000-0000-0000-0000000000a1', '5dcccccc-0000-0000-0000-000000000004', 'lets_play');
set local role authenticated;
select is(
  (select array_agg(name) from public.suggested_bands('5daaaaaa-0000-0000-0000-0000000000a1')),
  array['Friend Band'], 'a band you give a status drops off');

select * from finish();
rollback;
