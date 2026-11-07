-- What people play, and "close to us" (#140). Run with: npm run db:test.
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

-- Fixtures with a band's private details (#181): staged, then split into
-- the record and this band's private layer.
create temp table tc as select * from public.connections with no data;
alter table tc add column status public.connection_status, add column played_together boolean,
  add column notes text, add column email text, add column phone text, add column archived_at timestamptz;

select plan(10);

-- role_instruments
select is(public.role_instruments('Vocals, Guitar') @> array['vocals', 'guitar'] and cardinality(public.role_instruments('Vocals, Guitar')) = 2,
  true, 'a plain role');
select is(public.role_instruments('vox / keys'), array['keyboards', 'vocals'], 'shorthand');
select is(public.role_instruments(' Lead Vocals & Rhythm  Guitar. '), array['guitar', 'vocals'], 'lead and rhythm fold in; spaces and dots ignored');
select is(public.role_instruments('merch, band leader'), '{}'::text[], 'not instruments; "band" is not split on "and"');
select is(public.role_instruments(null), '{}'::text[], 'no role');

insert into auth.users (id, email) values ('ce111111-1111-1111-1111-111111111111', 'inst-alex@example.com');
insert into public.workspaces (id, name) values ('ceaaaaaa-0000-0000-0000-0000000000a1', 'Inst Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name)
values ('ceaaaaaa-0000-0000-0000-0000000000a1', 'ce111111-1111-1111-1111-111111111111', 'owner', 'Alex');

-- Two bands, and people who are Heard of, Avoid, or Crush themselves.
insert into tc (id, workspace_id, name, kind, person_roles, group_type, status, archived_at) values
  ('cec00000-0000-0000-0000-000000000001', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Homie Band', 'group', '{}', 'band', 'homies', null),
  ('cec00000-0000-0000-0000-000000000002', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Avoid Band', 'group', '{}', 'band', 'avoid', null),
  ('cec00000-0000-0000-0000-000000000011', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Jo Drums', 'person', '{musician}', null, 'neutral', null),
  ('cec00000-0000-0000-0000-000000000012', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Ana Avoided', 'person', '{musician}', null, 'avoid', null),
  ('cec00000-0000-0000-0000-000000000013', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Cy Crush', 'person', '{musician}', null, 'prospect', null),
  ('cec00000-0000-0000-0000-000000000014', 'ceaaaaaa-0000-0000-0000-0000000000a1', 'Ed Elsewhere', 'person', '{musician}', null, 'neutral', null);
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) select id, workspace_id, name, kind, person_roles, group_type from tc;
update public.connection_band_details d set status = coalesce(t.status, d.status), archived_at = t.archived_at from tc t where d.connection_id = t.id;
truncate tc;

insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, role, is_current) values
  -- Jo drums in a Homie band now and played bass in the Avoid band.
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'cec00000-0000-0000-0000-000000000011', 'cec00000-0000-0000-0000-000000000001', 'member', 'drums', true),
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'cec00000-0000-0000-0000-000000000011', 'cec00000-0000-0000-0000-000000000002', 'member', 'bass', false),
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'cec00000-0000-0000-0000-000000000012', 'cec00000-0000-0000-0000-000000000001', 'member', 'vox', true),
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'cec00000-0000-0000-0000-000000000013', 'cec00000-0000-0000-0000-000000000001', 'member', 'gtr', true),
  -- Ed is only in the Avoid band.
  ('ceaaaaaa-0000-0000-0000-0000000000a1', 'cec00000-0000-0000-0000-000000000014', 'cec00000-0000-0000-0000-000000000002', 'member', 'bass guitar', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ce111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

create function pg_temp.people(r jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(c.name, jsonb_build_array(e ->> 'status', e ->> 'via')), '{}')
  from jsonb_array_elements(r -> 'rows') e
  join public.connections c on c.id = (e ->> 'id')::uuid
  where c.kind = 'person'
$$;

select is(pg_temp.people(public.directory_page('ceaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'people', p_hide_avoid => false)),
  '{"Jo Drums": ["homies", "Homie Band"], "Ana Avoided": ["avoid", null], "Cy Crush": ["prospect", null], "Ed Elsewhere": ["neutral", null]}'::jsonb,
  'Heard of takes the closest current band; a set status wins; an Avoid band never pulls anyone there');
select is((public.directory_page('ceaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'people', p_statuses => '{homies}') -> 'counts' ->> 'matched')::int,
  1, 'the status filter goes by it too');
select is(pg_temp.people(public.directory_page('ceaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'people', p_instrument => 'bass')),
  '{"Jo Drums": ["homies", "Homie Band"], "Ed Elsewhere": ["neutral", null]}'::jsonb,
  'Plays: bass, from current and former bands');
select is((public.directory_page('ceaaaaaa-0000-0000-0000-0000000000a1', false, p_type => 'all', p_instrument => 'drums') -> 'counts' ->> 'matched')::int,
  1, 'groups never match an instrument');
select is(public.directory_page('ceaaaaaa-0000-0000-0000-0000000000a1', false) -> 'counts' -> 'instruments',
  '["bass", "drums", "guitar", "vocals"]'::jsonb, 'the instruments people here play');

select * from finish();
rollback;
