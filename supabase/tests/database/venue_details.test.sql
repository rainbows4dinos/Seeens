-- Venue details and "books" links (#48). Run with: npm run db:test.
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

-- Fixtures with a band's private details (#181): staged, then split into
-- the record and this band's private layer.
create temp table tc as select * from public.connections with no data;
alter table tc add column status public.connection_status, add column played_together boolean,
  add column notes text, add column email text, add column phone text, add column archived_at timestamptz;

select plan(13);

-- Only this file's records: other data in the database (the local seed, say)
-- would show up as shared. Rolled back with the rest.
delete from public.connections;

insert into auth.users (id, email) values ('cf111111-1111-1111-1111-111111111111', 'venue-alex@example.com');
insert into public.workspaces (id, name) values ('cfaaaaaa-0000-0000-0000-0000000000a1', 'Venue Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name)
values ('cfaaaaaa-0000-0000-0000-0000000000a1', 'cf111111-1111-1111-1111-111111111111', 'owner', 'Alex');

insert into tc (id, workspace_id, name, kind, person_roles, group_type, status, attributes) values
  ('cfc00000-0000-0000-0000-000000000001', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'Basement', 'group', '{}', 'venue', 'neutral',
   '{"ages": "all_ages", "capacity": "under_50", "space": "diy", "checked_on": "2025-01-01", "from_import": "keep me"}'),
  ('cfc00000-0000-0000-0000-000000000002', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'Big Room', 'group', '{}', 'venue', 'neutral',
   '{"ages": "21_plus", "capacity": "300_600"}'),
  ('cfc00000-0000-0000-0000-000000000003', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'No Details', 'group', '{}', 'venue', 'neutral', '{}'),
  ('cfc00000-0000-0000-0000-000000000004', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'Corner Dive', 'group', '{}', 'venue', 'neutral',
   '{"venue_types": ["dive_bar", "art_space"], "space": "licensed"}'),
  ('cfc00000-0000-0000-0000-000000000011', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'Joel', 'person', '{booker}', null, 'neutral', '{}');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, attributes) select id, workspace_id, name, kind, person_roles, group_type, attributes from tc;
update public.connection_band_details d set status = coalesce(t.status, d.status) from tc t where d.connection_id = t.id;
truncate tc;

select throws_ok(
  $$update public.connections set attributes = '[]' where id = 'cfc00000-0000-0000-0000-000000000003'$$,
  '23514', null, 'attributes is always an object');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cf111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Filters
select is(
  (select array_agg(r ->> 'id' order by r ->> 'id') from jsonb_array_elements(
    public.directory_page('cfaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues', p_ages => 'all_ages') -> 'rows') r),
  array['cfc00000-0000-0000-0000-000000000001'], 'Ages filter');
select is(
  (select array_agg(r ->> 'id' order by r ->> 'id') from jsonb_array_elements(
    public.directory_page('cfaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues', p_capacity => '300_600') -> 'rows') r),
  array['cfc00000-0000-0000-0000-000000000002'], 'Capacity filter');
select is(
  (public.directory_page('cfaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues') -> 'counts' ->> 'matched')::int,
  4, 'no filter: every venue, with or without details');
-- Space (#262): one type, or DIY or licensed.
select is(
  (select array_agg(r ->> 'id' order by r ->> 'id') from jsonb_array_elements(
    public.directory_page('cfaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues', p_space => 'art_space') -> 'rows') r),
  array['cfc00000-0000-0000-0000-000000000004'], 'Space filter: a type');
select is(
  (select array_agg(r ->> 'id' order by r ->> 'id') from jsonb_array_elements(
    public.directory_page('cfaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues', p_space => 'diy') -> 'rows') r),
  array['cfc00000-0000-0000-0000-000000000001'], 'Space filter: DIY');
select is(
  (select array_agg(r ->> 'id' order by r ->> 'id') from jsonb_array_elements(
    public.directory_page('cfaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'venues', p_space => 'licensed') -> 'rows') r),
  array['cfc00000-0000-0000-0000-000000000004'], 'Space filter: licensed');

-- Saving: unchanged details keep their date; changed ones get today's.
create temp table saved (id uuid) on commit drop;
grant all on saved to authenticated;
select lives_ok($$select public.save_connection(
    p_workspace_id => 'cfaaaaaa-0000-0000-0000-0000000000a1', p_id => 'cfc00000-0000-0000-0000-000000000001',
    p_name => 'Basement', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]',
    p_attributes => '{"ages": "all_ages", "capacity": "under_50", "space": "diy", "from_import": "keep me"}')$$,
  'a save with the same details');
select is((select attributes ->> 'checked_on' from public.connections where id = 'cfc00000-0000-0000-0000-000000000001'),
  '2025-01-01', 'unchanged details keep their checked date');
select lives_ok($$select public.save_connection(
    p_workspace_id => 'cfaaaaaa-0000-0000-0000-0000000000a1', p_id => 'cfc00000-0000-0000-0000-000000000001',
    p_name => 'Basement', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]',
    p_attributes => '{"ages": "varies", "capacity": "under_50", "space": "diy", "from_import": "keep me"}')$$,
  'a save with a changed detail');
select is((select attributes from public.connections where id = 'cfc00000-0000-0000-0000-000000000001'),
  jsonb_build_object('ages', 'varies', 'capacity', 'under_50', 'space', 'diy', 'from_import', 'keep me', 'checked_on', current_date),
  'changed details are saved and stamped today');
select lives_ok($$select public.save_connection(
    p_workspace_id => 'cfaaaaaa-0000-0000-0000-0000000000a1', p_id => 'cfc00000-0000-0000-0000-000000000002',
    p_name => 'Big Room', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]')$$,
  'a save without details (another type''s form)');
select is((select attributes from public.connections where id = 'cfc00000-0000-0000-0000-000000000002'),
  '{"ages": "21_plus", "capacity": "300_600"}'::jsonb, 'leaves the details alone');

select * from finish();
rollback;
