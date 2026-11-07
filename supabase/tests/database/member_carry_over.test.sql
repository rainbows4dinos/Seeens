-- Adding a member carries the band's town, scenes, and played together (#124).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

-- Fixtures with a band's private details (#181): staged, then split into
-- the record and this band's private layer.
create temp table tc as select * from public.connections with no data;
alter table tc add column status public.connection_status, add column played_together boolean,
  add column notes text, add column email text, add column phone text, add column archived_at timestamptz;

select plan(8);

insert into auth.users (id, email) values ('cb111111-1111-1111-1111-111111111111', 'carry-alex@example.com');
insert into public.workspaces (id, name) values ('cbaaaaaa-0000-0000-0000-0000000000a1', 'Carry Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name)
values ('cbaaaaaa-0000-0000-0000-0000000000a1', 'cb111111-1111-1111-1111-111111111111', 'owner', 'Alex');
insert into public.localities (id, workspace_id, name, region, country)
values ('cb100000-0000-0000-0000-000000000001', 'cbaaaaaa-0000-0000-0000-0000000000a1', 'Portland', 'Oregon', 'United States');
insert into public.scenes (id, workspace_id, name) values
  ('cb200000-0000-0000-0000-000000000001', 'cbaaaaaa-0000-0000-0000-0000000000a1', 'Basement shows'),
  ('cb200000-0000-0000-0000-000000000002', 'cbaaaaaa-0000-0000-0000-0000000000a1', 'Post-punk');
insert into tc (id, workspace_id, name, kind, person_roles, group_type, locality_id, played_together) values
  ('cbc00000-0000-0000-0000-000000000001', 'cbaaaaaa-0000-0000-0000-0000000000a1', 'Tin Band', 'group', '{}', 'band', 'cb100000-0000-0000-0000-000000000001', true),
  ('cbc00000-0000-0000-0000-000000000002', 'cbaaaaaa-0000-0000-0000-0000000000a1', 'Already Here', 'person', '{musician}', null, null, false);
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, locality_id) select id, workspace_id, name, kind, person_roles, group_type, locality_id from tc;
update public.connection_band_details d set played_together = coalesce(t.played_together, d.played_together) from tc t where d.connection_id = t.id;
truncate tc;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cb111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

create temp table made (k text primary key, id uuid) on commit drop;
grant all on made to authenticated;

-- Add Member > a new person, with the town and one scene carried over.
insert into made values ('new', public.create_linked_connection(
  'cbaaaaaa-0000-0000-0000-0000000000a1', 'cbc00000-0000-0000-0000-000000000001', true,
  'New Drummer', 'person', '{musician}', 'member', true, null, 'drums',
  'cb100000-0000-0000-0000-000000000001', '{cb200000-0000-0000-0000-000000000002}', true));

select is((select locality_id from public.connections where id = (select id from made where k = 'new')),
  'cb100000-0000-0000-0000-000000000001'::uuid, 'new member gets the town');
select is((select array_agg(scene_id) from public.connection_scenes where connection_id = (select id from made where k = 'new')),
  array['cb200000-0000-0000-0000-000000000002'::uuid], 'new member gets only the scenes picked');
select ok((select played_together from public.connections join public.connection_band_details on connection_id = id where id = (select id from made where k = 'new')), 'and played together');

-- Without the new arguments it works as before.
insert into made values ('plain', public.create_linked_connection(
  'cbaaaaaa-0000-0000-0000-0000000000a1', 'cbc00000-0000-0000-0000-000000000001', true,
  'Plain Bassist', 'person', '{musician}', 'member', true));
select is((select row(locality_id, played_together)::text from public.connections join public.connection_band_details on connection_id = id where id = (select id from made where k = 'plain')),
  '(,f)', 'nothing carried unless asked');

-- Paste Members: new people get what's carried; people already in the directory keep theirs.
select is(jsonb_array_length(public.add_band_members(
  'cbaaaaaa-0000-0000-0000-0000000000a1', 'cbc00000-0000-0000-0000-000000000001',
  '[{"name": "Pasted Singer", "roles": "vocals", "former": false, "person_id": null},
    {"name": "Already Here", "roles": "", "former": false, "person_id": "cbc00000-0000-0000-0000-000000000002"}]'::jsonb,
  'cb100000-0000-0000-0000-000000000001', '{cb200000-0000-0000-0000-000000000001}', true)), 2, 'both rows added');
select is((select row(locality_id is not null, played_together)::text from public.connections join public.connection_band_details on connection_id = id where name = 'Pasted Singer'),
  '(t,t)', 'pasted new person gets the town and played together');
select is((select count(*)::int from public.connection_scenes cs join public.connections c on c.id = cs.connection_id where c.name = 'Pasted Singer'),
  1, 'and the scene');
select is((select row(locality_id, played_together)::text from public.connections join public.connection_band_details on connection_id = id where name = 'Already Here'),
  '(,f)', 'an existing person keeps their own values');

select * from finish();
rollback;
