-- Writing the private layer (#181, step 2): members change their own band's
-- row, it syncs back to the old columns, and nobody else can touch it.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('cc111111-1111-1111-1111-111111111111', 'write-alex@example.com'),
  ('cc222222-2222-2222-2222-222222222222', 'write-other@example.com');
insert into public.workspaces (id, name) values
  ('ccaaaaaa-0000-0000-0000-0000000000a1', 'Write Band'),
  ('ccaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('ccaaaaaa-0000-0000-0000-0000000000a1', 'cc111111-1111-1111-1111-111111111111', 'member', 'Alex'),
  ('ccaaaaaa-0000-0000-0000-0000000000b2', 'cc222222-2222-2222-2222-222222222222', 'member', 'Other');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('cc500000-0000-0000-0000-000000000001', 'ccaaaaaa-0000-0000-0000-0000000000a1', 'Write Venue', 'group', '{}', 'venue');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cc111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok($$ update public.connection_band_details set status = 'lets_play', notes = 'Ask about Fridays'
  where connection_id = 'cc500000-0000-0000-0000-000000000001' $$, 'a member changes their band''s private details');
select is((select status::text || '|' || notes from public.connections where id = 'cc500000-0000-0000-0000-000000000001'),
  'lets_play|Ask about Fridays', 'the old columns follow');
select is((select changed_by from public.connection_status_changes
  where connection_id = 'cc500000-0000-0000-0000-000000000001' order by id desc limit 1),
  'cc111111-1111-1111-1111-111111111111'::uuid, 'status history names the member');
select is((select count(*)::int from public.connection_status_changes
  where connection_id = 'cc500000-0000-0000-0000-000000000001'), 2, 'one history row per change, no echoes');

select lives_ok($$ update public.connection_band_details set archived_at = now()
  where connection_id = 'cc500000-0000-0000-0000-000000000001' $$, 'archive');
select isnt((select archived_at from public.connections where id = 'cc500000-0000-0000-0000-000000000001'), null,
  'archiving reaches the old column');

select throws_ok($$ update public.connection_band_details set connection_id = 'cc500000-0000-0000-0000-000000000009'
  where connection_id = 'cc500000-0000-0000-0000-000000000001' $$, '42501', null, 'can''t move a row to another record');
select throws_ok($$ delete from public.connection_band_details $$, '42501', null, 'can''t delete rows');

-- The old way still works and syncs forward, without looping.
select lives_ok($$ update public.connections set status = 'homies', archived_at = null
  where id = 'cc500000-0000-0000-0000-000000000001' $$, 'writing the old columns still works');
select is((select status::text || '|' || (archived_at is null) from public.connection_band_details
  where connection_id = 'cc500000-0000-0000-0000-000000000001'), 'homies|true', 'and reaches the private layer');

-- Another band can't touch it.
select set_config('request.jwt.claims', '{"sub":"cc222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.connection_band_details set status = 'avoid' where connection_id = 'cc500000-0000-0000-0000-000000000001';
reset role;
select is((select status::text from public.connection_band_details where connection_id = 'cc500000-0000-0000-0000-000000000001'),
  'homies', 'another band''s update changes nothing');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cc222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ insert into public.connection_band_details (workspace_id, connection_id, status)
  values ('ccaaaaaa-0000-0000-0000-0000000000a1', 'cc500000-0000-0000-0000-000000000001', 'avoid') $$,
  '42501', null, 'or add a row for a band it''s not in');

set local role anon;
select throws_ok($$ update public.connection_band_details set status = 'avoid' $$, '42501', null, 'anon can''t write');

select * from finish();
rollback;
