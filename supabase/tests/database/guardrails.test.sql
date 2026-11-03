-- Scene nesting and record authors are enforced by the database (#85).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('9a111111-1111-1111-1111-111111111111', 'guard-alex@example.com'),
  ('9a222222-2222-2222-2222-222222222222', 'guard-sam@example.com');

insert into public.workspaces (id, name) values ('9aaaaaaa-0000-0000-0000-0000000000a1', 'Guard Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('9aaaaaaa-0000-0000-0000-0000000000a1', '9a111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('9aaaaaaa-0000-0000-0000-0000000000a1', '9a222222-2222-2222-2222-222222222222', 'member', 'Sam');

-- Pacific Northwest > Portland DIY; Rural stands alone.
insert into public.scenes (id, workspace_id, name, parent_id) values
  ('9a5c0000-0000-0000-0000-000000000001', '9aaaaaaa-0000-0000-0000-0000000000a1', 'Pacific Northwest', null),
  ('9a5c0000-0000-0000-0000-000000000002', '9aaaaaaa-0000-0000-0000-0000000000a1', 'Portland DIY', '9a5c0000-0000-0000-0000-000000000001'),
  ('9a5c0000-0000-0000-0000-000000000003', '9aaaaaaa-0000-0000-0000-0000000000a1', 'Rural', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9a111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Scene nesting
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.scenes set parent_id = '9a5c0000-0000-0000-0000-000000000002'
    where id = '9a5c0000-0000-0000-0000-000000000003'$$,
  '23514', null,
  'a scene can''t go inside a scene that is itself inside another'
);
select throws_ok(
  $$insert into public.scenes (workspace_id, name, parent_id)
    values ('9aaaaaaa-0000-0000-0000-0000000000a1', 'Too Deep', '9a5c0000-0000-0000-0000-000000000002')$$,
  '23514', null,
  'a new scene can''t go two levels deep'
);
select throws_ok(
  $$update public.scenes set parent_id = '9a5c0000-0000-0000-0000-000000000003'
    where id = '9a5c0000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'a scene with scenes inside it can''t go inside another'
);
select throws_ok(
  $$update public.scenes set parent_id = '9a5c0000-0000-0000-0000-000000000002'
    where id = '9a5c0000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'a scene can''t go inside its own child'
);
select lives_ok(
  $$update public.scenes set parent_id = '9a5c0000-0000-0000-0000-000000000001'
    where id = '9a5c0000-0000-0000-0000-000000000003'$$,
  'a stand-alone scene can go inside a top-level scene'
);
select lives_ok(
  $$update public.scenes set name = 'Portland DIY Shows', parent_id = '9a5c0000-0000-0000-0000-000000000001'
    where id = '9a5c0000-0000-0000-0000-000000000002'$$,
  'saving a nested scene with the same parent works'
);
select lives_ok(
  $$update public.scenes set parent_id = null where id = '9a5c0000-0000-0000-0000-000000000002'$$,
  'a scene can move back to the top level'
);

-- ---------------------------------------------------------------------------
-- Authors
-- ---------------------------------------------------------------------------

insert into public.connections (id, workspace_id, name, kind, group_type, created_by)
values ('9ac00000-0000-0000-0000-000000000001', '9aaaaaaa-0000-0000-0000-0000000000a1',
        'Static Basement', 'group', 'venue', '9a222222-2222-2222-2222-222222222222');

select is(
  (select created_by from public.connections where id = '9ac00000-0000-0000-0000-000000000001'),
  '9a111111-1111-1111-1111-111111111111'::uuid,
  'a connection''s author is whoever added it, not whoever the request names'
);
select throws_ok(
  $$update public.connections set created_by = '9a222222-2222-2222-2222-222222222222'
    where id = '9ac00000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'a connection''s author can''t be changed'
);
select lives_ok(
  $$update public.connections set name = 'Static Basement PDX'
    where id = '9ac00000-0000-0000-0000-000000000001'$$,
  'other edits still work'
);

insert into public.next_actions (id, workspace_id, connection_id, description, created_by)
values ('9aac0000-0000-0000-0000-000000000001', '9aaaaaaa-0000-0000-0000-0000000000a1',
        '9ac00000-0000-0000-0000-000000000001', 'Ask about a date', '9a222222-2222-2222-2222-222222222222');

select is(
  (select created_by from public.next_actions where id = '9aac0000-0000-0000-0000-000000000001'),
  '9a111111-1111-1111-1111-111111111111'::uuid,
  'a next action''s author is whoever added it'
);
select throws_ok(
  $$update public.next_actions set created_by = '9a222222-2222-2222-2222-222222222222'
    where id = '9aac0000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'a next action''s author can''t be changed'
);

-- Removing a member still clears their authorship. As postgres with no
-- signed-in user (like the SQL editor), the given author is kept.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.connections (id, workspace_id, name, kind, group_type, created_by)
values ('9ac00000-0000-0000-0000-000000000002', '9aaaaaaa-0000-0000-0000-0000000000a1',
        'Sam''s Venue', 'group', 'venue', '9a222222-2222-2222-2222-222222222222');

select lives_ok(
  $$delete from public.workspace_members where user_id = '9a222222-2222-2222-2222-222222222222'$$,
  'a member who added connections can be removed'
);
select is(
  (select created_by from public.connections where id = '9ac00000-0000-0000-0000-000000000002'),
  null,
  'their connections stay, without an author'
);

select * from finish();
rollback;
