-- Removing a member sets their next actions' assignee_id and created_by to
-- null (on delete set null). The guard treated that as editing a closed
-- action and blocked the removal. Let that one change through: a closed
-- action may lose its member references, and nothing else.
create or replace function private.guard_next_action()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'open' then
    if (to_jsonb(new) - 'assignee_id' - 'created_by') = (to_jsonb(old) - 'assignee_id' - 'created_by')
       and (new.assignee_id is null or new.assignee_id = old.assignee_id)
       and (new.created_by is null or new.created_by = old.created_by) then
      return new;
    end if;
    raise exception 'closed next actions are history and cannot be edited'
      using errcode = 'check_violation';
  end if;
  if new.status <> 'open' then
    new.closed_at := now();
    new.closed_by := auth.uid();
  end if;
  return new;
end;
$$;
