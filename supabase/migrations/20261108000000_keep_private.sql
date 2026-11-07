-- Shared directory, phase 2, step 1: keep a record private.
--
-- When the directory opens (step 3), every band will see the records other
-- bands share. A band can keep one of its records to itself instead: it
-- stays in that band's directory only. People start private, since they're
-- individuals; venues, bands, labels, and the rest start shared. Your own
-- band's page is always shared. Status, notes, contacts, and the rest of a
-- band's private layer stay private either way.
--
-- Nothing opens yet; this only records the choice.

alter table public.connections
  add column keep_private boolean not null default false;

update public.connections set keep_private = true where kind = 'person';

alter table public.connections
  add constraint connections_us_is_shared check (not (is_us and keep_private));

-- New people start private, however they're added (the form, an import, a
-- lineup, a bandmate making their page).
create function private.default_keep_private()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'person' then
    new.keep_private := true;
  end if;
  return new;
end;
$$;
revoke all on function private.default_keep_private from public;

create trigger connections_default_keep_private
  before insert on public.connections
  for each row execute function private.default_keep_private();

-- Sharing isn't an edit to the record: flipping it alone doesn't change
-- "Updated", or make a bandmate's open edit look out of date. Every other
-- update still stamps it, as before.
drop trigger connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
  before update on public.connections
  for each row
  when (not (old.keep_private is distinct from new.keep_private
    and (to_jsonb(old) - 'keep_private' - 'updated_at') = (to_jsonb(new) - 'keep_private' - 'updated_at')))
  execute function private.set_updated_at();
