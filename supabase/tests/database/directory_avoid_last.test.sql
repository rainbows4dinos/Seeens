-- The Directory shows everyone, Avoid last (#273). Run with: npm run db:test
-- Fixture data is fictional and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

delete from public.connections;

insert into auth.users (id, email) values ('da111111-1111-1111-1111-111111111111', 'avoid-last@example.com');
insert into public.workspaces (id, name) values
  ('daaaaaaa-0000-0000-0000-0000000000a1', 'Last Band'),
  ('daaaaaaa-0000-0000-0000-0000000000a2', 'Sharing Band');
insert into public.workspace_members (workspace_id, user_id, role, display_name) values
  ('daaaaaaa-0000-0000-0000-0000000000a1', 'da111111-1111-1111-1111-111111111111', 'owner', 'Ana');

-- One of each: Avoid, no status (shared by another band), Homies, Heard of.
-- Names sort the other way round, so only the status order can put them right.
insert into public.connections (id, workspace_id, name, kind, person_roles, group_type, is_us) values
  ('dac00000-0000-0000-0000-000000000001', 'daaaaaaa-0000-0000-0000-0000000000a1', 'Aardvarks', 'group', '{}', 'band', false),
  ('dac00000-0000-0000-0000-000000000002', 'daaaaaaa-0000-0000-0000-0000000000a2', 'Badgers', 'group', '{}', 'band', false),
  ('dac00000-0000-0000-0000-000000000003', 'daaaaaaa-0000-0000-0000-0000000000a1', 'Coyotes', 'group', '{}', 'band', false),
  ('dac00000-0000-0000-0000-000000000004', 'daaaaaaa-0000-0000-0000-0000000000a1', 'Dingoes', 'group', '{}', 'band', false);
insert into public.connection_band_details (workspace_id, connection_id, status) values
  ('daaaaaaa-0000-0000-0000-0000000000a1', 'dac00000-0000-0000-0000-000000000001', 'avoid'),
  ('daaaaaaa-0000-0000-0000-0000000000a1', 'dac00000-0000-0000-0000-000000000003', 'neutral'),
  ('daaaaaaa-0000-0000-0000-0000000000a1', 'dac00000-0000-0000-0000-000000000004', 'homies')
on conflict (workspace_id, connection_id) do update set status = excluded.status;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"da111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

create function pg_temp.names(r jsonb) returns text[] language sql as $$
  select coalesce(array_agg(c.name order by e.n), '{}')
  from jsonb_array_elements(r -> 'rows') with ordinality as e(v, n)
  join public.connections c on c.id = (e.v ->> 'id')::uuid
$$;

select is(pg_temp.names(public.directory_page('daaaaaaa-0000-0000-0000-0000000000a1', false, p_hide_avoid => false)),
  array['Dingoes', 'Coyotes', 'Badgers', 'Aardvarks'], 'Homies, Heard of, no status, then Avoid last');

-- Paging keeps that order across pages.
select is(pg_temp.names(public.directory_page('daaaaaaa-0000-0000-0000-0000000000a1', false, p_hide_avoid => false,
  p_limit => 3, p_counts => false,
  p_after => public.directory_page('daaaaaaa-0000-0000-0000-0000000000a1', false, p_hide_avoid => false, p_limit => 3, p_counts => false) -> 'next')),
  array['Aardvarks'], 'Avoid is on the last page');

select is(pg_temp.names(public.directory_page('daaaaaaa-0000-0000-0000-0000000000a1', false)),
  array['Dingoes', 'Coyotes', 'Badgers'], 'still hidden when asked to hide it');

select * from finish();
rollback;
