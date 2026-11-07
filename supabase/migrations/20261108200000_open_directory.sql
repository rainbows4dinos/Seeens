-- Shared directory, phase 2, step 3a (#185): the database opens.
--
-- Anyone in a band can now read the records other bands share (not the ones
-- they keep private): the record, its town, its links, and its photo. Each
-- band can keep its own private layer on any record it can see: status,
-- played together, notes, contacts, archive, plans, outreach, and status
-- history. Only the band that added a record can change the record itself.
--
-- The app still lists only your band's own records; step 3b shows the rest.
-- Scenes and connections between records stay per band until phase 3.

-- A record you can see: your band's own, or one another band shares. You
-- have to be in a band to see anything.
create function private.can_see_connection(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    where c.id = p_connection_id
      and c.merged_into is null
      and (c.workspace_id in (select private.my_workspace_ids())
        or (not c.keep_private and exists (select 1 from private.my_workspace_ids())))
  )
$$;
revoke all on function private.can_see_connection from public;
grant execute on function private.can_see_connection to authenticated;

-- Records -------------------------------------------------------------------

drop policy "Members can view" on public.connections;
create policy "Members can view" on public.connections
  for select to authenticated
  using (
    merged_into is null
    and (workspace_id in (select private.my_workspace_ids())
      or (not keep_private and exists (select 1 from private.my_workspace_ids())))
  );

-- A shared record's town, links, and photo come with it.
create policy "Members can view towns of shared records" on public.localities
  for select to authenticated
  using (
    exists (select 1 from private.my_workspace_ids())
    and exists (
      select 1 from public.connections c
      where c.locality_id = localities.id and c.workspace_id = localities.workspace_id
        and not c.keep_private and c.merged_into is null)
  );

create policy "Members can view links of shared records" on public.connection_links
  for select to authenticated
  using (private.can_see_connection(connection_id));

create function private.can_view_photo_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where c.workspace_id::text = (storage.foldername(object_name))[1]
      and c.id::text = (storage.foldername(object_name))[2]
  ) and private.can_see_connection(((storage.foldername(object_name))[2])::uuid)
$$;
revoke all on function private.can_view_photo_path from public;
grant execute on function private.can_view_photo_path to authenticated;

drop policy "Members can view connection photos" on storage.objects;
create policy "Members can view connection photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'connection-photos' and private.can_view_photo_path(name));

-- The private layer can sit on any record you can see -------------------------

alter table public.connection_band_details
  drop constraint connection_band_details_workspace_id_connection_id_fkey,
  add constraint connection_band_details_connection_id_fkey
    foreign key (connection_id) references public.connections (id) on delete cascade;
alter table public.next_actions
  drop constraint next_actions_workspace_id_connection_id_fkey,
  add constraint next_actions_connection_id_fkey
    foreign key (connection_id) references public.connections (id) on delete cascade;
alter table public.outreach_entries
  drop constraint outreach_entries_workspace_id_connection_id_fkey,
  add constraint outreach_entries_connection_id_fkey
    foreign key (connection_id) references public.connections (id) on delete cascade;
alter table public.connection_status_changes
  drop constraint connection_status_changes_workspace_id_connection_id_fkey,
  add constraint connection_status_changes_connection_id_fkey
    foreign key (connection_id) references public.connections (id) on delete cascade;

create index if not exists next_actions_connection_idx on public.next_actions (connection_id);
create index if not exists outreach_entries_connection_idx on public.outreach_entries (connection_id);
create index if not exists connection_status_changes_connection_idx on public.connection_status_changes (connection_id);

-- One open plan per band and record, not per record.
drop index public.next_actions_one_open_idx;
create unique index next_actions_one_open_idx on public.next_actions (workspace_id, connection_id)
  where status = 'open';

drop policy "Members add their band's private details" on public.connection_band_details;
create policy "Members add their band's private details" on public.connection_band_details
  for insert to authenticated
  with check (workspace_id in (select private.my_workspace_ids()) and private.can_see_connection(connection_id));

drop policy "Members can add" on public.next_actions;
create policy "Members can add" on public.next_actions
  for insert to authenticated
  with check (workspace_id in (select private.my_workspace_ids()) and private.can_see_connection(connection_id));
drop policy "Members can edit" on public.next_actions;
create policy "Members can edit" on public.next_actions
  for update to authenticated
  using (workspace_id in (select private.my_workspace_ids()))
  with check (workspace_id in (select private.my_workspace_ids()) and private.can_see_connection(connection_id));

drop policy "Members can log outreach as themselves" on public.outreach_entries;
create policy "Members can log outreach as themselves" on public.outreach_entries
  for insert to authenticated
  with check (
    workspace_id in (select private.my_workspace_ids())
    and author_id = (select auth.uid())
    and private.can_see_connection(connection_id));
drop policy "Authors can edit their outreach" on public.outreach_entries;
create policy "Authors can edit their outreach" on public.outreach_entries
  for update to authenticated
  using (workspace_id in (select private.my_workspace_ids()) and author_id = (select auth.uid()))
  with check (
    workspace_id in (select private.my_workspace_ids())
    and author_id = (select auth.uid())
    and private.can_see_connection(connection_id));

-- A plan goes on your band's layer. p_workspace_id is new; without it, the
-- record's own band, as before.
drop function public.set_next_action(uuid, text, date, uuid);
create function public.set_next_action(
  p_connection_id uuid,
  p_description text,
  p_due_on date default null,
  p_assignee_id uuid default null,
  p_workspace_id uuid default null
)
returns public.next_actions
language plpgsql
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_action public.next_actions;
begin
  select coalesce(p_workspace_id, workspace_id) into v_workspace_id
  from public.connections
  where id = p_connection_id;

  if v_workspace_id is null then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;

  update public.next_actions
  set status = 'replaced'
  where connection_id = p_connection_id and workspace_id = v_workspace_id and status = 'open';

  insert into public.next_actions
    (workspace_id, connection_id, description, due_on, assignee_id)
  values
    (v_workspace_id, p_connection_id, p_description, p_due_on, p_assignee_id)
  returning * into v_action;

  return v_action;
end;
$$;
revoke all on function public.set_next_action from public, anon;
grant execute on function public.set_next_action to authenticated;

-- Merging can't strand another band's layer ----------------------------------
-- Merging only moves the merging band's own notes and plans. Until phase 3
-- carries other bands' along, a record another band keeps its own layer on
-- can't be merged away.
create function private.guard_shared_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.connection_band_details d
      where d.connection_id = old.id and d.workspace_id <> old.workspace_id)
    or exists (select 1 from public.next_actions a
      where a.connection_id = old.id and a.workspace_id <> old.workspace_id)
    or exists (select 1 from public.outreach_entries o
      where o.connection_id = old.id and o.workspace_id <> old.workspace_id) then
    raise exception 'another band keeps its own notes on %', old.name
      using errcode = 'check_violation', hint = 'shared';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_shared_merge from public;

create trigger connections_guard_shared_merge
  before update of merged_into on public.connections
  for each row
  when (old.merged_into is null and new.merged_into is not null)
  execute function private.guard_shared_merge();
