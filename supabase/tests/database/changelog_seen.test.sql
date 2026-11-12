-- What's New mark (#216). Run with: npm run db:test. Fixture data is
-- fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, created_at) values
  ('7e111111-1111-1111-1111-111111111111', 'cl-one@example.com', '2026-11-01 12:00+00'),
  ('7e222222-2222-2222-2222-222222222222', 'cl-two@example.com', '2026-11-05 12:00+00');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7e111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(public.changelog_seen_on(), '2026-11-01'::date, 'never opened: seen up to when they joined');
select lives_ok($$ select public.mark_changelog_seen('2026-11-11') $$, 'opening the page marks it');
select is(public.changelog_seen_on(), '2026-11-11'::date, 'now seen up to the newest entry');
select lives_ok($$ select public.mark_changelog_seen('2026-11-09') $$, 'an older date is fine');
select is(public.changelog_seen_on(), '2026-11-11'::date, 'but never moves backward');

-- Someone else's mark is their own.
select set_config('request.jwt.claims', '{"sub":"7e222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.changelog_seen_on(), '2026-11-05'::date, 'per account');

select * from finish();
rollback;
