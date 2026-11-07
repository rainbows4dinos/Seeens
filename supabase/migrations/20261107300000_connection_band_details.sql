-- Shared directory, phase 1, step 1 of 3 (#181): the private layer.
--
-- Seeens is becoming one directory every band shares. What a band thinks of
-- someone and what it knows privately stays the band's own: status, notes,
-- email, phone, played together, and whether it archived them. This adds a
-- table for that, one row per band and record, copies today's values in, and
-- keeps it in sync with the old columns. Nothing reads it yet, and nothing
-- is removed: step 2 moves the app over, step 3 drops the old columns.

create table public.connection_band_details (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null,
  status public.connection_status not null default 'neutral',
  played_together boolean not null default false,
  notes text,
  email text,
  phone text,
  -- Archiving hides a record from one band's directory, not everyone's.
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, connection_id),
  foreign key (workspace_id, connection_id)
    references public.connections (workspace_id, id) on delete cascade
);

create index connection_band_details_connection_idx on public.connection_band_details (connection_id);
create index connection_band_details_status_idx on public.connection_band_details (workspace_id, status);

alter table public.connection_band_details enable row level security;
create policy "Members read their band's private details" on public.connection_band_details
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));
-- Written only by the sync below for now (step 2 adds the real writers).
revoke all on public.connection_band_details from anon, authenticated;
grant select on public.connection_band_details to authenticated;

insert into public.connection_band_details
  (workspace_id, connection_id, status, played_together, notes, email, phone, archived_at, updated_at)
select workspace_id, id, status, played_together, notes, email, phone, archived_at, updated_at
from public.connections;

-- Keep the copy current while the app still writes the old columns.
create function private.sync_connection_band_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.connection_band_details
    (workspace_id, connection_id, status, played_together, notes, email, phone, archived_at, updated_at)
  values
    (new.workspace_id, new.id, new.status, new.played_together, new.notes, new.email, new.phone, new.archived_at, now())
  on conflict (workspace_id, connection_id) do update set
    status = excluded.status,
    played_together = excluded.played_together,
    notes = excluded.notes,
    email = excluded.email,
    phone = excluded.phone,
    archived_at = excluded.archived_at,
    updated_at = now();
  return null;
end;
$$;
revoke all on function private.sync_connection_band_details from public;

create trigger connections_sync_band_details
  after insert or update of status, played_together, notes, email, phone, archived_at on public.connections
  for each row execute function private.sync_connection_band_details();
