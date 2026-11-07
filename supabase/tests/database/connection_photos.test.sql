-- Connection photos (#37). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('f0111111-1111-1111-1111-111111111111', 'photo-alex@example.com'),
  ('f0333333-3333-3333-3333-333333333333', 'photo-cora@example.com');

insert into public.workspaces (id, name) values
  ('f0aaaaaa-0000-0000-0000-0000000000a1', 'Photo Band'),
  ('f0bbbbbb-0000-0000-0000-0000000000b2', 'Other Band');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('f0aaaaaa-0000-0000-0000-0000000000a1', 'f0111111-1111-1111-1111-111111111111', 'member', 'Alex'),
  ('f0bbbbbb-0000-0000-0000-0000000000b2', 'f0333333-3333-3333-3333-333333333333', 'member', 'Cora');

insert into public.connections (id, workspace_id, name, kind, person_roles, group_type) values
  ('f0c00000-0000-0000-0000-000000000001', 'f0aaaaaa-0000-0000-0000-0000000000a1', 'Photo Band One', 'group', '{}', 'band'),
  ('f0c00000-0000-0000-0000-0000000000b1', 'f0bbbbbb-0000-0000-0000-0000000000b2', 'Their Band', 'group', '{}', 'band');
-- Kept private, so this checks one band can't see another's (#185 opens
-- shared records to every band; shared_directory.test.sql covers that).
update public.connections set keep_private = true;


-- Stored files, put there as the storage service would.
insert into storage.objects (bucket_id, name) values
  ('connection-photos', 'f0aaaaaa-0000-0000-0000-0000000000a1/f0c00000-0000-0000-0000-000000000001/p1.webp'),
  ('connection-photos', 'f0bbbbbb-0000-0000-0000-0000000000b2/f0c00000-0000-0000-0000-0000000000b1/p2.webp');

select is((select public from storage.buckets where id = 'connection-photos'), false, 'the bucket is private');

-- Columns
select throws_ok(
  $$update public.connections set photo_path = 'somewhere/else.webp',
      photo_original_path = 'somewhere/else-original.webp', photo_settings = '{}'
    where id = 'f0c00000-0000-0000-0000-000000000001'$$,
  '23514', null, 'photo paths must sit in the connection''s own folder');
select throws_ok(
  $$update public.connections set photo_path = 'f0aaaaaa-0000-0000-0000-0000000000a1/f0c00000-0000-0000-0000-000000000001/p1.webp'
    where id = 'f0c00000-0000-0000-0000-000000000001'$$,
  '23514', null, 'the copy, the original, and the settings come together');
select lives_ok(
  $$update public.connections set
      photo_path = 'f0aaaaaa-0000-0000-0000-0000000000a1/f0c00000-0000-0000-0000-000000000001/p1.webp',
      photo_original_path = 'f0aaaaaa-0000-0000-0000-0000000000a1/f0c00000-0000-0000-0000-000000000001/p1-original.webp',
      photo_settings = '{"contrast": 2.4, "grit": 0.5, "plate": "cyan", "seed": 3}'
    where id = 'f0c00000-0000-0000-0000-000000000001'$$,
  'a complete photo saves');

-- A member of the workspace
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from storage.objects where bucket_id = 'connection-photos'), 1,
  'a member sees their workspace''s photos and not another''s');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('connection-photos', 'f0aaaaaa-0000-0000-0000-0000000000a1/f0c00000-0000-0000-0000-000000000001/p3.webp')$$,
  'a member can add a photo to their connection');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('connection-photos', 'f0bbbbbb-0000-0000-0000-0000000000b2/f0c00000-0000-0000-0000-0000000000b1/p4.webp')$$,
  '42501', null, 'not to another workspace''s connection');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('connection-photos', 'f0aaaaaa-0000-0000-0000-0000000000a1/f0c00000-0000-0000-0000-0000000000b1/p5.webp')$$,
  '42501', null, 'not to another workspace''s connection filed under their own workspace');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('connection-photos', 'f0aaaaaa-0000-0000-0000-0000000000a1/p6.webp')$$,
  '42501', null, 'not outside a connection folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('connection-photos', 'not-a-uuid/f0c00000-0000-0000-0000-000000000001/p7.webp')$$,
  '42501', null, 'a malformed path is refused, not an error');

delete from storage.objects where name like 'f0bbbbbb%';
select is((select count(*)::int from storage.objects where name like 'f0bbbbbb%'), 0, 'deleting another workspace''s photo matches nothing');
delete from storage.objects where name like '%/p3.webp';
select is((select count(*)::int from storage.objects where name like '%/p3.webp'), 0, 'a member can remove their photo');

-- Someone in another workspace, and someone signed out
select set_config('request.jwt.claims', '{"sub":"f0333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select array_agg(name) from storage.objects),
  array['f0bbbbbb-0000-0000-0000-0000000000b2/f0c00000-0000-0000-0000-0000000000b1/p2.webp'],
  'another workspace can''t read the photo, even knowing its path');

reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from storage.objects), 0, 'signed out, nothing is readable');

select * from finish();
rollback;
