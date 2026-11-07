-- Shared directory, phase 1, step 2 (#181): the app reads and writes the
-- private layer directly.
--
-- Members can now change their own band's row in connection_band_details
-- (status, played together, notes, email, phone, archived). Until step 3
-- drops the old columns on connections, the two stay in sync both ways:
-- database functions still write connections, the app now writes here.
-- Each sync only writes when something differs, so they don't ping-pong.

create policy "Members add their band's private details" on public.connection_band_details
  for insert to authenticated
  with check (workspace_id in (select private.my_workspace_ids()));
create policy "Members change their band's private details" on public.connection_band_details
  for update to authenticated
  using (workspace_id in (select private.my_workspace_ids()))
  with check (workspace_id in (select private.my_workspace_ids()));

grant insert (workspace_id, connection_id, status, played_together, notes, email, phone, archived_at)
  on public.connection_band_details to authenticated;
grant update (status, played_together, notes, email, phone, archived_at)
  on public.connection_band_details to authenticated;

create function private.touch_band_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger connection_band_details_touch
  before update on public.connection_band_details
  for each row execute function private.touch_band_details();

-- connections -> private layer, now only when something differs.
create or replace function private.sync_connection_band_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.connection_band_details
    (workspace_id, connection_id, status, played_together, notes, email, phone, archived_at)
  values
    (new.workspace_id, new.id, new.status, new.played_together, new.notes, new.email, new.phone, new.archived_at)
  on conflict (workspace_id, connection_id) do update set
    status = excluded.status,
    played_together = excluded.played_together,
    notes = excluded.notes,
    email = excluded.email,
    phone = excluded.phone,
    archived_at = excluded.archived_at
  where (connection_band_details.status, connection_band_details.played_together, connection_band_details.notes,
         connection_band_details.email, connection_band_details.phone, connection_band_details.archived_at)
    is distinct from
        (excluded.status, excluded.played_together, excluded.notes, excluded.email, excluded.phone, excluded.archived_at);
  return null;
end;
$$;

-- Private layer -> connections, so database functions that still read the
-- old columns (the directory, merges, the export) see the change. Status
-- history is still logged by the trigger on connections, as the member.
create function private.sync_band_details_to_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections c set
    status = new.status,
    played_together = new.played_together,
    notes = new.notes,
    email = new.email,
    phone = new.phone,
    archived_at = new.archived_at
  where c.id = new.connection_id and c.workspace_id = new.workspace_id
    and (c.status, c.played_together, c.notes, c.email, c.phone, c.archived_at)
      is distinct from (new.status, new.played_together, new.notes, new.email, new.phone, new.archived_at);
  return null;
end;
$$;
revoke all on function private.sync_band_details_to_connection from public;

create trigger connection_band_details_sync_back
  after insert or update on public.connection_band_details
  for each row execute function private.sync_band_details_to_connection();
