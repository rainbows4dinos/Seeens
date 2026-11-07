-- The private layer (#181, step 1): a copy of each band's status, notes,
-- contacts, played together, and archive, kept in sync and private.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('cb111111-1111-1111-1111-111111111111', 'layer-alex@example.com'),
  ('cb222222-2222-2222-2222-222222222222', 'layer-other@example.com');
insert into public.workspaces (id, name) values
  ('cbaaaaaa-0000-0000-0000-0000000000a1', 'Layer Band'),
  ('cbaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('cbaaaaaa-0000-0000-0000-0000000000a1', 'cb111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('cbaaaaaa-0000-0000-0000-0000000000b2', 'cb222222-2222-2222-2222-222222222222', 'owner', 'Other');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, status, notes, email) values
  ('cb500000-0000-0000-0000-000000000001', 'cbaaaaaa-0000-0000-0000-0000000000a1', 'Layer Venue', 'group', '{}', 'venue',
   'avoid', 'Never paid us', 'booking@example.com');

select is((select status::text || '|' || notes || '|' || email from public.connection_band_details
  where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  'avoid|Never paid us|booking@example.com', 'a new record gets its private layer');

update public.connections set status = 'homies', played_together = true, phone = '555-0100', notes = null
where id = 'cb500000-0000-0000-0000-000000000001';
select is((select status::text || '|' || played_together || '|' || phone || '|' || coalesce(notes, 'none')
  from public.connection_band_details where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  'homies|true|555-0100|none', 'changes follow');

update public.connections set archived_at = now() where id = 'cb500000-0000-0000-0000-000000000001';
select isnt((select archived_at from public.connection_band_details where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  null, 'archiving is part of the private layer');

update public.connections set name = 'Layer Venue (renamed)' where id = 'cb500000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.connection_band_details where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  1, 'still one row per band and record');

-- Every existing record has its copy (the backfill), with matching values.
select is((select count(*)::int from public.connections c
  left join public.connection_band_details d on d.workspace_id = c.workspace_id and d.connection_id = c.id
  where d.connection_id is null), 0, 'no record is missing its private layer');
select is((select count(*)::int from public.connections c
  join public.connection_band_details d on d.workspace_id = c.workspace_id and d.connection_id = c.id
  where (c.status, c.played_together, c.notes, c.email, c.phone, c.archived_at)
    is distinct from (d.status, d.played_together, d.notes, d.email, d.phone, d.archived_at)), 0, 'and every copy matches');

-- Private to the band.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cb111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.connection_band_details where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  1, 'the band reads its own');
select throws_ok($$ update public.connection_band_details set status = 'neutral' $$, '42501', null,
  'no writing it directly yet');

select set_config('request.jwt.claims', '{"sub":"cb222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.connection_band_details where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  0, 'another band can''t read it, Avoid and notes included');

set local role anon;
select throws_ok($$ select * from public.connection_band_details $$, '42501', null, 'anon gets nothing');

reset role;

-- Deleting the record (a purge) takes its private layer with it.
delete from public.connections where id = 'cb500000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.connection_band_details where connection_id = 'cb500000-0000-0000-0000-000000000001'),
  0, 'a deleted record leaves nothing behind');
select is((select count(*)::int from public.connection_band_details d
  where not exists (select 1 from public.connections c where c.id = d.connection_id)), 0, 'no orphans');

select * from finish();
rollback;
