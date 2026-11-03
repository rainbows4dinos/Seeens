-- Rules the app already follows, now enforced by the database too (#85), so
-- a bug or a direct API call can't break them.

-- ---------------------------------------------------------------------------
-- Scenes nest one level deep
-- ---------------------------------------------------------------------------
-- A scene's parent must be a top-level scene, and a scene that has scenes
-- inside it can't go inside another. That also rules out loops (a scene
-- inside its own child), which made scenes vanish from the Scenes page.

create function private.guard_scene_nesting()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  -- Lock the parent so two bandmates can't nest two scenes inside each
  -- other at the same moment.
  select parent_id into v_grandparent
  from public.scenes
  where id = new.parent_id
  for update;

  if v_grandparent is not null then
    raise exception 'a scene can only go inside a top-level scene'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.scenes where parent_id = new.id) then
    raise exception 'a scene with scenes inside it can''t go inside another scene'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger scenes_guard_nesting
  before insert or update of parent_id on public.scenes
  for each row execute function private.guard_scene_nesting();

-- ---------------------------------------------------------------------------
-- Authors are who they say they are
-- ---------------------------------------------------------------------------
-- created_by on connections and next actions is always the signed-in member
-- who added the row, whatever the request says. It can't be changed later,
-- except to null when that member is removed from the band (the foreign
-- key's on delete set null).
--
-- With no signed-in user (migrations, seeds, the SQL editor), whatever was
-- given is kept.

create function private.stamp_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  elsif new.created_by is distinct from old.created_by and new.created_by is not null then
    raise exception 'created_by can''t be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger connections_stamp_created_by
  before insert or update of created_by on public.connections
  for each row execute function private.stamp_created_by();

create trigger next_actions_stamp_created_by
  before insert or update of created_by on public.next_actions
  for each row execute function private.stamp_created_by();
