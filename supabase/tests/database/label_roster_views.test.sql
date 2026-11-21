-- A label's roster (#357): its listing shows it to everyone, and the
-- Directory can show just its current bands.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('8d111111-1111-1111-1111-111111111111', 'lr-label@example.com'),
  ('8d222222-2222-2222-2222-222222222222', 'lr-band@example.com');
insert into public.workspaces (id, name, kind) values
  ('8daaaaaa-0000-0000-0000-0000000000a1', 'Spare Records', 'label'),
  ('8daaaaaa-0000-0000-0000-0000000000a2', 'Other Band', 'band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('8daaaaaa-0000-0000-0000-0000000000a1', '8d111111-1111-1111-1111-111111111111', 'owner', 'Tam'),
  ('8daaaaaa-0000-0000-0000-0000000000a2', '8d222222-2222-2222-2222-222222222222', 'owner', 'Bo');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, keep_private, created_by) values
  ('8dcccccc-0000-0000-0000-000000000001', '8daaaaaa-0000-0000-0000-0000000000a1', 'Spare Records', 'group', 'label', '{}', true, false, null),
  ('8dcccccc-0000-0000-0000-000000000002', '8daaaaaa-0000-0000-0000-0000000000a1', 'Roster Band', 'group', 'band', '{}', false, false, null),
  ('8dcccccc-0000-0000-0000-000000000003', '8daaaaaa-0000-0000-0000-0000000000a1', 'Past Band', 'group', 'band', '{}', false, false, null),
  ('8dcccccc-0000-0000-0000-000000000004', '8daaaaaa-0000-0000-0000-0000000000a1', 'Stranger Band', 'group', 'band', '{}', false, false, null),
  ('8dcccccc-0000-0000-0000-000000000005', '8daaaaaa-0000-0000-0000-0000000000a1', 'Secret Band', 'group', 'band', '{}', false, true, null);
update public.workspaces set listing_id = '8dcccccc-0000-0000-0000-000000000001' where id = '8daaaaaa-0000-0000-0000-0000000000a1';
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current) values
  ('8daaaaaa-0000-0000-0000-0000000000a1', '8dcccccc-0000-0000-0000-000000000002', '8dcccccc-0000-0000-0000-000000000001', 'on_label', true),
  ('8daaaaaa-0000-0000-0000-0000000000a1', '8dcccccc-0000-0000-0000-000000000003', '8dcccccc-0000-0000-0000-000000000001', 'on_label', false),
  ('8daaaaaa-0000-0000-0000-0000000000a1', '8dcccccc-0000-0000-0000-000000000005', '8dcccccc-0000-0000-0000-000000000001', 'on_label', true);

set local role authenticated;

-- Another band sees the label's shared roster, current first; not a private band.
select set_config('request.jwt.claims', '{"sub":"8d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select string_agg(name || ':' || is_current, ',') from public.listing_roster('8dcccccc-0000-0000-0000-000000000001')),
  'Roster Band:true,Past Band:false', 'anyone sees a label''s roster, current first, not a private band');
select is((select count(*)::int from public.listing_roster('8dcccccc-0000-0000-0000-000000000002')), 0, 'a band has no roster');

-- The label sees its private band too.
select set_config('request.jwt.claims', '{"sub":"8d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.listing_roster('8dcccccc-0000-0000-0000-000000000001')), 3, 'the label sees its own private band');

-- On Our Roster in the Directory: current bands only.
create function pg_temp.names(ws uuid, roster boolean) returns text language sql as $$
  select coalesce(string_agg(c.name, ',' order by c.name), '')
  from jsonb_array_elements(public.directory_page(ws, false, p_limit => 100, p_roster => roster) -> 'rows') r
  join public.connections c on c.id = (r ->> 'id')::uuid
$$;
select is(pg_temp.names('8daaaaaa-0000-0000-0000-0000000000a1', true), 'Roster Band,Secret Band', 'the label''s current bands');
select ok(pg_temp.names('8daaaaaa-0000-0000-0000-0000000000a1', false) like '%Past Band%Stranger Band%',
  'everyone without it, past and off-roster bands too');

select set_config('request.jwt.claims', '{"sub":"8d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(pg_temp.names('8daaaaaa-0000-0000-0000-0000000000a2', true), '', 'a band has no roster to filter by');

select * from finish();
rollback;
