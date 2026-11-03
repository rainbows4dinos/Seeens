-- A save doesn't overwrite a bandmate's newer save (#82). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
--
-- Everything here runs in one transaction, where now() never changes, so a
-- "stale" form is simulated by sending an older updated_at than the row has.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('c2111111-1111-1111-1111-111111111111', 'conflict-alex@example.com'),
  ('c2333333-3333-3333-3333-333333333333', 'conflict-cora@example.com');

insert into public.workspaces (id, name) values
  ('c2aaaaaa-0000-0000-0000-0000000000a1', 'Test Band'),
  ('c2bbbbbb-0000-0000-0000-0000000000b2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('c2aaaaaa-0000-0000-0000-0000000000a1', 'c2111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('c2bbbbbb-0000-0000-0000-0000000000b2', 'c2333333-3333-3333-3333-333333333333', 'member', 'Cora');

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, notes) values
  ('c2c00000-0000-0000-0000-0000000000a1', 'c2aaaaaa-0000-0000-0000-0000000000a1', 'Static Basement', 'group', '{}', 'venue', 'Sam''s notes'),
  ('c2c00000-0000-0000-0000-0000000000b2', 'c2bbbbbb-0000-0000-0000-0000000000b2', 'Their Venue', 'group', '{}', 'venue', null);

insert into public.connection_links (workspace_id, connection_id, url) values
  ('c2aaaaaa-0000-0000-0000-0000000000a1', 'c2c00000-0000-0000-0000-0000000000a1', 'https://static.example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- A form opened before the latest save.
select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'c2aaaaaa-0000-0000-0000-0000000000a1', p_id => 'c2c00000-0000-0000-0000-0000000000a1',
    p_name => 'Static Basement', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_notes => 'Alex''s notes', p_scene_ids => '{}', p_new_scenes => '{New Scene}', p_links => '[]',
    p_expected_updated_at => '2000-01-01T00:00:00Z'
  )$$,
  'PT409', null,
  'saving a form opened on an older version is refused'
);
select is(
  (select notes from public.connections where id = 'c2c00000-0000-0000-0000-0000000000a1'),
  'Sam''s notes',
  'a refused save keeps the bandmate''s notes'
);
select is(
  (select count(*) from public.connection_links where connection_id = 'c2c00000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'a refused save keeps the bandmate''s links'
);
select is(
  (select count(*) from public.scenes where name = 'New Scene'),
  0::bigint,
  'a refused save adds no scenes'
);

-- A form opened on the current version.
select lives_ok(
  $$select public.save_connection(
    p_workspace_id => 'c2aaaaaa-0000-0000-0000-0000000000a1', p_id => 'c2c00000-0000-0000-0000-0000000000a1',
    p_name => 'Static Basement', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_notes => 'Alex''s notes', p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]',
    p_expected_updated_at => (select updated_at from public.connections where id = 'c2c00000-0000-0000-0000-0000000000a1')
  )$$,
  'saving a form opened on the current version works'
);
select is(
  (select notes from public.connections where id = 'c2c00000-0000-0000-0000-0000000000a1'),
  'Alex''s notes',
  'the current-version save lands'
);

-- No version sent: no check (older forms, new connections).
select lives_ok(
  $$select public.save_connection(
    p_workspace_id => 'c2aaaaaa-0000-0000-0000-0000000000a1', p_id => 'c2c00000-0000-0000-0000-0000000000a1',
    p_name => 'Static Basement', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]'
  )$$,
  'without a version, the save goes through as before'
);

-- Another band's connection: not found, not "changed", so nothing leaks.
select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'c2bbbbbb-0000-0000-0000-0000000000b2', p_id => 'c2c00000-0000-0000-0000-0000000000b2',
    p_name => 'Hijacked', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]',
    p_expected_updated_at => '2000-01-01T00:00:00Z'
  )$$,
  'P0002', null,
  'another band''s connection reads as not found, not as changed'
);

-- updated_at from the API (text with microseconds) compares exactly.
select is(
  (select updated_at = (updated_at::text)::timestamptz from public.connections
   where id = 'c2c00000-0000-0000-0000-0000000000a1'),
  true,
  'a round-tripped updated_at still matches'
);

select * from finish();
rollback;
