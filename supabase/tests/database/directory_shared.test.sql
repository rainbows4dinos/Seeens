-- The directory shows everything (#185, step 3b): this band's records and
-- what other bands share, with this band's status and archive, one town per
-- place, and never another band's private records or its own page.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Only this file's records: other data in the database (the local seed, say)
-- would show up as shared. Rolled back with the rest.
delete from public.connections;

insert into auth.users (id, email) values
  ('cf111111-1111-1111-1111-111111111111', 'dir-alex@example.com'),
  ('cf222222-2222-2222-2222-222222222222', 'dir-bea@example.com');
insert into public.workspaces (id, name) values
  ('cfaaaaaa-0000-0000-0000-0000000000a1', 'Dir Band A'),
  ('cfaaaaaa-0000-0000-0000-0000000000b2', 'Dir Band B');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('cfaaaaaa-0000-0000-0000-0000000000a1', 'cf111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('cfaaaaaa-0000-0000-0000-0000000000b2', 'cf222222-2222-2222-2222-222222222222', 'owner', 'Bea');
insert into public.places (id, name, ascii_name, country_code, country_name, latitude, longitude)
  values (900001, 'Dirtown', 'Dirtown', 'US', 'United States', 45, -122);
insert into public.localities (id, workspace_id, name, place_id) values
  ('cf400000-0000-0000-0000-0000000000a1', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'Dirtown', 900001),
  ('cf400000-0000-0000-0000-0000000000b1', 'cfaaaaaa-0000-0000-0000-0000000000b2', 'Dirtown', 900001);
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, is_us, locality_id) values
  ('cf500000-0000-0000-0000-000000000001', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'A Us', 'group', '{}', 'band', true, null),
  ('cf500000-0000-0000-0000-000000000002', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'A Venue', 'group', '{}', 'venue', false, 'cf400000-0000-0000-0000-0000000000a1'),
  ('cf500000-0000-0000-0000-000000000003', 'cfaaaaaa-0000-0000-0000-0000000000a1', 'A Person', 'person', '{booker}', null, false, null),
  ('cf500000-0000-0000-0000-000000000004', 'cfaaaaaa-0000-0000-0000-0000000000b2', 'B Us', 'group', '{}', 'band', true, null),
  ('cf500000-0000-0000-0000-000000000005', 'cfaaaaaa-0000-0000-0000-0000000000b2', 'B Band', 'group', '{}', 'band', false, 'cf400000-0000-0000-0000-0000000000b1');
update public.connection_band_details set status = 'homies' where connection_id = 'cf500000-0000-0000-0000-000000000002';

create function pg_temp.names(ws uuid, archived boolean default false, town uuid default null) returns text language sql as $$
  select coalesce(string_agg(c.name || ':' || (r ->> 'status'), ',' order by c.name), '')
  from jsonb_array_elements(public.directory_page(ws, archived, p_town => town, p_limit => 100) -> 'rows') r
  join public.connections c on c.id = (r ->> 'id')::uuid
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cf222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(pg_temp.names('cfaaaaaa-0000-0000-0000-0000000000b2'),
  'A Us:neutral,A Venue:neutral,B Band:neutral',
  'B sees its records and A''s shared ones, A''s status not among them, and not A''s private person or its own page');

insert into public.connection_band_details (workspace_id, connection_id, status)
  values ('cfaaaaaa-0000-0000-0000-0000000000b2', 'cf500000-0000-0000-0000-000000000002', 'lets_play');
select is(pg_temp.names('cfaaaaaa-0000-0000-0000-0000000000b2'),
  'A Us:neutral,A Venue:lets_play,B Band:neutral', 'with B''s own status once it sets one');

update public.connection_band_details set archived_at = now()
  where workspace_id = 'cfaaaaaa-0000-0000-0000-0000000000b2' and connection_id = 'cf500000-0000-0000-0000-000000000002';
select is(pg_temp.names('cfaaaaaa-0000-0000-0000-0000000000b2'), 'A Us:neutral,B Band:neutral', 'archiving hides it for B');
select is(pg_temp.names('cfaaaaaa-0000-0000-0000-0000000000b2', true), 'A Venue:lets_play', 'into B''s archived view');
select is((public.directory_page('cfaaaaaa-0000-0000-0000-0000000000b2', false) -> 'counts' ->> 'archived')::int, 1,
  'and B''s archived count');
update public.connection_band_details set archived_at = null
  where workspace_id = 'cfaaaaaa-0000-0000-0000-0000000000b2' and connection_id = 'cf500000-0000-0000-0000-000000000002';

select is((select jsonb_array_length(public.directory_page('cfaaaaaa-0000-0000-0000-0000000000b2', false) -> 'counts' -> 'towns')),
  1, 'two bands'' Dirtown is one town');
select is((public.directory_page('cfaaaaaa-0000-0000-0000-0000000000b2', false) -> 'counts' -> 'towns' -> 0 ->> 'id')::uuid,
  'cf400000-0000-0000-0000-0000000000b1'::uuid, 'as B''s own locality');
select is(pg_temp.names('cfaaaaaa-0000-0000-0000-0000000000b2', false, 'cf400000-0000-0000-0000-0000000000b1'),
  'A Venue:lets_play,B Band:neutral', 'and filtering by it finds both bands'' records there');

select set_config('request.jwt.claims', '{"sub":"cf111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(pg_temp.names('cfaaaaaa-0000-0000-0000-0000000000a1'),
  'A Person:neutral,A Venue:homies,B Band:neutral,B Us:neutral', 'A''s side: its own status, untouched by B''s');

select * from finish();
rollback;
