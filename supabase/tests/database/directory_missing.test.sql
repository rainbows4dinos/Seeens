-- The Directory's Missing filter (#321). Run with: npm run db:test.
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

delete from public.connections;

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'missing-alex@example.com'),
  ('e1222222-2222-2222-2222-222222222222', 'missing-bea@example.com');
insert into public.workspaces (id, name) values
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'Missing Band A'),
  ('e1aaaaaa-0000-0000-0000-0000000000b2', 'Missing Band B');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('e1aaaaaa-0000-0000-0000-0000000000b2', 'e1222222-2222-2222-2222-222222222222', 'owner', 'Bea');
insert into public.places (id, name, ascii_name, country_code, country_name, latitude, longitude)
  values (900101, 'Gaptown', 'Gaptown', 'US', 'United States', 45, -122);
insert into public.localities (id, workspace_id, name, place_id) values
  ('e1400000-0000-0000-0000-0000000000a1', 'e1aaaaaa-0000-0000-0000-0000000000a1', 'Gaptown', 900101);

-- Full Band has everything; the rest are missing things.
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, locality_id) values
  ('e1500000-0000-0000-0000-000000000001', 'e1aaaaaa-0000-0000-0000-0000000000a1', 'Full Band', 'group', '{}', 'band',
   'e1400000-0000-0000-0000-0000000000a1'),
  ('e1500000-0000-0000-0000-000000000002', 'e1aaaaaa-0000-0000-0000-0000000000a1', 'Bare Band', 'group', '{}', 'band', null),
  ('e1500000-0000-0000-0000-000000000003', 'e1aaaaaa-0000-0000-0000-0000000000a1', 'Linktree Band', 'group', '{}', 'band', null),
  ('e1500000-0000-0000-0000-000000000004', 'e1aaaaaa-0000-0000-0000-0000000000a1', 'Bare Venue', 'group', '{}', 'venue', null),
  ('e1500000-0000-0000-0000-000000000005', 'e1aaaaaa-0000-0000-0000-0000000000a1', 'Riley Example', 'person', '{musician}', null, null);
update public.connections set
  photo_path = 'e1aaaaaa-0000-0000-0000-0000000000a1/e1500000-0000-0000-0000-000000000001/p1.webp',
  photo_original_path = 'e1aaaaaa-0000-0000-0000-0000000000a1/e1500000-0000-0000-0000-000000000001/o1.jpg',
  photo_settings = '{}'
  where id = 'e1500000-0000-0000-0000-000000000001';
insert into public.connection_links (workspace_id, connection_id, label, url, position) values
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1500000-0000-0000-0000-000000000001', 'Instagram', 'https://www.instagram.com/fullband/', 0),
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1500000-0000-0000-0000-000000000001', 'Bandcamp', 'https://fullband.bandcamp.com', 1),
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1500000-0000-0000-0000-000000000001', 'Website', 'https://fullband.example', 2),
  -- A link-in-bio page and Facebook aren't the band's own site.
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1500000-0000-0000-0000-000000000003', 'Website', 'https://linktr.ee/linktreeband', 0),
  ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1500000-0000-0000-0000-000000000003', 'Website', 'https://facebook.com/linktreeband', 1);
update public.connection_band_details set email = 'band@fullband.example'
  where workspace_id = 'e1aaaaaa-0000-0000-0000-0000000000a1' and connection_id = 'e1500000-0000-0000-0000-000000000001';
-- Another band's email for Bare Band doesn't count for this band.
insert into public.connection_band_details (workspace_id, connection_id, email)
  values ('e1aaaaaa-0000-0000-0000-0000000000b2', 'e1500000-0000-0000-0000-000000000002', 'bare@example.com')
  on conflict (workspace_id, connection_id) do update set email = excluded.email;
insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current)
  values ('e1aaaaaa-0000-0000-0000-0000000000a1', 'e1500000-0000-0000-0000-000000000005',
          'e1500000-0000-0000-0000-000000000001', 'member', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

create function pg_temp.missing(what text) returns text language sql as $$
  select coalesce(string_agg(c.name, ',' order by c.name), '')
  from jsonb_array_elements(public.directory_page('e1aaaaaa-0000-0000-0000-0000000000a1', false,
      p_limit => 100, p_missing => what) -> 'rows') r
  join public.connections c on c.id = (r ->> 'id')::uuid
$$;

select is(pg_temp.missing(null), 'Bare Band,Bare Venue,Full Band,Linktree Band,Riley Example', 'no filter: everyone');
select is(pg_temp.missing('instagram'), 'Bare Band,Bare Venue,Linktree Band,Riley Example', 'no Instagram');
select is(pg_temp.missing('bandcamp'), 'Bare Band,Linktree Band', 'no Bandcamp: bands and labels only');
select is(pg_temp.missing('website'), 'Bare Band,Bare Venue,Linktree Band',
  'no website: groups only, and a link-in-bio or Facebook page isn''t one');
select is(pg_temp.missing('email'), 'Bare Band,Bare Venue,Linktree Band,Riley Example',
  'no email: this band''s own, not another band''s');
select is(pg_temp.missing('members'), 'Bare Band,Linktree Band', 'no members: bands only');
select is(pg_temp.missing('photo'), 'Bare Band,Bare Venue,Linktree Band,Riley Example', 'no photo');
select is(pg_temp.missing('town'), 'Bare Band,Bare Venue,Linktree Band,Riley Example', 'no town');
select is(pg_temp.missing('any'), 'Bare Band,Bare Venue,Linktree Band,Riley Example', 'missing anything');
select is((public.directory_page('e1aaaaaa-0000-0000-0000-0000000000a1', false, p_missing => 'bandcamp')
  -> 'counts' ->> 'matched')::int, 2, 'counts follow the filter');
select is(private.is_platform_url('https://soda.bandcamp.com'), true, 'a Bandcamp page is a platform''s');

select * from finish();
rollback;
