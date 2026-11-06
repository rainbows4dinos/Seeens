-- #169: merge duplicate connections.
--
-- merge_connections(keep, merge[]) folds one or more duplicates into the
-- connection being kept, in one transaction. The kept one wins: its values
-- stay, and the others only fill its blanks (the most complete first).
-- Lists combine: links, scenes, affiliations, outreach, plans, and status
-- history move over, with repeats dropped.
--
-- The merged-away rows aren't deleted. They're hidden (merged_into) for 30
-- days so the merge can be undone, then purged. Every change is written to
-- connection_merges.log, and undo_merge plays it back in reverse.

alter table public.connections
  add column merged_into uuid,
  add column merged_at timestamptz,
  add constraint connections_merged_shape check ((merged_into is null) = (merged_at is null)),
  add constraint connections_not_merged_into_self check (merged_into is distinct from id),
  add foreign key (workspace_id, merged_into)
    references public.connections (workspace_id, id) on delete cascade;

create index connections_merged_idx on public.connections (merged_at) where merged_into is not null;

-- Merged-away connections drop out of every app query: they're invisible,
-- not filtered. merge_connections and undo_merge (security definer) are the
-- only things that see them.
drop policy "Members can view" on public.connections;
create policy "Members can view" on public.connections
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()) and merged_into is null);

-- One row per merge: what was kept, what was folded in, and the log undo
-- replays. Kept after a purge (log emptied) so old links still redirect.
create table public.connection_merges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  keep_id uuid not null,
  merged_ids uuid[] not null check (cardinality(merged_ids) between 1 and 20),
  -- Name, kind, and catalog number of each merged-away one, for the
  -- "Merged … into this one" notice (they can't be read once hidden).
  merged_summary jsonb not null default '[]',
  log jsonb not null default '[]',
  merged_by uuid default auth.uid(),
  merged_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid,
  purged_at timestamptz,
  foreign key (workspace_id, keep_id)
    references public.connections (workspace_id, id) on delete cascade
);

create index connection_merges_keep_idx on public.connection_merges (keep_id, merged_at desc);
create index connection_merges_merged_ids_idx on public.connection_merges using gin (merged_ids);

alter table public.connection_merges enable row level security;
create policy "Members can view merges" on public.connection_merges
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));
grant select on public.connection_merges to authenticated;

-- "Not duplicates": two connections with matching names that a member says
-- are different. The pair is stored in id order so it's found either way.
create table public.connection_not_duplicates (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_a uuid not null,
  connection_b uuid not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (connection_a, connection_b),
  check (connection_a < connection_b),
  foreign key (workspace_id, connection_a)
    references public.connections (workspace_id, id) on delete cascade,
  foreign key (workspace_id, connection_b)
    references public.connections (workspace_id, id) on delete cascade
);

create index connection_not_duplicates_b_idx on public.connection_not_duplicates (connection_b);

alter table public.connection_not_duplicates enable row level security;
create policy "Members can view" on public.connection_not_duplicates
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));
create policy "Members can add" on public.connection_not_duplicates
  for insert to authenticated
  with check (workspace_id in (select private.my_workspace_ids()));
create policy "Members can remove" on public.connection_not_duplicates
  for delete to authenticated
  using (workspace_id in (select private.my_workspace_ids()));
grant select, insert, delete on public.connection_not_duplicates to authenticated;

-- Closed plans are history and can't be edited, except that a merge (and
-- its undo) moves them to another connection, and undo reopens a plan the
-- merge closed. The flag is transaction-local and only set by those two
-- functions; members can't run SQL to set it.
create or replace function private.guard_next_action()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('seeens.merging', true) = 'on' then
    return new;
  end if;
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

-- Roughly how much a connection holds: filled fields plus linked rows.
-- Decides the fill order when several are merged at once.
create function private.connection_weight(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select
    (c.locality_id is not null)::int + (c.email is not null)::int + (c.phone is not null)::int
    + (coalesce(c.notes, '') <> '')::int + (c.photo_path is not null)::int
    + cardinality(c.can_help_with) + (select count(*) from jsonb_object_keys(c.attributes))::int
    + (select count(*) from public.connection_links l where l.connection_id = c.id)::int
    + (select count(*) from public.connection_scenes s where s.connection_id = c.id)::int
    + (select count(*) from public.affiliations a where a.from_connection_id = c.id or a.to_connection_id = c.id)::int
    + (select count(*) from public.outreach_entries o where o.connection_id = c.id)::int
    + (select count(*) from public.next_actions n where n.connection_id = c.id)::int
  from public.connections c
  where c.id = p_id
$$;

revoke all on function private.connection_weight from public, anon, authenticated;

-- Deletes merged-away connections once their 30 days are up. Their rows
-- were all moved, so nothing else goes with them. Called by each merge and
-- by pg_cron where it's installed.
create function private.purge_merged(p_workspace_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.connection_merges m
  set purged_at = now(), log = '[]'
  where m.purged_at is null and m.undone_at is null
    and m.merged_at < now() - interval '30 days'
    and (p_workspace_id is null or m.workspace_id = p_workspace_id);

  delete from public.connections c
  where c.merged_into is not null
    and c.merged_at < now() - interval '30 days'
    and (p_workspace_id is null or c.workspace_id = p_workspace_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.purge_merged from public, anon, authenticated;

create function public.merge_connections(p_keep uuid, p_merge uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws uuid;
  k public.connections;
  l public.connections;
  v_ids uuid[];
  v_lose uuid;
  v_log jsonb := '[]';
  v_old jsonb := '{}';
  v_new jsonb;
  r record;
  e record;
  v_pos integer;
  v_merge uuid;
  v_notes text;
  v_summary jsonb;
begin
  v_ids := array(select distinct x from unnest(p_merge) x where x is not null);
  if cardinality(v_ids) = 0 then
    raise exception 'pick at least one connection to merge' using errcode = 'invalid_parameter_value';
  end if;
  if cardinality(v_ids) > 20 then
    raise exception 'merge up to 20 at a time' using errcode = 'invalid_parameter_value';
  end if;
  if p_keep = any(v_ids) then
    raise exception 'a connection can''t be merged into itself' using errcode = 'invalid_parameter_value';
  end if;

  select * into k from public.connections where id = p_keep for update;
  if not found or k.workspace_id not in (select private.my_workspace_ids()) or k.merged_into is not null then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  v_ws := k.workspace_id;

  perform 1 from public.connections c where c.id = any(v_ids) for update;
  if (select count(*) from public.connections c
      where c.id = any(v_ids) and c.workspace_id = v_ws and c.merged_into is null) <> cardinality(v_ids) then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  if not k.is_us and k.kind <> 'group'
     and exists (select 1 from public.connections c where c.id = any(v_ids) and c.is_us) then
    raise exception 'our band can only be merged into a group' using errcode = 'check_violation';
  end if;

  perform private.purge_merged(v_ws);
  perform set_config('seeens.merging', 'on', true);

  -- Fill order: the most complete first, so it wins any blank.
  v_ids := array(select x from unnest(v_ids) x order by private.connection_weight(x) desc, x);
  select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind,
      'group_type', c.group_type, 'person_roles', c.person_roles, 'catalog_no', c.catalog_no)
    order by array_position(v_ids, c.id))
  into v_summary from public.connections c where c.id = any(v_ids);

  -- The kept row's values before anything fills in, for undo.
  v_old := jsonb_build_object(
    'locality_id', k.locality_id, 'email', k.email, 'phone', k.phone, 'notes', k.notes,
    'can_help_with', to_jsonb(k.can_help_with), 'played_together', k.played_together,
    'person_roles', to_jsonb(k.person_roles), 'attributes', k.attributes, 'is_us', k.is_us);

  foreach v_lose in array v_ids loop
    select * into l from public.connections where id = v_lose;

    -- Blanks on the kept one.
    v_notes := nullif(btrim(coalesce(l.notes, '')), '');
    update public.connections c set
      locality_id = coalesce(c.locality_id, l.locality_id),
      email = coalesce(c.email, l.email),
      phone = coalesce(c.phone, l.phone),
      notes = case
        when v_notes is null then c.notes
        when coalesce(btrim(c.notes), '') = '' then l.notes
        when position(v_notes in c.notes) > 0 then c.notes
        else c.notes || E'\n\n' || 'From ' || l.name || ':' || E'\n' || l.notes end,
      can_help_with = array(select distinct x from unnest(c.can_help_with || l.can_help_with) x),
      played_together = c.played_together or l.played_together,
      person_roles = case when c.kind = 'person' and l.kind = 'person'
        then array(select distinct x from unnest(c.person_roles || l.person_roles) x)
        else c.person_roles end,
      attributes = l.attributes || c.attributes
    where c.id = p_keep;

    -- Only one connection can be us. The kept one takes it.
    if l.is_us then
      update public.connections set is_us = false where id = v_lose;
      update public.connections set is_us = true where id = p_keep;
      v_log := v_log || jsonb_build_object('op', 'us', 'from', v_lose);
    end if;

    -- Links: append after the kept one's, skipping URLs it already has.
    select coalesce(max(position), -1) into v_pos from public.connection_links where connection_id = p_keep;
    for r in select * from public.connection_links where connection_id = v_lose order by position, created_at loop
      if exists (
        select 1 from public.connection_links x
        where x.connection_id = p_keep
          and lower(regexp_replace(regexp_replace(x.url, '^https?://(www\.)?', '', 'i'), '/+$', ''))
            = lower(regexp_replace(regexp_replace(r.url, '^https?://(www\.)?', '', 'i'), '/+$', ''))) then
        delete from public.connection_links where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'connection_links', 'row', to_jsonb(r));
      else
        v_pos := v_pos + 1;
        update public.connection_links set connection_id = p_keep, position = v_pos where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'link', 'id', r.id, 'from', v_lose, 'pos', r.position);
      end if;
    end loop;

    -- Scenes.
    for r in select * from public.connection_scenes where connection_id = v_lose loop
      if exists (select 1 from public.connection_scenes x where x.connection_id = p_keep and x.scene_id = r.scene_id) then
        delete from public.connection_scenes where connection_id = v_lose and scene_id = r.scene_id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'connection_scenes', 'row', to_jsonb(r));
      else
        update public.connection_scenes set connection_id = p_keep
        where connection_id = v_lose and scene_id = r.scene_id;
        v_log := v_log || jsonb_build_object('op', 'scene', 'scene', r.scene_id, 'from', v_lose);
      end if;
    end loop;

    -- Affiliations, both directions. A link to the kept one (or between two
    -- that are both being merged) would point at itself: dropped. One that
    -- the kept one already has is dropped too, after filling its blanks.
    for r in select * from public.affiliations a where a.from_connection_id = v_lose or a.to_connection_id = v_lose loop
      if r.from_connection_id = v_lose and r.to_connection_id = p_keep
         or r.to_connection_id = v_lose and r.from_connection_id = p_keep then
        delete from public.affiliations where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'affiliations', 'row', to_jsonb(r));
        continue;
      end if;

      select * into e from public.affiliations a
      where a.id <> r.id and a.kind = r.kind
        and a.from_connection_id = case when r.from_connection_id = v_lose then p_keep else r.from_connection_id end
        and a.to_connection_id = case when r.to_connection_id = v_lose then p_keep else r.to_connection_id end;
      if found then
        if (e.role is null and r.role is not null) or (e.notes is null and r.notes is not null) then
          update public.affiliations set role = coalesce(role, r.role), notes = coalesce(notes, r.notes) where id = e.id;
          v_log := v_log || jsonb_build_object('op', 'aff_fill', 'id', e.id, 'role', e.role, 'notes', e.notes,
            'new_role', coalesce(e.role, r.role), 'new_notes', coalesce(e.notes, r.notes));
        end if;
        delete from public.affiliations where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'restore', 't', 'affiliations', 'row', to_jsonb(r));
      elsif r.from_connection_id = v_lose then
        update public.affiliations set from_connection_id = p_keep where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'move', 't', 'affiliations', 'col', 'from_connection_id', 'id', r.id, 'from', v_lose);
      else
        update public.affiliations set to_connection_id = p_keep where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'move', 't', 'affiliations', 'col', 'to_connection_id', 'id', r.id, 'from', v_lose);
      end if;
    end loop;

    -- Outreach and status history move as they are.
    for r in select id from public.outreach_entries where connection_id = v_lose loop
      update public.outreach_entries set connection_id = p_keep where id = r.id;
      v_log := v_log || jsonb_build_object('op', 'move', 't', 'outreach_entries', 'col', 'connection_id', 'id', r.id, 'from', v_lose);
    end loop;
    for r in select id from public.connection_status_changes where connection_id = v_lose loop
      update public.connection_status_changes set connection_id = p_keep where id = r.id;
      v_log := v_log || jsonb_build_object('op', 'move_n', 't', 'connection_status_changes', 'id', r.id, 'from', v_lose);
    end loop;

    -- Plans: only one can be open. If the kept one has one, this one's
    -- open plan is closed as dropped before it moves over.
    for r in select id, status from public.next_actions where connection_id = v_lose loop
      if r.status = 'open' and exists (
        select 1 from public.next_actions n where n.connection_id = p_keep and n.status = 'open') then
        update public.next_actions set status = 'dropped', closed_at = now(), closed_by = auth.uid() where id = r.id;
        v_log := v_log || jsonb_build_object('op', 'reopen', 'id', r.id);
      end if;
      update public.next_actions set connection_id = p_keep where id = r.id;
      v_log := v_log || jsonb_build_object('op', 'move', 't', 'next_actions', 'col', 'connection_id', 'id', r.id, 'from', v_lose);
    end loop;

    update public.connections set merged_into = p_keep, merged_at = now() where id = v_lose;
  end loop;

  select jsonb_build_object(
    'locality_id', c.locality_id, 'email', c.email, 'phone', c.phone, 'notes', c.notes,
    'can_help_with', to_jsonb(c.can_help_with), 'played_together', c.played_together,
    'person_roles', to_jsonb(c.person_roles), 'attributes', c.attributes, 'is_us', c.is_us)
  into v_new from public.connections c where c.id = p_keep;
  v_log := jsonb_build_array(jsonb_build_object('op', 'keep', 'old', v_old, 'new', v_new)) || v_log;

  insert into public.connection_merges (workspace_id, keep_id, merged_ids, merged_summary, log)
  values (v_ws, p_keep, v_ids, v_summary, v_log)
  returning id into v_merge;

  perform set_config('seeens.merging', 'off', true);
  return v_merge;
end;
$$;

-- Plays a merge's log back in reverse: rows go back where they were, the
-- dropped repeats come back, and the kept one's filled-in values revert
-- unless someone has changed them since. Within 30 days, and not after the
-- kept one has itself been merged into something else.
create function public.undo_merge(p_merge uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.connection_merges;
  s jsonb;
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_cur jsonb;
  v_set text[] := '{}';
begin
  select * into m from public.connection_merges where id = p_merge for update;
  if not found or m.workspace_id not in (select private.my_workspace_ids()) then
    raise exception 'merge not found' using errcode = 'no_data_found';
  end if;
  if m.undone_at is not null then
    raise exception 'that merge was already undone' using errcode = 'check_violation';
  end if;
  if m.purged_at is not null or m.merged_at < now() - interval '30 days' then
    raise exception 'that merge is more than 30 days old' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.connections c where c.id = m.keep_id and c.merged_into is not null) then
    raise exception 'undo the later merge first' using errcode = 'check_violation';
  end if;

  perform 1 from public.connections c where c.id = m.keep_id or c.id = any(m.merged_ids) for update;
  perform set_config('seeens.merging', 'on', true);

  -- Bring the merged-away ones back first, so rows can point at them again.
  update public.connections set merged_into = null, merged_at = null
  where id = any(m.merged_ids) and merged_into = m.keep_id;

  for s in select value from jsonb_array_elements(m.log) with ordinality as t(value, n) order by n desc loop
    case s ->> 'op'
      when 'move' then
        if s ->> 't' not in ('affiliations', 'outreach_entries', 'next_actions') then
          raise exception 'unknown table in merge log';
        end if;
        execute format('update public.%I set %I = $1 where id = $2 and %I = $3',
          s ->> 't', coalesce(s ->> 'col', 'connection_id'), coalesce(s ->> 'col', 'connection_id'))
          using (s ->> 'from')::uuid, (s ->> 'id')::uuid, m.keep_id;
      when 'move_n' then
        update public.connection_status_changes set connection_id = (s ->> 'from')::uuid
        where id = (s ->> 'id')::bigint and connection_id = m.keep_id;
      when 'link' then
        update public.connection_links set connection_id = (s ->> 'from')::uuid, position = (s ->> 'pos')::smallint
        where id = (s ->> 'id')::uuid and connection_id = m.keep_id;
      when 'scene' then
        update public.connection_scenes set connection_id = (s ->> 'from')::uuid
        where connection_id = m.keep_id and scene_id = (s ->> 'scene')::uuid;
      when 'restore' then
        if s ->> 't' not in ('affiliations', 'connection_links', 'connection_scenes') then
          raise exception 'unknown table in merge log';
        end if;
        execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
          s ->> 't', s ->> 't')
          using s -> 'row';
      when 'aff_fill' then
        update public.affiliations a set
          role = case when a.role is not distinct from s ->> 'new_role' then s ->> 'role' else a.role end,
          notes = case when a.notes is not distinct from s ->> 'new_notes' then s ->> 'notes' else a.notes end
        where a.id = (s ->> 'id')::uuid;
      when 'reopen' then
        update public.next_actions set status = 'open', closed_at = null, closed_by = null
        where id = (s ->> 'id')::uuid and status = 'dropped'
          and not exists (select 1 from public.next_actions n
            where n.connection_id = public.next_actions.connection_id and n.status = 'open');
      when 'us' then
        update public.connections set is_us = false where id = m.keep_id;
        update public.connections set is_us = true where id = (s ->> 'from')::uuid;
      when 'keep' then
        -- Revert each filled-in value that's still what the merge left.
        v_old := s -> 'old';
        v_new := s -> 'new';
        select to_jsonb(c) into v_cur from public.connections c where c.id = m.keep_id;
        for v_col in select jsonb_object_keys(v_old) loop
          if v_col <> 'is_us' and v_cur -> v_col is not distinct from v_new -> v_col
             and v_old -> v_col is distinct from v_new -> v_col then
            v_set := v_set || v_col;
          end if;
        end loop;
        update public.connections c set
          locality_id = case when 'locality_id' = any(v_set) then (v_old ->> 'locality_id')::uuid else c.locality_id end,
          email = case when 'email' = any(v_set) then v_old ->> 'email' else c.email end,
          phone = case when 'phone' = any(v_set) then v_old ->> 'phone' else c.phone end,
          notes = case when 'notes' = any(v_set) then v_old ->> 'notes' else c.notes end,
          can_help_with = case when 'can_help_with' = any(v_set)
            then array(select jsonb_array_elements_text(v_old -> 'can_help_with')) else c.can_help_with end,
          played_together = case when 'played_together' = any(v_set)
            then (v_old ->> 'played_together')::boolean else c.played_together end,
          person_roles = case when 'person_roles' = any(v_set)
            then array(select jsonb_array_elements_text(v_old -> 'person_roles'))::public.person_role[] else c.person_roles end,
          attributes = case when 'attributes' = any(v_set) then v_old -> 'attributes' else c.attributes end
        where c.id = m.keep_id;
      else
        raise exception 'unknown step in merge log';
    end case;
  end loop;

  update public.connection_merges set undone_at = now(), undone_by = auth.uid() where id = p_merge;
  perform set_config('seeens.merging', 'off', true);
  return m.keep_id;
end;
$$;

-- Where a merged-away connection went: follows merges to the one that's
-- still here, so old links and bookmarks land somewhere useful.
create function public.merged_target(p_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_next uuid;
begin
  for i in 1..20 loop
    select c.merged_into into v_next from public.connections c
    where c.id = v_id and c.workspace_id in (select private.my_workspace_ids());
    if not found then
      -- Purged: the merge record still says where it went.
      select m.keep_id into v_next from public.connection_merges m
      where v_id = any(m.merged_ids) and m.undone_at is null
        and m.workspace_id in (select private.my_workspace_ids())
      order by m.merged_at desc limit 1;
      if not found then
        return null;
      end if;
    end if;
    if v_next is null then
      return case when v_id = p_id then null else v_id end;
    end if;
    v_id := v_next;
  end loop;
  return null;
end;
$$;

revoke all on function public.merge_connections from public, anon;
revoke all on function public.undo_merge from public, anon;
revoke all on function public.merged_target from public, anon;
grant execute on function public.merge_connections to authenticated;
grant execute on function public.undo_merge to authenticated;
grant execute on function public.merged_target to authenticated;

-- Daily purge where pg_cron is available (Supabase: enable it under
-- Database > Extensions). Merges also purge their own workspace.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-merged-connections', '17 4 * * *', 'select private.purge_merged()');
  end if;
end;
$$;
