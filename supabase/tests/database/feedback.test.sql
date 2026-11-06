-- Beta feedback (#71): members send it and read their own; only app admins
-- read everything and sort it.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, email) values
  ('fb111111-1111-1111-1111-111111111111', 'fb-alex@example.com'),
  ('fb222222-2222-2222-2222-222222222222', 'fb-sam@example.com'),
  ('fb333333-3333-3333-3333-333333333333', 'fb-larry@example.com'),
  ('fb444444-4444-4444-4444-444444444444', 'fb-outsider@example.com');
insert into public.workspaces (id, name) values ('fbaaaaaa-0000-0000-0000-0000000000a1', 'Feedback Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('fbaaaaaa-0000-0000-0000-0000000000a1', 'fb111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('fbaaaaaa-0000-0000-0000-0000000000a1', 'fb222222-2222-2222-2222-222222222222', 'member', 'Sam'),
  ('fbaaaaaa-0000-0000-0000-0000000000a1', 'fb333333-3333-3333-3333-333333333333', 'member', 'Larry');
insert into public.app_admins (user_id) values ('fb333333-3333-3333-3333-333333333333');

set local role authenticated;

-- Alex sends one.
select set_config('request.jwt.claims', '{"sub":"fb111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select ok(not public.is_app_admin(), 'a band owner is not an app admin');
select lives_ok($$ select public.submit_feedback('fbaaaaaa-0000-0000-0000-0000000000a1', 'bug', '  The save button spins forever  ',
  '/connections/abc?q=Some+Name', 'abc1234', 'Mozilla/5.0', '1280×800', 'digest-1') $$, 'a member sends feedback');
select is((select body from public.feedback where sender_name = 'Alex'), 'The save button spins forever', 'trimmed');
select is((select path from public.feedback where sender_name = 'Alex'), '/connections/abc', 'no query string on the path');
select is((select band_name || ' ' || kind::text || ' ' || status::text from public.feedback where sender_name = 'Alex'),
  'Feedback Band bug new', 'with the band, kind, and New');
select is((select count(*)::int from public.feedback), 1, 'reads their own');
select throws_ok($$ select public.submit_feedback('fbaaaaaa-0000-0000-0000-0000000000a1', 'idea', '   ') $$,
  '23514', null, 'not blank');
select throws_ok($$ select public.submit_feedback('fbaaaaaa-0000-0000-0000-0000000000a1', 'idea', 'x', null, null, null, null, null,
  'fb222222-2222-2222-2222-222222222222/00000000-0000-0000-0000-000000000001.webp') $$,
  '23514', 'bad screenshot', 'a screenshot has to be in your own folder');
select lives_ok($$ select public.submit_feedback('fbaaaaaa-0000-0000-0000-0000000000a1', 'idea', 'With a picture', null, null, null, null, null,
  'fb111111-1111-1111-1111-111111111111/00000000-0000-0000-0000-000000000001.webp') $$, 'with a screenshot of their own');
select throws_ok($$ insert into public.feedback (sender_name, kind, body) values ('Alex', 'bug', 'direct') $$,
  '42501', null, 'no writing the table directly');
select throws_ok($$ select public.update_feedback((select id from public.feedback limit 1), 'done') $$,
  '42501', 'app admins only', 'testers can''t sort feedback');

-- Sam can't see Alex's.
select set_config('request.jwt.claims', '{"sub":"fb222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.feedback), 0, 'others'' feedback is private');
select lives_ok($$ select public.submit_feedback('fbaaaaaa-0000-0000-0000-0000000000a1', 'confusing', 'What is a scene?') $$, 'Sam sends one');
select is((select count(*)::int from public.feedback), 1, 'and sees only that one');

-- Someone in no band can't send any.
select set_config('request.jwt.claims', '{"sub":"fb444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$ select public.submit_feedback('fbaaaaaa-0000-0000-0000-0000000000a1', 'other', 'hi') $$,
  '42501', 'not a member', 'a non-member can''t send feedback');

-- Larry, an app admin, sees all of it and sorts it.
select set_config('request.jwt.claims', '{"sub":"fb333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select ok(public.is_app_admin(), 'Larry is an app admin');
select is((select count(*)::int from public.feedback), 3, 'and reads everything');
select lives_ok($$ select public.update_feedback((select id from public.feedback where kind = 'bug'), 'done',
  'https://github.com/rainbows4dinos/seeens/issues/999') $$, 'marks it Done with its issue');
select throws_ok($$ select public.update_feedback((select id from public.feedback where kind = 'bug'), 'done', 'javascript:alert(1)') $$,
  '23514', null, 'the issue link has to be GitHub');
select lives_ok($$ select public.mark_feedback_notified((select id from public.feedback where kind = 'bug')) $$, 'and notes the tester was told');

select * from finish();
rollback;
