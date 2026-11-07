-- Local development seed. FICTIONAL DATA ONLY. Runs on `npm run db:reset`;
-- never pushed to the hosted project.
--
-- Local sign-ins (password: password123)
--   alex@example.com  member (owner) of Merwulf, and an app admin (#71)
--   sam@example.com   member of Merwulf
--   robin@example.com member (owner) of Moth Signal, a second band, so the
--                     shared directory (#185) has another side to it
--   dana@example.com  signed up, not a member: should see nothing

-- ---------------------------------------------------------------------------
-- Auth users
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'alex@example.com'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'sam@example.com'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'robin@example.com'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'dana@example.com')
) as u (id, email);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email in ('alex@example.com', 'sam@example.com', 'robin@example.com', 'dana@example.com');

-- ---------------------------------------------------------------------------
-- Workspace
-- ---------------------------------------------------------------------------

insert into public.workspaces (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Merwulf');

insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'Alex'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'member', 'Sam');

-- ---------------------------------------------------------------------------
-- Places and scenes
-- ---------------------------------------------------------------------------

insert into public.localities
  (id, workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
select l.id, 'aaaaaaaa-0000-0000-0000-000000000001', p.id, p.name, p.region_name, p.region_code,
       p.country_name, p.country_code, p.latitude, p.longitude
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 5746545),  -- Portland, OR
  ('10000000-0000-0000-0000-000000000002'::uuid, 5809844),  -- Seattle, WA
  ('10000000-0000-0000-0000-000000000003'::uuid, 5586437),  -- Boise, ID
  ('10000000-0000-0000-0000-000000000004'::uuid, 5805687)   -- Olympia, WA
) as l (id, place_id)
join public.places p on p.id = l.place_id;

insert into public.scenes (id, workspace_id, name, description, locality_id) values
  ('20000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Portland post-punk', 'Bands and rooms around the east side.', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Portland DIY', 'House shows, basements, all-ages spaces.', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Seattle noise', null, '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Boise underground', null, '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Pacific Northwest', 'Oregon, Washington, and Idaho.', null);

update public.scenes set parent_id = '20000000-0000-0000-0000-000000000005'
  where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
               '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------------------
-- Connections (all fictional)
-- ---------------------------------------------------------------------------

-- Each record is staged with this band's private details (#181), then split:
-- the record into connections, the rest into the band's private layer.
create temp table seed_connections (
  id uuid, workspace_id uuid, name text, kind public.connection_kind,
  person_roles public.person_role[] default '{}', group_type public.group_type,
  status public.connection_status default 'neutral', played_together boolean default false,
  can_help_with text[] default '{}', is_us boolean default false, locality_id uuid,
  email text, phone text, notes text, archived_at timestamptz, created_by uuid
);

insert into pg_temp.seed_connections
  (id, workspace_id, name, kind, person_roles, group_type, status, played_together, can_help_with,
   locality_id, email, notes, created_by)
values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'The Tin Hollows', 'group', '{}', 'band', 'homies', true, '{}',
   '10000000-0000-0000-0000-000000000001', null,
   'Shared two bills in 2026. Always down to trade shows.', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Jo Example', 'person', '{musician,dj}', null, 'homies', true, '{"DJ sets","music videos"}',
   '10000000-0000-0000-0000-000000000001', 'jo@example.com',
   'Sings in The Tin Hollows, spins darkwave on Thursdays.', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Velvet Ditch', 'group', '{}', 'band', 'avoid', true, '{}',
   '10000000-0000-0000-0000-000000000002', null,
   'Played one show with them. Not again.', '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'The Lantern Room', 'group', '{}', 'venue', 'prospect', false, '{}',
   '10000000-0000-0000-0000-000000000002', 'booking@example.com',
   'Books post-punk on weeknights; good fit for a first Seattle date.', '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Riley Sample', 'person', '{promoter}', null, 'prospect', false, '{}',
   '10000000-0000-0000-0000-000000000002', null,
   'Runs a monthly night that pairs touring bands with locals.', '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Static Basement', 'group', '{}', 'venue', 'homies', true, '{}',
   '10000000-0000-0000-0000-000000000001', null, 'All-ages basement. Bring your own PA.', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001',
   'KXXX Night Shift', 'group', '{}', 'radio_station', 'neutral', false, '{}',
   '10000000-0000-0000-0000-000000000003', null, 'Show went on hiatus.', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Morgan Placeholder', 'person', '{photographer,musician}', null, 'neutral', false,
   '{"live photos","screen printing"}',
   '10000000-0000-0000-0000-000000000001', null, null, '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Glass Coyote', 'group', '{}', 'band', 'lets_play', false, '{}',
   '10000000-0000-0000-0000-000000000003', null,
   'Said at the merch table: next time they come through, play together.', '11111111-1111-1111-1111-111111111111');

insert into pg_temp.seed_connections
  (id, workspace_id, name, kind, person_roles, group_type, status, played_together, is_us, locality_id, created_by)
values
  ('c0000000-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Merwulf (sample)', 'group', '{}', 'band', 'neutral', false, true,
   '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Grey Static Records', 'group', '{}', 'label', 'homies', false, false,
   '10000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Night Gleaners', 'group', '{}', 'band', 'lets_play', false, false,
   '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Hit Parade Ghosts', 'group', '{}', 'band', 'neutral', false, false,
   '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Dee Sample', 'person', '{musician}', null, 'homies', true, false,
   '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');

-- An archived band, so the "1 archived" link under the bar has something to open.
insert into pg_temp.seed_connections
  (id, workspace_id, name, kind, person_roles, group_type, status, locality_id, archived_at, created_by)
values
  ('c0000000-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Cassette Funeral', 'group', '{}', 'band', 'neutral',
   '10000000-0000-0000-0000-000000000001', now(), '11111111-1111-1111-1111-111111111111');

insert into public.connections
  (id, workspace_id, name, kind, person_roles, group_type, can_help_with, is_us, locality_id, created_by)
select id, workspace_id, name, kind, person_roles, group_type, can_help_with, is_us, locality_id, created_by
from pg_temp.seed_connections;

update public.connection_band_details d set
  status = s.status, played_together = s.played_together, notes = s.notes,
  email = s.email, phone = s.phone, archived_at = s.archived_at
from pg_temp.seed_connections s
where d.workspace_id = s.workspace_id and d.connection_id = s.id;

-- One starting status each, as if it had been entered that way.
delete from public.connection_status_changes h using pg_temp.seed_connections s
where h.connection_id = s.id and h.from_status is null and h.to_status = 'neutral' and s.status <> 'neutral';
update public.connection_status_changes h set from_status = null
from pg_temp.seed_connections s where h.connection_id = s.id;

insert into public.connection_links (workspace_id, connection_id, label, url, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Bandcamp', 'https://example.com/tin-hollows', 0),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Instagram', 'https://example.com/@tinhollows', 1),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Website', 'https://example.com/lantern-room', 0),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Instagram', 'https://instagram.com/staticbasement.example', 0);

insert into public.connection_scenes (workspace_id, connection_id, scene_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001');

insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, role, is_current, notes) values
  -- Jo: sings in two original bands and a cover band, and DJs
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'member', 'vocals', true, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'member', 'vocals, synth', true, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'member', 'vocals', true, 'Cover band, weddings and dive bars'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', 'works_with', 'DJ', true, 'Thursday darkwave night'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'member', 'bass', false, 'Left in 2025'),
  -- Morgan: Known (neutral), but drums in The Tin Hollows now, so close to us (#140)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 'member', 'drums', true, null),
  -- Riley books The Lantern Room's weeknights (#48)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 'books', 'weeknights', true, null),
  -- Us, our label, a label mate, and a shared member
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000011', 'on_label', null, true, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000011', 'on_label', null, true, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000010', 'member', 'drums', true, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000012', 'member', 'drums', false, 'Filled in for a tour'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'related', 'split 7-inch', true, null);

-- Venue details (#48). The basement's were checked a while ago, so they show their age.
update public.connections set attributes =
  '{"ages": "21_plus", "capacity": "150_300", "space": "licensed", "pa": true, "sound": true, "backline": false,
    "address": "1234 Example Ave", "book_via": "email", "accessibility": "Step-free entry; one all-gender restroom"}'::jsonb
    || jsonb_build_object('checked_on', current_date)
where id = 'c0000000-0000-0000-0000-000000000004';
update public.connections set attributes =
  '{"ages": "all_ages", "capacity": "under_50", "space": "diy", "pa": false, "backline": true,
    "address": "Ask a punk", "book_via": "instagram", "special_terms": "Door split; bring your own PA",
    "checked_on": "2025-12-01"}'::jsonb
where id = 'c0000000-0000-0000-0000-000000000006';

-- ---------------------------------------------------------------------------
-- Outreach and next actions
-- ---------------------------------------------------------------------------

insert into public.outreach_entries (workspace_id, connection_id, occurred_on, channel, summary, author_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '2026-10-12', 'in_person', 'Talked after their set about a split bill in December.', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '2026-09-30', 'instagram', 'DMed congrats on the new single, offered a Portland show.', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
   '2026-10-20', 'email', 'Sent booking inquiry with live video link. No reply yet.', '22222222-2222-2222-2222-222222222222');

insert into public.next_actions (workspace_id, connection_id, description, due_on, assignee_id, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Lock a date for the December split bill', '2026-11-08',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
   'Follow up on the booking inquiry', '2026-11-03',
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005',
   'Ask Velvet Ditch for an intro', null,
   '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

-- ---------------------------------------------------------------------------
-- A second band (#185): Moth Signal, from Olympia, joined after Merwulf
-- ---------------------------------------------------------------------------

insert into public.workspaces (id, name, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Moth Signal', now() + interval '1 second');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'owner', 'Robin');

insert into public.localities
  (id, workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
select l.id, 'aaaaaaaa-0000-0000-0000-000000000002', p.id, p.name, p.region_name, p.region_code,
       p.country_name, p.country_code, p.latitude, p.longitude
from (values
  ('10000000-0000-0000-0000-000000000011'::uuid, 5805687),  -- Olympia, WA
  ('10000000-0000-0000-0000-000000000012'::uuid, 5746545)   -- Portland, OR
) as l (id, place_id)
join public.places p on p.id = l.place_id;

insert into public.connections
  (id, workspace_id, name, kind, person_roles, group_type, is_us, locality_id, created_by)
values
  ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Moth Signal', 'group', '{}', 'band', true, '10000000-0000-0000-0000-000000000011', '55555555-5555-5555-5555-555555555555'),
  ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
   'The Brine Hall', 'group', '{}', 'venue', false, '10000000-0000-0000-0000-000000000011', '55555555-5555-5555-5555-555555555555'),
  ('d0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Paper Lanterns', 'group', '{}', 'band', false, '10000000-0000-0000-0000-000000000012', '55555555-5555-5555-5555-555555555555'),
  ('d0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002',
   'Quinn Example', 'person', '{booker}', null, false, '10000000-0000-0000-0000-000000000011', '55555555-5555-5555-5555-555555555555');

insert into public.connection_links (workspace_id, connection_id, label, url, position) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Website', 'https://example.com/brine-hall', 0);

update public.connection_band_details set status = 'homies', played_together = true
where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000002' and connection_id = 'd0000000-0000-0000-0000-000000000003';

-- Moth Signal's own notes on a venue Merwulf shares. Merwulf never sees them.
insert into public.connection_band_details (workspace_id, connection_id, status, notes) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', 'lets_play',
   'Robin knows the folks who run it.');
delete from public.connection_status_changes where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- Alex runs Seeens locally, so the feedback inbox (#71) has someone to show.
insert into public.app_admins (user_id) values ('11111111-1111-1111-1111-111111111111');
