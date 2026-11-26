-- Promoters claim their listing (#304), like bands and labels: an admin
-- invites a promoter's owner, and the workspace says it's a promoter.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values ('7d111111-1111-1111-1111-111111111111', 'pc-admin@example.com');
insert into public.workspaces (id, name) values ('7daaaaaa-0000-0000-0000-0000000000a1', 'Home Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('7daaaaaa-0000-0000-0000-0000000000a1', '7d111111-1111-1111-1111-111111111111', 'owner', 'Ada');
insert into public.app_admins (user_id) values ('7d111111-1111-1111-1111-111111111111');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, is_us, created_by) values
  ('7dcccccc-0000-0000-0000-000000000001', '7daaaaaa-0000-0000-0000-0000000000a1', 'Home Band', 'group', 'band', '{}', true, null),
  ('7dcccccc-0000-0000-0000-000000000002', '7daaaaaa-0000-0000-0000-0000000000a1', 'Glum Nights Presents', 'group', 'promoter_collective', '{}', false, null);
update public.workspaces set listing_id = '7dcccccc-0000-0000-0000-000000000001' where id = '7daaaaaa-0000-0000-0000-0000000000a1';

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select group_type from public.invitable_bands() where name = 'Glum Nights Presents'), 'promoter_collective',
  'promoters can be invited, and say so');

insert into t select 'ws', workspace_id from public.invite_band('7dcccccc-0000-0000-0000-000000000002', null, 'pc-owner@example.com', null);
select is((select kind from public.list_bands() where name = 'Glum Nights Presents'), 'promoter', 'the admin list says promoter');
select is((select count(*)::int from public.invitable_bands() where name = 'Glum Nights Presents'), 0,
  'a claimed promoter drops off the list');

insert into t select 'new', workspace_id from public.invite_band(null, 'Wet Basement Shows', null, null, null, 'promoter');
reset role;
select is((select kind from public.workspaces where id = (select v::uuid from t where k = 'ws')), 'promoter',
  'a promoter listing makes a promoter workspace');
select is((select kind from public.workspaces where id = (select v::uuid from t where k = 'new')), 'promoter',
  'a new promoter makes a promoter workspace');
select is((select c.group_type::text from public.connections c join public.workspaces w on w.listing_id = c.id
  where w.id = (select v::uuid from t where k = 'new')), 'promoter_collective', 'and a promoter listing');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select * from public.invite_band(null, 'glum nights presents', null, null, null, 'promoter') $$,
  '23505', 'already listed', 'a listed promoter has to be picked');
select throws_ok($$ select * from public.invite_band(null, 'Odd One', null, null, null, 'venue') $$,
  '23514', 'not a band or label', 'still no venues');

select * from finish();
rollback;
