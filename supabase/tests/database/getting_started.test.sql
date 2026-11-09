-- Getting started (#68).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('6a111111-1111-1111-1111-111111111111', 'gs-one@example.com'),
  ('6a222222-2222-2222-2222-222222222222', 'gs-two@example.com'),
  ('6a333333-3333-3333-3333-333333333333', 'gs-out@example.com');
insert into public.workspaces (id, name) values
  ('6aaaaaaa-0000-0000-0000-0000000000a1', 'Start Band'),
  ('6aaaaaaa-0000-0000-0000-0000000000b2', 'Old Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('6aaaaaaa-0000-0000-0000-0000000000a1', '6a111111-1111-1111-1111-111111111111', 'owner', 'One'),
  ('6aaaaaaa-0000-0000-0000-0000000000b2', '6a333333-3333-3333-3333-333333333333', 'owner', 'Out');
insert into public.connections (id, workspace_id, name, kind, group_type, is_us, keep_private, created_by) values
  ('6acccccc-0000-0000-0000-000000000001', '6aaaaaaa-0000-0000-0000-0000000000b2', 'Start Band', 'group', 'band', false, false, null),
  ('6acccccc-0000-0000-0000-000000000002', '6aaaaaaa-0000-0000-0000-0000000000b2', 'Shared Venue', 'group', 'venue', false, false, null),
  ('6acccccc-0000-0000-0000-000000000003', '6aaaaaaa-0000-0000-0000-0000000000b2', 'Hidden One', 'group', 'band', false, true, null);
-- Start Band claimed Old Band's listing of it.
update public.workspaces set listing_id = '6acccccc-0000-0000-0000-000000000001' where id = '6aaaaaaa-0000-0000-0000-0000000000a1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') - 'listing_id',
  '{"dismissed": false, "listing_filled": false, "members": 1, "network": 0, "linked": false}'::jsonb, 'a new band starts empty');
select is(public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') ->> 'listing_id', '6acccccc-0000-0000-0000-000000000001',
  'its page is the listing it claimed');
select is(public.getting_started('6aaaaaaa-0000-0000-0000-0000000000b2'), null, 'not for a band you''re not in');

-- Giving a shared venue a status puts it in the network; its own page doesn't count.
reset role;
insert into public.connection_band_details (workspace_id, connection_id, status) values
  ('6aaaaaaa-0000-0000-0000-0000000000a1', '6acccccc-0000-0000-0000-000000000002', 'homies'),
  ('6aaaaaaa-0000-0000-0000-0000000000a1', '6acccccc-0000-0000-0000-000000000001', 'homies');
insert into public.connections (workspace_id, name, kind, person_roles, created_by) values
  ('6aaaaaaa-0000-0000-0000-0000000000a1', 'Someone', 'person', '{musician}', null);
insert into public.connection_links (workspace_id, connection_id, url, position) values
  ('6aaaaaaa-0000-0000-0000-0000000000b2', '6acccccc-0000-0000-0000-000000000001', 'https://startband.example.com', 0);
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('6aaaaaaa-0000-0000-0000-0000000000a1', '6a222222-2222-2222-2222-222222222222', 'member', 'Two');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') ->> 'network')::int, 2,
  'added and status-given count; the band''s own page doesn''t');
select is((public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') ->> 'members')::int, 2, 'bandmates count');
select is((public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') ->> 'listing_filled')::boolean, true,
  'a link fills in the band''s page');

-- Put away, per person.
select lives_ok($$ select public.dismiss_getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') $$, 'put it away');
select is((public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') ->> 'dismissed')::boolean, true, 'it stays away');
select set_config('request.jwt.claims', '{"sub":"6a222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((public.getting_started('6aaaaaaa-0000-0000-0000-0000000000a1') ->> 'dismissed')::boolean, false,
  'a bandmate still sees it');

select * from finish();
rollback;
