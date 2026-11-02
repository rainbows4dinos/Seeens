-- Connection saves happen in one transaction (#77). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
--   ws_a: alex (member)    ws_b: cora (member)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a7111111-1111-1111-1111-111111111111', 'atomic-alex@example.com'),
  ('a7333333-3333-3333-3333-333333333333', 'atomic-cora@example.com');

insert into public.workspaces (id, name) values
  ('a7aaaaaa-0000-0000-0000-0000000000a1', 'Test Band'),
  ('a7bbbbbb-0000-0000-0000-0000000000b2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('a7aaaaaa-0000-0000-0000-0000000000a1', 'a7111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('a7bbbbbb-0000-0000-0000-0000000000b2', 'a7333333-3333-3333-3333-333333333333', 'member', 'Cora');

insert into public.scenes (id, workspace_id, name) values
  ('a75c0000-0000-0000-0000-0000000000a1', 'a7aaaaaa-0000-0000-0000-0000000000a1', 'Basement Shows'),
  ('a75c0000-0000-0000-0000-0000000000b2', 'a7bbbbbb-0000-0000-0000-0000000000b2', 'Their Scene');

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('a7c00000-0000-0000-0000-0000000000b2', 'a7bbbbbb-0000-0000-0000-0000000000b2', 'Their Venue', 'group', '{}', 'venue');

-- Member of ws_a
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Create: everything lands together
-- ---------------------------------------------------------------------------

create temp table saved (id uuid) on commit drop;
grant all on saved to authenticated;

select lives_ok(
  $$insert into saved select public.save_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1',
    p_name => 'The Tin Hollows', p_kind => 'group', p_person_roles => '{}', p_group_type => 'band',
    p_status => 'lets_play', p_played_together => true, p_is_us => false, p_can_help_with => '{shows}',
    p_place_id => (select id from public.places where name = 'Portland' and region_code = 'OR'),
    p_scene_ids => '{a75c0000-0000-0000-0000-0000000000a1}', p_new_scenes => '{basement shows, Zine Fest}',
    p_links => '[{"label": "Bandcamp", "url": "https://tinhollows.example.com"}, {"label": "", "url": "https://example.com/tin"}]'
  )$$,
  'a member can save a new connection'
);

select is(
  (select row(name, status::text, played_together, group_type::text)::text
   from public.connections where id = (select id from saved)),
  row('The Tin Hollows', 'lets_play', true, 'band')::text,
  'the connection row is saved'
);
select is(
  (select l.name || ', ' || l.region_code from public.connections c join public.localities l on l.id = c.locality_id
   where c.id = (select id from saved)),
  'Portland, OR',
  'a new town is added as a workspace locality'
);
select is(
  (select array_agg(coalesce(label, '-') || ' ' || url order by position) from public.connection_links
   where connection_id = (select id from saved)),
  array['Bandcamp https://tinhollows.example.com', '- https://example.com/tin'],
  'links are saved in order, and empty labels become null'
);
select is(
  (select count(*) from public.scenes where workspace_id = 'a7aaaaaa-0000-0000-0000-0000000000a1'),
  2::bigint,
  'a new scene name matching an existing scene (any case) reuses it; a new one is added'
);
select is(
  (select array_agg(s.name order by s.name) from public.connection_scenes cs join public.scenes s on s.id = cs.scene_id
   where cs.connection_id = (select id from saved)),
  array['Basement Shows', 'Zine Fest'],
  'scene tags are saved once each'
);

-- The same town again reuses the locality.
select lives_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1',
    p_name => 'Jo Example', p_kind => 'person', p_person_roles => '{musician}',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_place_id => (select id from public.places where name = 'Portland' and region_code = 'OR'),
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]'
  )$$,
  'a second connection in the same town saves'
);
select is(
  (select count(*) from public.localities where workspace_id = 'a7aaaaaa-0000-0000-0000-0000000000a1'),
  1::bigint,
  'the same town reuses the existing locality'
);

-- ---------------------------------------------------------------------------
-- Create: a failure changes nothing
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1',
    p_name => 'Half Saved', p_kind => 'group', p_person_roles => '{}', p_group_type => 'band',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{Never Added}', p_links => '[{"label": null, "url": "not a url"}]'
  )$$,
  '23514', null,
  'a bad link fails the save'
);
select is((select count(*) from public.connections where name = 'Half Saved'), 0::bigint,
  'a failed create leaves no connection behind');
select is((select count(*) from public.scenes where name = 'Never Added'), 0::bigint,
  'a failed create leaves no new scene behind');

-- ---------------------------------------------------------------------------
-- Edit: a failure keeps the old links and tags
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1', p_id => (select id from saved),
    p_name => 'Renamed', p_kind => 'group', p_person_roles => '{}', p_group_type => 'band',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[{"label": null, "url": "ftp://nope"}]'
  )$$,
  '23514', null,
  'a bad link fails the edit'
);
select is(
  (select name from public.connections where id = (select id from saved)),
  'The Tin Hollows',
  'a failed edit keeps the old name'
);
select is(
  (select count(*) from public.connection_links where connection_id = (select id from saved)),
  2::bigint,
  'a failed edit keeps the old links'
);
select is(
  (select count(*) from public.connection_scenes where connection_id = (select id from saved)),
  2::bigint,
  'a failed edit keeps the old scene tags'
);

-- ---------------------------------------------------------------------------
-- Edit: success replaces links and tags, keeps the town when asked
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1', p_id => (select id from saved),
    p_name => 'The Tin Hollows', p_kind => 'group', p_person_roles => '{}', p_group_type => 'band',
    p_status => 'homies', p_played_together => true, p_is_us => false, p_can_help_with => '{}',
    p_keep_locality_id => (select locality_id from public.connections where id = (select id from saved)),
    p_scene_ids => '{a75c0000-0000-0000-0000-0000000000a1}', p_new_scenes => '{}',
    p_links => '[{"label": "Site", "url": "https://tin.example.com"}]'
  )$$,
  'a member can edit a connection'
);
select is(
  (select array_agg(url) from public.connection_links where connection_id = (select id from saved)),
  array['https://tin.example.com'],
  'an edit replaces the links'
);
select is(
  (select array_agg(scene_id) from public.connection_scenes where connection_id = (select id from saved)),
  array['a75c0000-0000-0000-0000-0000000000a1'::uuid],
  'an edit sets exactly the chosen scene tags'
);
select isnt(
  (select locality_id from public.connections where id = (select id from saved)),
  null,
  'keeping the locality keeps the town'
);
select is(
  (select to_status::text from public.connection_status_changes
   where connection_id = (select id from saved) order by id desc limit 1),
  'homies',
  'status history is still logged'
);

-- ---------------------------------------------------------------------------
-- Other workspaces stay out of reach
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7bbbbbb-0000-0000-0000-0000000000b2',
    p_name => 'Sneaky', p_kind => 'group', p_person_roles => '{}', p_group_type => 'band',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]'
  )$$,
  '42501', null,
  'a member cannot create a connection in another workspace'
);
select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7bbbbbb-0000-0000-0000-0000000000b2', p_id => 'a7c00000-0000-0000-0000-0000000000b2',
    p_name => 'Hijacked', p_kind => 'group', p_person_roles => '{}', p_group_type => 'venue',
    p_status => 'neutral', p_played_together => false, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{}', p_new_scenes => '{}', p_links => '[]'
  )$$,
  'P0002', null,
  'a member cannot edit another workspace''s connection'
);
select throws_ok(
  $$select public.save_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1', p_id => (select id from saved),
    p_name => 'The Tin Hollows', p_kind => 'group', p_person_roles => '{}', p_group_type => 'band',
    p_status => 'homies', p_played_together => true, p_is_us => false, p_can_help_with => '{}',
    p_scene_ids => '{a75c0000-0000-0000-0000-0000000000b2}', p_new_scenes => '{}', p_links => '[]'
  )$$,
  '23503', null,
  'a member cannot tag another workspace''s scene'
);

-- ---------------------------------------------------------------------------
-- Adding someone new while linking
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.create_linked_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1', p_other_id => (select id from saved),
    p_new_is_from => true, p_name => 'Riley Drums', p_kind => 'person', p_person_roles => '{musician}',
    p_affiliation_kind => 'member', p_role => 'drums', p_is_current => true
  )$$,
  'a member can add someone new as a band member'
);
select is(
  (select f.name || ' -> ' || a.kind::text || ' (' || a.role || ') -> ' || t.name
   from public.affiliations a
   join public.connections f on f.id = a.from_connection_id
   join public.connections t on t.id = a.to_connection_id
   where f.name = 'Riley Drums'),
  'Riley Drums -> member (drums) -> The Tin Hollows',
  'the new person and the link are saved together'
);
select throws_ok(
  $$select public.create_linked_connection(
    p_workspace_id => 'a7aaaaaa-0000-0000-0000-0000000000a1', p_other_id => (select id from saved),
    p_new_is_from => true, p_name => 'Ghost Member', p_kind => 'person', p_person_roles => '{musician}',
    p_affiliation_kind => 'member', p_role => repeat('x', 81), p_is_current => true
  )$$,
  '23514', null,
  'a link that fails a check fails the whole step'
);
select is((select count(*) from public.connections where name = 'Ghost Member'), 0::bigint,
  'a failed link leaves no stray connection');

select * from finish();
rollback;
