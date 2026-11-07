-- The private layer (#181): each band's status, played together, notes,
-- contacts, and archive live only here. Every record gets its band's row,
-- members change only their own band's, and status history is logged from it.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('cc111111-1111-1111-1111-111111111111', 'layer-alex@example.com'),
  ('cc222222-2222-2222-2222-222222222222', 'layer-other@example.com');
insert into public.workspaces (id, name) values
  ('ccaaaaaa-0000-0000-0000-0000000000a1', 'Layer Band'),
  ('ccaaaaaa-0000-0000-0000-0000000000b2', 'Other Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('ccaaaaaa-0000-0000-0000-0000000000a1', 'cc111111-1111-1111-1111-111111111111', 'member', 'Alex'),
  ('ccaaaaaa-0000-0000-0000-0000000000b2', 'cc222222-2222-2222-2222-222222222222', 'member', 'Other');
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('cc500000-0000-0000-0000-000000000001', 'ccaaaaaa-0000-0000-0000-0000000000a1', 'Layer Venue', 'group', '{}', 'venue');

select hasnt_column('public', 'connections', 'status', 'status is gone from the record');
select hasnt_column('public', 'connections', 'notes', 'and notes');
select is((select status::text || '|' || played_together || '|' || (archived_at is null)
  from public.connection_band_details where connection_id = 'cc500000-0000-0000-0000-000000000001'),
  'neutral|false|true', 'a new record gets its band''s row');
select is((select count(*)::int from public.connection_status_changes
  where connection_id = 'cc500000-0000-0000-0000-000000000001'), 1, 'with a starting status');

-- A status set while the record is being created is its starting status.
update public.connection_band_details set status = 'prospect' where connection_id = 'cc500000-0000-0000-0000-000000000001';
select is((select string_agg(coalesce(from_status::text, '-') || '>' || to_status, ',' order by id)
  from public.connection_status_changes where connection_id = 'cc500000-0000-0000-0000-000000000001'),
  '->prospect', 'one starting entry, not two');

-- Later changes (another transaction; this file is one) are logged, by the member.
update public.connection_status_changes set changed_at = now() - interval '1 day'
where connection_id = 'cc500000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cc111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.connection_band_details set status = 'lets_play', notes = 'Ask about Fridays', archived_at = now()
  where connection_id = 'cc500000-0000-0000-0000-000000000001' $$, 'a member changes their band''s private details');
select is((select string_agg(coalesce(from_status::text, '-') || '>' || to_status || ':' || coalesce(changed_by::text, ''), ',' order by id)
  from public.connection_status_changes where connection_id = 'cc500000-0000-0000-0000-000000000001'),
  '->prospect:,prospect>lets_play:cc111111-1111-1111-1111-111111111111', 'later changes are logged, with who');
select throws_ok($$ update public.connection_band_details set connection_id = 'cc500000-0000-0000-0000-000000000009'
  where connection_id = 'cc500000-0000-0000-0000-000000000001' $$, '42501', null, 'can''t move a row to another record');
select throws_ok($$ delete from public.connection_band_details $$, '42501', null, 'can''t delete rows');

-- Another band can't see or touch it.
select set_config('request.jwt.claims', '{"sub":"cc222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.connection_band_details where connection_id = 'cc500000-0000-0000-0000-000000000001'),
  0, 'another band can''t read it, Avoid and notes included');
update public.connection_band_details set status = 'avoid' where connection_id = 'cc500000-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.connection_band_details (workspace_id, connection_id, status)
  values ('ccaaaaaa-0000-0000-0000-0000000000a1', 'cc500000-0000-0000-0000-000000000001', 'avoid') $$,
  '42501', null, 'or add a row for a band it''s not in');

set local role anon;
select throws_ok($$ select * from public.connection_band_details $$, '42501', null, 'anon gets nothing');
reset role;

select is((select status::text || '|' || notes from public.connection_band_details
  where connection_id = 'cc500000-0000-0000-0000-000000000001'), 'lets_play|Ask about Fridays',
  'another band''s update changed nothing');

select is(
  (select count(*)::int from public.connection_band_details d
   where not exists (select 1 from public.connections c where c.id = d.connection_id)), 0, 'no orphans');
select is(
  (select count(*)::int from public.connections c
   where not exists (select 1 from public.connection_band_details d where d.workspace_id = c.workspace_id and d.connection_id = c.id)),
  0, 'every record has its band''s row');

delete from public.connections where id = 'cc500000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.connection_band_details where connection_id = 'cc500000-0000-0000-0000-000000000001'),
  0, 'a deleted record leaves nothing behind');

select * from finish();
rollback;
