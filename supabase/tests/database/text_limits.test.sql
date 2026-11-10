-- Text limits (launch hardening).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into public.workspaces (id, name) values ('9baaaaaa-0000-0000-0000-0000000000a1', 'Limits Band');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles) values
  ('9bcccccc-0000-0000-0000-000000000001', '9baaaaaa-0000-0000-0000-0000000000a1', 'Long Notes', 'group', 'band', '{}');

select throws_ok($$ insert into public.connection_links (workspace_id, connection_id, url)
  values ('9baaaaaa-0000-0000-0000-0000000000a1', '9bcccccc-0000-0000-0000-000000000001', 'https://x.example/' || repeat('a', 2000)) $$,
  '23514', null, 'a link over 2,000 characters is refused');
select lives_ok($$ insert into public.connection_links (workspace_id, connection_id, url)
  values ('9baaaaaa-0000-0000-0000-0000000000a1', '9bcccccc-0000-0000-0000-000000000001', 'https://bandcamp.example') $$,
  'a normal link is fine');
select throws_ok($$ update public.connections set can_help_with = array_fill('x'::text, array[31])
  where id = '9bcccccc-0000-0000-0000-000000000001' $$, '23514', null, 'more than 30 can-help-with items are refused');
select throws_ok($$ insert into public.scenes (workspace_id, name, description)
  values ('9baaaaaa-0000-0000-0000-0000000000a1', 'Wordy', repeat('a', 2001)) $$, '23514', null, 'a scene description over 2,000 is refused');

select * from finish();
rollback;
