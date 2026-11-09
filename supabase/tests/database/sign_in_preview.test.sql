-- The sign-in preview (#255).
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into public.workspaces (id, name) values ('9aaaaaaa-0000-0000-0000-0000000000a1', 'Preview Band');
insert into public.connections (id, workspace_id, name, kind, group_type, person_roles, keep_private,
  photo_path, photo_original_path, photo_settings) values
  ('9acccccc-0000-0000-0000-000000000001', '9aaaaaaa-0000-0000-0000-0000000000a1', 'Shown Band', 'group', 'band', '{}', false,
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000001/a.webp',
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000001/a-original.jpg', '{}'),
  ('9acccccc-0000-0000-0000-000000000002', '9aaaaaaa-0000-0000-0000-0000000000a1', 'Shown Venue', 'group', 'venue', '{}', false,
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000002/a.webp',
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000002/a-original.jpg', '{}'),
  ('9acccccc-0000-0000-0000-000000000003', '9aaaaaaa-0000-0000-0000-0000000000a1', 'Kept Band', 'group', 'band', '{}', false,
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000003/a.webp',
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000003/a-original.jpg', '{}'),
  ('9acccccc-0000-0000-0000-000000000004', '9aaaaaaa-0000-0000-0000-0000000000a1', 'No Photo Band', 'group', 'band', '{}', false,
   null, null, null),
  ('9acccccc-0000-0000-0000-000000000005', '9aaaaaaa-0000-0000-0000-0000000000a1', 'A Label', 'group', 'label', '{}', false,
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000005/a.webp',
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000005/a-original.jpg', '{}'),
  ('9acccccc-0000-0000-0000-000000000006', '9aaaaaaa-0000-0000-0000-0000000000a1', 'A Person', 'person', null, '{musician}', false,
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000006/a.webp',
   '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000006/a-original.jpg', '{}');
-- People start private; this one is shared, to show people never appear anyway.
update public.connections set keep_private = (name = 'Kept Band') where id::text like '9acccccc-%';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

create temp table seen as select name from public.preview_cards(48) where name in
  ('Shown Band', 'Shown Venue', 'Kept Band', 'No Photo Band', 'A Label', 'A Person');
select ok(exists(select 1 from seen where name = 'Shown Band'), 'a shared band with a photo shows');
select ok(exists(select 1 from seen where name = 'Shown Venue'), 'a shared venue with a photo shows');
select ok(not exists(select 1 from seen where name = 'Kept Band'), 'Keep Private takes it off');
select ok(not exists(select 1 from seen where name = 'No Photo Band'), 'no photo, no card');
select ok(not exists(select 1 from seen where name = 'A Label'), 'only bands and venues');
select ok(not exists(select 1 from seen where name = 'A Person'), 'never people');
select is(public.preview_photo_path('9acccccc-0000-0000-0000-000000000001'),
  '9aaaaaaa-0000-0000-0000-0000000000a1/9acccccc-0000-0000-0000-000000000001/a.webp', 'its photo is served');
select is(public.preview_photo_path('9acccccc-0000-0000-0000-000000000003'), null, 'a kept-private photo isn''t');
select throws_ok($$ select count(*) from public.connections $$, '42501', null, 'anon still can''t read listings');

select * from finish();
rollback;
