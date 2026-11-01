-- Workspace access and history rules. Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
--   ws_merwulf: alex (owner), sam (member)
--   ws_other:   cora (member)
--   dana:       signed up, no membership
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'test-alex@example.com'),
  ('f2222222-2222-2222-2222-222222222222', 'test-sam@example.com'),
  ('f3333333-3333-3333-3333-333333333333', 'test-cora@example.com'),
  ('f4444444-4444-4444-4444-444444444444', 'test-dana@example.com');

insert into public.workspaces (id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Merwulf'),
  ('bbbbbbbb-0000-0000-0000-0000000000f2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'f1111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'f2222222-2222-2222-2222-222222222222', 'member', 'Sam'),
  ('bbbbbbbb-0000-0000-0000-0000000000f2', 'f3333333-3333-3333-3333-333333333333', 'member', 'Cora');

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('c0000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'The Tin Hollows', 'group', '{}', 'band'),
  ('c0000000-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Jo Example', 'person', '{musician,dj}', null),
  ('c0000000-0000-0000-0000-0000000000f3', 'bbbbbbbb-0000-0000-0000-0000000000f2', 'Elsewhere Hall', 'group', '{}', 'venue');

insert into public.scenes (id, workspace_id, name) values
  ('5c000000-0000-0000-0000-0000000000f9', 'bbbbbbbb-0000-0000-0000-0000000000f2', 'Elsewhere scene');

-- ---------------------------------------------------------------------------
-- Signed out (anon)
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  'select count(*) from public.connections',
  '42501', null,
  'anon cannot read connections'
);
select throws_ok(
  'select count(*) from public.workspaces',
  '42501', null,
  'anon cannot read workspaces'
);
select throws_ok(
  $$select * from public.search_places('portland')$$,
  '42501', null,
  'anon cannot search places'
);

-- ---------------------------------------------------------------------------
-- Signed up, no membership (dana)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select is((select count(*) from public.workspaces), 0::bigint, 'non-member sees no workspaces');
select is(
  (select region_code from public.search_places('portland') limit 1),
  'OR',
  'any signed-in user can search places; biggest match first'
);
select is(
  (select region_code from public.search_places('portland, me') limit 1),
  'ME',
  'a qualifier after a comma narrows by state'
);
select throws_ok(
  $$insert into public.places (id, name, ascii_name, country_code, country_name, latitude, longitude)
    values (1, 'Fake', 'Fake', 'US', 'United States', 0, 0)$$,
  '42501', null,
  'places cannot be changed through the API'
);
select is((select count(*) from public.workspace_members), 0::bigint, 'non-member sees no members');
select is((select count(*) from public.connections), 0::bigint, 'non-member sees no connections');
select throws_ok(
  $$insert into public.connections (workspace_id, name, kind, group_type)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Sneaky', 'group', 'band')$$,
  '42501', null,
  'non-member cannot add a connection'
);
select throws_ok(
  $$insert into public.workspace_members (workspace_id, user_id, display_name)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'f4444444-4444-4444-4444-444444444444', 'Dana')$$,
  '42501', null,
  'non-member cannot add themselves to a workspace'
);
select throws_ok(
  $$insert into public.workspaces (name) values ('My Own')$$,
  '42501', null,
  'users cannot create workspaces through the API'
);
select throws_ok(
  $$select public.set_next_action('c0000000-0000-0000-0000-0000000000f1', 'Email them')$$,
  'P0002', 'connection not found',
  'non-member cannot set a next action'
);

update public.connections set name = 'Hacked' where id = 'c0000000-0000-0000-0000-0000000000f1';

-- ---------------------------------------------------------------------------
-- Member of a different workspace (cora)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"f3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select results_eq(
  'select name from public.connections order by name',
  array['Elsewhere Hall'],
  'other-workspace member sees only their own connections'
);
select is((select count(*) from public.workspace_members), 1::bigint, 'other-workspace member sees only their own roster');

update public.connections set status = 'homies' where id = 'c0000000-0000-0000-0000-0000000000f2';

select throws_ok(
  $$insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, role)
    values ('bbbbbbbb-0000-0000-0000-0000000000f2',
            'c0000000-0000-0000-0000-0000000000f3',
            'c0000000-0000-0000-0000-0000000000f1', 'books for')$$,
  '23503', null,
  'affiliations cannot link across workspaces'
);

-- ---------------------------------------------------------------------------
-- Writes from outsiders had no effect (checked as postgres)
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select name from public.connections where id = 'c0000000-0000-0000-0000-0000000000f1'),
  'The Tin Hollows',
  'non-member update changed nothing'
);
select is(
  (select status::text from public.connections where id = 'c0000000-0000-0000-0000-0000000000f2'),
  'neutral',
  'other-workspace update changed nothing'
);

-- ---------------------------------------------------------------------------
-- Member (alex)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.connections), 2::bigint, 'member sees their workspace connections');
select is((select count(*) from public.workspace_members), 2::bigint, 'member sees their bandmates');

select lives_ok(
  $$insert into public.connections (id, workspace_id, name, kind, person_roles, group_type)
    values ('c0000000-0000-0000-0000-0000000000f4',
            'aaaaaaaa-0000-0000-0000-0000000000f1', 'Basement Saints', 'group', '{}', 'band')$$,
  'member can add a connection'
);
select is(
  (select created_by from public.connections where id = 'c0000000-0000-0000-0000-0000000000f4'),
  'f1111111-1111-1111-1111-111111111111'::uuid,
  'created_by defaults to the signed-in member'
);
select throws_ok(
  $$insert into public.connections (workspace_id, name, kind, person_roles, group_type)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Half Person', 'person', '{dj}', 'band')$$,
  '23514', null,
  'a person cannot also be a group type'
);
select throws_ok(
  $$insert into public.connections (workspace_id, name, kind, group_type)
    values ('bbbbbbbb-0000-0000-0000-0000000000f2', 'Wrong Band', 'group', 'band')$$,
  '42501', null,
  'member cannot add to another workspace'
);

select lives_ok(
  $$insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, role)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1',
            'c0000000-0000-0000-0000-0000000000f2',
            'c0000000-0000-0000-0000-0000000000f1', 'member', 'vocals, guitar')$$,
  'member can link a person to a band'
);
select throws_ok(
  $$insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1',
            'c0000000-0000-0000-0000-0000000000f2',
            'c0000000-0000-0000-0000-0000000000f1', 'member')$$,
  '23505', null,
  'one link per kind between the same two connections'
);
select lives_ok(
  $$insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1',
            'c0000000-0000-0000-0000-0000000000f4',
            'c0000000-0000-0000-0000-0000000000f1', 'related')$$,
  'role is optional'
);
delete from public.affiliations
  where from_connection_id = 'c0000000-0000-0000-0000-0000000000f4' and kind = 'related';
select is(
  (select count(*) from public.affiliations where from_connection_id = 'c0000000-0000-0000-0000-0000000000f4'),
  0::bigint,
  'members can remove a link'
);

-- Scenes can sit inside a bigger scene in the same workspace.
select lives_ok(
  $$insert into public.scenes (id, workspace_id, name) values
      ('5c000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Pacific Northwest');
    insert into public.scenes (workspace_id, name, parent_id) values
      ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Portland DIY', '5c000000-0000-0000-0000-0000000000f1')$$,
  'member can add a macro-scene and a scene inside it'
);
select throws_ok(
  $$insert into public.scenes (workspace_id, name, parent_id) values
      ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Sneaky', '5c000000-0000-0000-0000-0000000000f9')$$,
  '23503', null,
  'a scene cannot sit inside another band''s scene'
);

-- One "us" per workspace, and it has to be a group.
select lives_ok(
  $$update public.connections set is_us = true where id = 'c0000000-0000-0000-0000-0000000000f4'$$,
  'a band can be marked as us'
);
select throws_ok(
  $$update public.connections set is_us = true where id = 'c0000000-0000-0000-0000-0000000000f1'$$,
  '23505', null,
  'only one us per workspace'
);
select throws_ok(
  $$update public.connections set is_us = true, group_type = null, kind = 'person', person_roles = '{dj}'
    where id = 'c0000000-0000-0000-0000-0000000000f4'$$,
  '23514', null,
  'us must be a group'
);

-- Status and played-together are separate facts; status changes are logged.
update public.connections set status = 'lets_play' where id = 'c0000000-0000-0000-0000-0000000000f1';
update public.connections set played_together = true where id = 'c0000000-0000-0000-0000-0000000000f1';
update public.connections set status = 'homies' where id = 'c0000000-0000-0000-0000-0000000000f1';
select results_eq(
  $$select status::text, played_together from public.connections
    where id = 'c0000000-0000-0000-0000-0000000000f1'$$,
  $$values ('homies'::text, true)$$,
  'status and played together are set independently'
);
select results_eq(
  $$select from_status::text, to_status::text, changed_by
    from public.connection_status_changes
    where connection_id = 'c0000000-0000-0000-0000-0000000000f1'
    order by id$$,
  $$values (null::text, 'neutral'::text, null::uuid),
           ('neutral', 'lets_play', 'f1111111-1111-1111-1111-111111111111'::uuid),
           ('lets_play', 'homies', 'f1111111-1111-1111-1111-111111111111'::uuid)$$,
  'status changes are logged with who made them; other edits are not'
);
select throws_ok(
  $$insert into public.connection_status_changes (workspace_id, connection_id, to_status)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'c0000000-0000-0000-0000-0000000000f1', 'avoid')$$,
  '42501', null,
  'status history cannot be written directly'
);

select throws_ok(
  $$delete from public.connections where id = 'c0000000-0000-0000-0000-0000000000f4'$$,
  '42501', null,
  'connections cannot be deleted (archive instead)'
);

select throws_ok(
  $$update public.connections set status = 'urgent'
    where id = 'c0000000-0000-0000-0000-0000000000f1'$$,
  '22P02', null,
  'status only accepts the known set'
);

-- Next actions keep history.
select lives_ok(
  $$select public.set_next_action('c0000000-0000-0000-0000-0000000000f1',
      'Ask about a June show', '2026-11-15',
      'f2222222-2222-2222-2222-222222222222')$$,
  'member can set a next action'
);
select lives_ok(
  $$select public.set_next_action('c0000000-0000-0000-0000-0000000000f1', 'Send the EP link')$$,
  'member can replace a next action'
);
select results_eq(
  $$select description, status::text from public.next_actions
    where connection_id = 'c0000000-0000-0000-0000-0000000000f1'
    order by created_at, status desc$$,
  $$values ('Ask about a June show', 'replaced'), ('Send the EP link', 'open')$$,
  'replacing keeps the old next action as history'
);
select throws_ok(
  $$update public.next_actions set description = 'Rewritten'
    where connection_id = 'c0000000-0000-0000-0000-0000000000f1' and status = 'replaced'$$,
  '23514', null,
  'closed next actions cannot be edited'
);
select throws_ok(
  $$select public.set_next_action('c0000000-0000-0000-0000-0000000000f1', 'Assign to outsider',
      null, 'f3333333-3333-3333-3333-333333333333')$$,
  '23503', null,
  'next actions can only be assigned to workspace members'
);

-- Outreach belongs to its author.
select lives_ok(
  $$insert into public.outreach_entries (workspace_id, connection_id, channel, summary)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1',
            'c0000000-0000-0000-0000-0000000000f1', 'instagram', 'DMed about a split bill')$$,
  'member can log outreach'
);
select throws_ok(
  $$insert into public.outreach_entries (workspace_id, connection_id, summary, author_id)
    values ('aaaaaaaa-0000-0000-0000-0000000000f1',
            'c0000000-0000-0000-0000-0000000000f1', 'Pretending to be Sam',
            'f2222222-2222-2222-2222-222222222222')$$,
  '42501', null,
  'member cannot log outreach as someone else'
);

-- Sam can read Alex's outreach but not delete it.
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*) from public.outreach_entries), 1::bigint, 'bandmates see each other''s outreach');
delete from public.outreach_entries;
select is((select count(*) from public.outreach_entries), 1::bigint, 'bandmates cannot delete each other''s outreach');

-- Removing a member keeps closed next actions as history.
reset role;
insert into public.next_actions (id, workspace_id, connection_id, description, assignee_id, created_by, status, closed_at)
values ('ac000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1',
        'c0000000-0000-0000-0000-0000000000f2', 'Ask about a date',
        'f2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'done', now());

select throws_ok(
  $$update public.next_actions set assignee_id = null, description = 'Rewritten'
    where id = 'ac000000-0000-0000-0000-0000000000f1'$$,
  '23514', null,
  'closed next actions still cannot be rewritten while clearing the assignee'
);
select throws_ok(
  $$update public.next_actions set assignee_id = 'f1111111-1111-1111-1111-111111111111'
    where id = 'ac000000-0000-0000-0000-0000000000f1'$$,
  '23514', null,
  'closed next actions cannot be reassigned'
);
select lives_ok(
  $$delete from public.workspace_members where user_id = 'f2222222-2222-2222-2222-222222222222'$$,
  'a member with closed next actions can be removed'
);
select is(
  (select row(assignee_id, created_by, description, status::text)::text
   from public.next_actions where id = 'ac000000-0000-0000-0000-0000000000f1'),
  row(null::uuid, null::uuid, 'Ask about a date', 'done')::text,
  'the closed action stays, without the removed member'
);
select lives_ok(
  $$delete from auth.users where id = 'f2222222-2222-2222-2222-222222222222'$$,
  'deleting a removed member''s account works'
);

select * from finish();
rollback;
