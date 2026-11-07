-- Keeping a record private (phase 2, step 1): people start private, the rest
-- shared, your own band's page is always shared, and flipping it isn't an
-- edit. Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- Only this file's records: other data in the database (the local seed, say)
-- would show up as shared. Rolled back with the rest.
delete from public.connections;

insert into auth.users (id, email) values
  ('cd111111-1111-1111-1111-111111111111', 'share-alex@example.com'),
  ('cd222222-2222-2222-2222-222222222222', 'share-other@example.com');
insert into public.workspaces (id, name) values
  ('cdaaaaaa-0000-0000-0000-0000000000a1', 'Share Band'),
  ('cdaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('cdaaaaaa-0000-0000-0000-0000000000a1', 'cd111111-1111-1111-1111-111111111111', 'member', 'Alex'),
  ('cdaaaaaa-0000-0000-0000-0000000000b2', 'cd222222-2222-2222-2222-222222222222', 'member', 'Other');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, is_us) values
  ('cd500000-0000-0000-0000-000000000001', 'cdaaaaaa-0000-0000-0000-0000000000a1', 'Share Band', 'group', '{}', 'band', true),
  ('cd500000-0000-0000-0000-000000000002', 'cdaaaaaa-0000-0000-0000-0000000000a1', 'Share Venue', 'group', '{}', 'venue', false),
  ('cd500000-0000-0000-0000-000000000003', 'cdaaaaaa-0000-0000-0000-0000000000a1', 'Sam Example', 'person', '{booker}', null, false);
insert into public.connections (id, workspace_id, name, kind, person_roles, keep_private) values
  ('cd500000-0000-0000-0000-000000000004', 'cdaaaaaa-0000-0000-0000-0000000000a1', 'Pat Example', 'person', '{musician}', false);

select is((select string_agg(name || ':' || keep_private, ',' order by id) from public.connections
  where workspace_id = 'cdaaaaaa-0000-0000-0000-0000000000a1'),
  'Share Band:false,Share Venue:false,Sam Example:true,Pat Example:true',
  'people start private, everything else shared');

select throws_ok($$ update public.connections set keep_private = true where id = 'cd500000-0000-0000-0000-000000000001' $$,
  '23514', null, 'your own band''s page is always shared');

-- Flipping it isn't an edit. (Backdating skips triggers, so the stamp sticks.)
set local session_replication_role = replica;
update public.connections set updated_at = '2000-01-01T00:00:00Z' where id = 'cd500000-0000-0000-0000-000000000002';
set local session_replication_role = origin;
select is((select updated_at from public.connections where id = 'cd500000-0000-0000-0000-000000000002'),
  '2000-01-01T00:00:00Z'::timestamptz, '(setting up an old version)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cd111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok($$ update public.connections set keep_private = true where id = 'cd500000-0000-0000-0000-000000000002' $$,
  'a member keeps a record private');
select is((select keep_private::text || '|' || updated_at::text from public.connections where id = 'cd500000-0000-0000-0000-000000000002'),
  'true|' || '2000-01-01T00:00:00Z'::timestamptz::text, 'without changing when it was updated');
update public.connections set name = 'Share Venue Room' where id = 'cd500000-0000-0000-0000-000000000002';
select ok((select updated_at > now() - interval '1 minute' from public.connections where id = 'cd500000-0000-0000-0000-000000000002'),
  'a real edit still stamps it');
reset role;
set local session_replication_role = replica;
update public.connections set updated_at = '2000-01-01T00:00:00Z' where id = 'cd500000-0000-0000-0000-000000000002';
set local session_replication_role = origin;
set local role authenticated;
update public.connections set name = name where id = 'cd500000-0000-0000-0000-000000000002';
select ok((select updated_at > now() - interval '1 minute' from public.connections where id = 'cd500000-0000-0000-0000-000000000002'),
  'so does saving it unchanged, as before');
reset role;
set local session_replication_role = replica;
update public.connections set updated_at = '2000-01-01T00:00:00Z' where id = 'cd500000-0000-0000-0000-000000000002';
set local session_replication_role = origin;
set local role authenticated;
update public.connections set keep_private = false, name = 'Share Venue' where id = 'cd500000-0000-0000-0000-000000000002';
select ok((select updated_at > now() - interval '1 minute' from public.connections where id = 'cd500000-0000-0000-0000-000000000002'),
  'and an edit that also flips it');

select lives_ok($$ update public.connections set keep_private = false where id = 'cd500000-0000-0000-0000-000000000003' $$,
  'and shares a person');

-- Another band can't change it.
select set_config('request.jwt.claims', '{"sub":"cd222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.connections set keep_private = true where id = 'cd500000-0000-0000-0000-000000000003';
reset role;
select is((select keep_private from public.connections where id = 'cd500000-0000-0000-0000-000000000003'),
  false, 'another band can''t keep it private');

-- The rest of the band's people stay private.
select is((select count(*)::int from public.connections where kind = 'person' and not keep_private
  and workspace_id = 'cdaaaaaa-0000-0000-0000-0000000000a1'), 1, 'only the person they shared is shared');

select * from finish();
rollback;
