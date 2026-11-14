-- Spreadsheet import (#148). Run with: npm run db:test.
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

-- Fixtures with a band's private details (#181): staged, then split into
-- the record and this band's private layer.
create temp table tc as select * from public.connections with no data;
alter table tc add column status public.connection_status, add column played_together boolean,
  add column notes text, add column email text, add column phone text, add column archived_at timestamptz;

select plan(22);

insert into auth.users (id, email) values ('d1111111-1111-1111-1111-111111111111', 'import-alex@example.com');
insert into public.workspaces (id, name) values ('d1aaaaaa-0000-0000-0000-0000000000a1', 'Import Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name)
values ('d1aaaaaa-0000-0000-0000-0000000000a1', 'd1111111-1111-1111-1111-111111111111', 'owner', 'Alex');

-- Already in the directory: a venue with some details, and Joel.
insert into tc (id, workspace_id, name, kind, person_roles, group_type, status, email, notes, attributes) values
  ('d1c00000-0000-0000-0000-000000000001', 'd1aaaaaa-0000-0000-0000-0000000000a1', 'Dantes', 'group', '{}', 'venue', 'homies',
   'old@dantes.example', 'We love it here.', '{"ages": "21_plus", "checked_on": "2025-01-01"}'),
  ('d1c00000-0000-0000-0000-000000000002', 'd1aaaaaa-0000-0000-0000-0000000000a1', 'Joel', 'person', '{booker}', null, 'neutral', null, null, '{}'),
  ('d1c00000-0000-0000-0000-000000000003', 'd1aaaaaa-0000-0000-0000-0000000000a1', 'Riley Example', 'person', '{musician}', null, 'neutral', null, null, '{}'),
  ('d1c00000-0000-0000-0000-000000000004', 'd1aaaaaa-0000-0000-0000-0000000000a1', 'Chris', 'person', '{booker}', null, 'neutral', null, null, '{}');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, attributes) select id, workspace_id, name, kind, person_roles, group_type, attributes from tc;
update public.connection_band_details d set status = coalesce(t.status, d.status), email = t.email, notes = t.notes from tc t where d.connection_id = t.id;
truncate tc;
insert into public.connection_links (workspace_id, connection_id, label, url, position) values
  ('d1aaaaaa-0000-0000-0000-0000000000a1', 'd1c00000-0000-0000-0000-000000000001', 'Website', 'https://dantes.example', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  public.import_connections('d1aaaaaa-0000-0000-0000-0000000000a1', $$[
    {"name": "Fixin' To", "kind": "group", "group_type": "venue", "person_roles": [], "status": "neutral",
     "place_id": null, "email": "booking@fixinto.example", "notes": "Great sound",
     "links": [], "scenes": ["Portland DIY"], "venue": {"ages": "21_plus", "capacity": "50_150", "book_via": "email"},
     "booked_by": ["Joel", "Honey Latte Presents"]},
    {"name": "The Barf Bags", "kind": "group", "group_type": "band", "person_roles": [], "status": "neutral",
     "links": [{"label": "Instagram", "url": "https://instagram.com/barfbags"}], "scenes": [], "venue": {}, "booked_by": []},
    {"name": "Dantes", "match_id": "d1c00000-0000-0000-0000-000000000001", "kind": "group", "group_type": "venue",
     "email": "new@dantes.example", "notes": "Not sure: booked by Chris?",
     "links": [{"label": "Website", "url": "https://DANTES.example"}, {"label": "Instagram", "url": "https://instagram.com/dantes"}],
     "scenes": ["Portland DIY"], "venue": {"ages": "all_ages", "capacity": "150_300"}, "booked_by": ["Ian"]}
  ]$$::jsonb),
  '{"added": 2, "filled": 1, "bookers_added": 2, "booking_links": 3, "member_links": 0}'::jsonb,
  'adds new rows, fills one, and links bookers');

-- New rows land like a form save.
select is((select row(group_type::text, email, notes, attributes ->> 'capacity', (attributes ? 'checked_on'))::text
  from public.connections join public.connection_band_details on connection_id = id where name = 'Fixin'' To'),
  '(venue,booking@fixinto.example,"Great sound",50_150,t)', 'a new venue, with its details stamped');
select is((select count(*)::int from public.connection_scenes cs join public.scenes s on s.id = cs.scene_id
  where s.name = 'Portland DIY'), 2, 'scenes by name: one scene, two connections');
select is((select l.url from public.connection_links l join public.connections c on c.id = l.connection_id
  where c.name = 'The Barf Bags'), 'https://instagram.com/barfbags', 'links');

-- Fill blanks: what's there stays.
select is((select email from public.connections join public.connection_band_details on connection_id = id where id = 'd1c00000-0000-0000-0000-000000000001'),
  'old@dantes.example', 'an existing email is kept');
select is((select notes from public.connections join public.connection_band_details on connection_id = id where id = 'd1c00000-0000-0000-0000-000000000001'),
  E'We love it here.\n\nNot sure: booked by Chris?', 'sheet notes go under the existing ones');
select is((select attributes - 'checked_on' from public.connections where id = 'd1c00000-0000-0000-0000-000000000001'),
  '{"ages": "21_plus", "capacity": "150_300"}'::jsonb, 'existing details win; missing ones are added');
select is((select status::text from public.connections join public.connection_band_details on connection_id = id where id = 'd1c00000-0000-0000-0000-000000000001'),
  'homies', 'status is left alone');
select is((select array_agg(url order by position) from public.connection_links where connection_id = 'd1c00000-0000-0000-0000-000000000001'),
  array['https://dantes.example', 'https://instagram.com/dantes'], 'only new links are added, after the old ones');

-- Bookers
select is((select array_agg(b.name || ':' || b.kind::text || ':' || coalesce(b.group_type::text, array_to_string(b.person_roles, ','))
    order by b.name)
  from public.affiliations a join public.connections b on b.id = a.from_connection_id
  where a.kind = 'books'),
  array['Honey Latte Presents:group:promoter_collective', 'Ian:person:booker', 'Joel:person:booker'],
  'existing Joel is reused; new bookers and promoters are added');

-- Filling in a band (#321): the same page however it's written, one
-- Instagram and one Bandcamp, and its members.
select is(
  public.import_connections('d1aaaaaa-0000-0000-0000-0000000000a1', format($$[
    {"name": "Barf Bags", "match_id": "%s", "kind": "group", "group_type": "band",
     "links": [{"label": "Instagram", "url": "https://www.instagram.com/BarfBags/?hl=en"},
               {"label": "Instagram", "url": "https://instagram.com/someone_else"},
               {"label": "Bandcamp", "url": "https://barfbags.bandcamp.com"},
               {"label": "Bandcamp", "url": "https://barfbagsofficial.bandcamp.com"},
               {"label": "Website", "url": "https://barfbags.example/?ref=x"},
               {"label": "Website", "url": "http://barfbags.example"},
               {"label": "Website", "url": "https://barfbags-merch.example"}],
     "scenes": [], "venue": {}, "booked_by": [], "members": ["Riley Example", "Chris", "Chris", "Sam Example"]}
  ]$$, (select id from public.connections where name = 'The Barf Bags'))::jsonb),
  '{"added": 0, "filled": 1, "bookers_added": 0, "booking_links": 0, "member_links": 3}'::jsonb,
  'fills in a band with links and members');
select is((select array_agg(l.url order by l.position) from public.connection_links l
    join public.connections c on c.id = l.connection_id where c.name = 'The Barf Bags'),
  array['https://instagram.com/barfbags', 'https://barfbags.bandcamp.com', 'https://barfbags.example/?ref=x',
    'https://barfbags-merch.example'],
  'no second copy of a page, no second Instagram or Bandcamp; more than one website is fine');
select is((select array_agg(p.name || ':' || array_to_string(p.person_roles, ',') order by p.name)
  from public.affiliations a join public.connections p on p.id = a.from_connection_id
  join public.connections b on b.id = a.to_connection_id
  where a.kind = 'member' and b.name = 'The Barf Bags'),
  array['Chris:musician', 'Riley Example:musician', 'Sam Example:musician'], 'members are linked');
select is((select count(*)::int from public.connections where name = 'Riley Example'), 1,
  'a full name that''s one person here is reused');
select is((select count(*)::int from public.connections where name = 'Chris'), 2,
  'a first name alone isn''t matched to someone else');
select is(
  public.import_connections('d1aaaaaa-0000-0000-0000-0000000000a1', format($$[
    {"name": "Barf Bags", "match_id": "%s", "kind": "group", "group_type": "band",
     "links": [], "scenes": [], "venue": {}, "booked_by": [], "members": ["Chris", "Sam Example"]}
  ]$$, (select id from public.connections where name = 'The Barf Bags'))::jsonb) ->> 'member_links',
  '0', 'importing the same members again changes nothing');
select is((select count(*)::int from public.connections where name in ('Chris', 'Sam Example')), 3,
  'and adds no one');

-- Members with roles, like Paste Lineup (#321): roles go on the link,
-- former members are linked as former, and a member with no roles gets them.
select is(
  public.import_connections('d1aaaaaa-0000-0000-0000-0000000000a1', format($$[
    {"name": "Barf Bags", "match_id": "%s", "kind": "group", "group_type": "band",
     "links": [], "scenes": [], "venue": {}, "booked_by": [],
     "members": [{"name": "Sam Example", "roles": "Bass, Vocals", "former": false},
                 {"name": "Dee Example", "roles": "Drums", "former": true}]}
  ]$$, (select id from public.connections where name = 'The Barf Bags'))::jsonb) ->> 'member_links',
  '1', 'a new member is linked; one already there isn''t linked twice');
select is((select array_agg(p.name || ':' || coalesce(a.role, '-') || ':' || a.is_current::text order by p.name)
  from public.affiliations a join public.connections p on p.id = a.from_connection_id
  join public.connections b on b.id = a.to_connection_id
  where a.kind = 'member' and b.name = 'The Barf Bags' and p.name in ('Sam Example', 'Dee Example')),
  array['Dee Example:Drums:false', 'Sam Example:Bass, Vocals:true'],
  'roles are kept, and a former member is linked as former');
select is((select count(*)::int from public.connections where name = 'Sam Example'), 1, 'and no one is added twice');

-- All or nothing.
select throws_ok(
  $$select public.import_connections('d1aaaaaa-0000-0000-0000-0000000000a1', '[
    {"name": "Good Row", "kind": "group", "group_type": "band", "status": "neutral", "links": [], "scenes": [], "venue": {}},
    {"name": "Bad Row", "kind": "group", "group_type": "spaceship", "status": "neutral", "links": [], "scenes": [], "venue": {}}
  ]'::jsonb)$$,
  '22P02', null, 'a bad row fails the whole import');
select is((select count(*)::int from public.connections where name = 'Good Row'), 0, 'and nothing from it is saved');

select * from finish();
rollback;
