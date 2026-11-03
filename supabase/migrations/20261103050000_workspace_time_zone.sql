-- Each band has a time zone (#86).
--
-- "Today" decides whether an outreach date is in the future, which dates the
-- Follow-ups page treats as today, and how timestamps become dates in the CSV
-- export. It was always Pacific time. Now it's the band's own zone, which
-- defaults to Pacific so nothing changes for existing workspaces.
--
-- Set it in the SQL editor until there's a setting for it:
--   update public.workspaces set time_zone = 'America/New_York' where name = 'Some Band';

-- True for a time zone name Postgres knows, like 'America/Chicago'.
create function private.is_time_zone(name text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform now() at time zone name;
  return true;
exception when invalid_parameter_value then
  return false;
end;
$$;

alter table public.workspaces
  add column time_zone text not null default 'America/Los_Angeles'
    constraint workspaces_time_zone_valid check (private.is_time_zone(time_zone));
