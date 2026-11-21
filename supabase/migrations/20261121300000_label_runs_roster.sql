-- Labels run their roster (#365).
--
-- A label adds bands to its roster from its own page: any band it can see,
-- or a new one. Roster links used to be "on label" connections, which live
-- in one band's records, so a label whose listing another band added (Union
-- Pole Tapes, added by Merwulf) couldn't add to it. A roster link is the
-- label's own row, pointing at any band. The old "on label" connections
-- still count.
--
-- And a label can fix its current roster bands' details (name, town, links,
-- Not Active), logged as the label's, the way a band fixes its own claimed
-- listing, until the band claims its listing itself.

create table public.roster_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  is_current boolean not null default true,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, connection_id)
);
create index roster_links_connection_idx on public.roster_links (connection_id);
alter table public.roster_links enable row level security;
-- Members read their label's rows; writes go through the functions below.
create policy "Members can view" on public.roster_links for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));

-- The roster: "on label" connections to the label's listing, and its own
-- roster links. A merged band counts as the one it was merged into.
create or replace function public.label_roster(p_workspace_id uuid)
returns table (connection_id uuid, is_current boolean, joined boolean, invited boolean, by_us boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with lbl as (
    select coalesce(w.listing_id,
      (select c.id from public.connections c where c.workspace_id = w.id and c.is_us limit 1)) as id
    from public.workspaces w
    where w.id = p_workspace_id and w.kind = 'label'
      and private.my_role(p_workspace_id) is not null
  ), linked as (
    select a.from_connection_id as id, a.is_current
    from lbl join public.affiliations a on a.to_connection_id = lbl.id and a.kind = 'on_label'
    union all
    select rl.connection_id, rl.is_current
    from lbl cross join public.roster_links rl where rl.workspace_id = p_workspace_id
  ), roster as (
    select b.id, bool_or(l.is_current) as is_current, b.is_us
    from linked l
    join public.connections x on x.id = l.id
    join public.connections b on b.id = coalesce(x.merged_into, x.id)
    where b.kind = 'group' and b.group_type = 'band' and b.merged_into is null
      and (not b.keep_private or b.workspace_id = p_workspace_id)
    group by b.id
  )
  select r.id, r.is_current,
    r.is_us or coalesce(o.members > 0, false),
    coalesce(o.members = 0, false),
    coalesce(o.invited_by_workspace = p_workspace_id, false)
  from roster r
  left join lateral (
    select w.invited_by_workspace,
      (select count(*) from public.workspace_members m where m.workspace_id = w.id) as members
    from public.workspaces w where w.listing_id = r.id
  ) o on true
$$;

-- A label listing's roster, for anyone who can see it. added_here: a roster
-- link from a label you're in, so you can take it off.
drop function public.listing_roster(uuid);
create function public.listing_roster(p_connection_id uuid)
returns table (connection_id uuid, name text, photo_path text, is_current boolean, added_here boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with linked as (
    select a.from_connection_id as id, a.is_current, false as here
    from public.affiliations a
    where a.to_connection_id = p_connection_id and a.kind = 'on_label'
    union all
    select rl.connection_id, rl.is_current, rl.workspace_id in (select private.my_workspace_ids())
    from public.workspaces w
    join public.roster_links rl on rl.workspace_id = w.id
    where w.kind = 'label' and coalesce(w.listing_id,
      (select c.id from public.connections c where c.workspace_id = w.id and c.is_us limit 1)) = p_connection_id
  )
  select b.id, b.name, b.photo_path, bool_or(l.is_current), bool_or(l.here)
  from public.connections lc
  cross join linked l
  join public.connections x on x.id = l.id
  join public.connections b on b.id = coalesce(x.merged_into, x.id)
  where lc.id = p_connection_id and lc.kind = 'group' and lc.group_type = 'label'
    and private.can_see_connection(lc.id)
    and b.kind = 'group' and b.group_type = 'band' and b.merged_into is null
    and private.can_see_connection(b.id)
  group by b.id, b.name, b.photo_path
  order by bool_or(l.is_current) desc, public.name_sort_key(b.name)
$$;
revoke all on function public.listing_roster from public, anon;
grant execute on function public.listing_roster to authenticated;

-- Put a band you can see on your label's roster (again, if it was past).
create function public.roster_add(p_workspace_id uuid, p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role(p_workspace_id) is null
    or not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.kind = 'label') then
    raise exception 'only a label''s members can change its roster' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.connections c
    where c.id = p_connection_id and c.kind = 'group' and c.group_type = 'band' and c.merged_into is null
      and private.can_see_connection(c.id)
  ) then
    raise exception 'only bands go on a roster' using errcode = '23514';
  end if;
  insert into public.roster_links (workspace_id, connection_id, added_by)
  values (p_workspace_id, p_connection_id, auth.uid())
  on conflict (workspace_id, connection_id) do update set is_current = true;
end;
$$;
revoke all on function public.roster_add from public, anon;
grant execute on function public.roster_add to authenticated;

-- A band that isn't on Seeens yet: a new listing of the label's own, on the roster.
create function public.roster_add_new(p_workspace_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if private.my_role(p_workspace_id) is null
    or not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.kind = 'label') then
    raise exception 'only a label''s members can change its roster' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'a name is required' using errcode = '23514';
  end if;
  insert into public.connections (workspace_id, name, kind, group_type, person_roles, created_by)
  values (p_workspace_id, trim(p_name), 'group', 'band', '{}', auth.uid())
  returning id into v_id;
  perform public.roster_add(p_workspace_id, v_id);
  return v_id;
end;
$$;
revoke all on function public.roster_add_new from public, anon;
grant execute on function public.roster_add_new to authenticated;

-- Take a band off: the label's roster link, and its own "on label"
-- connections. Another band's "on label" connection stays theirs.
create function public.roster_remove(p_workspace_id uuid, p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role(p_workspace_id) is null
    or not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.kind = 'label') then
    raise exception 'only a label''s members can change its roster' using errcode = '42501';
  end if;
  delete from public.roster_links where workspace_id = p_workspace_id and connection_id = p_connection_id;
  delete from public.affiliations
  where workspace_id = p_workspace_id and from_connection_id = p_connection_id and kind = 'on_label';
end;
$$;
revoke all on function public.roster_remove from public, anon;
grant execute on function public.roster_remove to authenticated;

-- The name of your label, when this band is on its roster now and hasn't
-- claimed its own listing (then it's theirs). Null otherwise, and for a
-- listing your label added itself (that's already yours).
create function private.my_roster_label(p_connection_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select w.name from public.workspaces w
  join public.connections c on c.id = p_connection_id
  where w.id in (select private.my_workspace_ids()) and w.kind = 'label'
    and c.workspace_id <> w.id
    and not exists (select 1 from public.workspaces x where x.listing_id = p_connection_id)
    and exists (select 1 from public.label_roster(w.id) r where r.connection_id = p_connection_id and r.is_current)
  limit 1
$$;
revoke all on function private.my_roster_label from public;
grant execute on function private.my_roster_label to authenticated;

-- Labels fix their roster bands like a band fixes its claimed listing.
create or replace function public.moderate_connection(
  p_id uuid,
  p_name text,
  p_kind public.connection_kind,
  p_person_roles public.person_role[],
  p_group_type public.group_type,
  p_can_help_with text[],
  p_links jsonb,
  p_place_id integer default null,
  p_keep_locality_id uuid default null,
  p_attributes jsonb default null,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.connections;
  v_new public.connections;
  v_locality_id uuid;
  v_old_links jsonb;
  v_new_links jsonb;
  v_changes jsonb := '{}';
  v_attributes jsonb := case when p_attributes is null or p_attributes - 'checked_on' = '{}'::jsonb
    then p_attributes - 'checked_on'
    else (p_attributes - 'checked_on') || jsonb_build_object('checked_on', current_date) end;
  v_moderator boolean := public.is_moderator();
  v_band_claim text := coalesce(private.my_claim_band(p_id), private.my_roster_label(p_id));
  v_person_claim text := private.my_person_name(p_id);
  v_by_band text := coalesce(v_band_claim, v_person_claim);
begin
  if not v_moderator and v_by_band is null then
    raise exception 'only moderators can edit other bands'' records' using errcode = '42501';
  end if;
  -- A moderator's fix is a moderator's, even on their own band's listing.
  if v_moderator then
    v_by_band := null;
  elsif v_band_claim is not null and (p_kind is distinct from 'group' or p_group_type is distinct from 'band') then
    raise exception 'a claimed band stays a band' using errcode = '23514';
  elsif v_band_claim is null and p_kind is distinct from 'person' then
    raise exception 'you stay a person' using errcode = '23514';
  end if;

  -- Kept private is fine for your own person (your bands can see it).
  select * into v_old from public.connections
  where id = p_id and merged_into is null and (not keep_private or v_person_claim is not null)
  for update;
  if not found then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  if p_expected_updated_at is not null and v_old.updated_at <> p_expected_updated_at then
    raise exception 'connection changed since it was opened' using errcode = 'PT409';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'a name is required' using errcode = '23514';
  end if;

  -- Town: the record's band's locality for the place, added if it's new.
  if p_place_id is not null then
    select id into v_locality_id from public.localities
    where workspace_id = v_old.workspace_id and place_id = p_place_id;
    if v_locality_id is null then
      insert into public.localities
        (workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
      select v_old.workspace_id, p.id, p.name, p.region_name, p.region_code,
             p.country_name, p.country_code, p.latitude, p.longitude
      from public.places p where p.id = p_place_id
      on conflict (workspace_id, place_id) do nothing
      returning id into v_locality_id;
      if v_locality_id is null then
        select id into v_locality_id from public.localities
        where workspace_id = v_old.workspace_id and place_id = p_place_id;
      end if;
      if v_locality_id is null then
        raise exception 'place not found' using errcode = 'no_data_found';
      end if;
    end if;
  elsif p_keep_locality_id is not null then
    -- Only the town it already has (the foreign key keeps it in the band).
    v_locality_id := p_keep_locality_id;
  end if;

  update public.connections set
    name = trim(p_name),
    kind = p_kind,
    person_roles = coalesce(p_person_roles, '{}'),
    group_type = p_group_type,
    can_help_with = coalesce(p_can_help_with, '{}'),
    locality_id = v_locality_id,
    attributes = case
      when v_attributes is null then attributes
      when v_attributes - 'checked_on' = attributes - 'checked_on' then attributes
      else v_attributes end
  where id = p_id
  returning * into v_new;

  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'url', url) order by position), '[]')
    into v_old_links from public.connection_links where connection_id = p_id;
  v_new_links := coalesce((
    select jsonb_agg(jsonb_build_object('label', nullif(trim(l.value ->> 'label'), ''), 'url', l.value ->> 'url') order by l.ord)
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality as l (value, ord)), '[]');
  if v_new_links is distinct from v_old_links then
    delete from public.connection_links where connection_id = p_id;
    insert into public.connection_links (workspace_id, connection_id, label, url, position)
    select v_old.workspace_id, p_id, nullif(trim(l.value ->> 'label'), ''), l.value ->> 'url', (l.ord - 1)::smallint
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality as l (value, ord);
    v_changes := v_changes || jsonb_build_object('links', jsonb_build_array(v_old_links, v_new_links));
  end if;

  -- The log: each field that changed, before and after.
  select v_changes || coalesce(jsonb_object_agg(k, jsonb_build_array(to_jsonb(v_old) -> k, to_jsonb(v_new) -> k)), '{}')
    into v_changes
  from unnest(array['name', 'kind', 'person_roles', 'group_type', 'can_help_with', 'locality_id', 'attributes']) k
  where to_jsonb(v_old) -> k is distinct from to_jsonb(v_new) -> k;

  if v_changes <> '{}' then
    insert into public.connection_edits (connection_id, edited_by, changes, by_band)
    values (p_id, auth.uid(), v_changes, v_by_band);
  end if;
end;
$$;

create or replace function public.set_not_active(p_id uuid, p_inactive boolean)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.connections;
  v_moderator boolean := public.is_moderator();
  v_by_band text := coalesce(private.my_claim_band(p_id), private.my_roster_label(p_id), private.my_person_name(p_id));
  v_ours boolean;
  v_new date;
begin
  select * into v_old from public.connections where id = p_id and merged_into is null for update;
  if not found or not private.can_see_connection(p_id) then
    raise exception 'connection not found' using errcode = 'no_data_found';
  end if;
  v_ours := v_old.workspace_id in (select private.my_workspace_ids());
  if not (v_ours or v_moderator or v_by_band is not null) then
    raise exception 'only its band or a moderator can change this' using errcode = '42501';
  end if;

  v_new := case when p_inactive then coalesce(v_old.inactive_since, current_date) end;
  if v_new is not distinct from v_old.inactive_since then
    return v_new;
  end if;
  update public.connections set inactive_since = v_new where id = p_id;

  -- Someone outside its band: logged like any fix to a shared record.
  if not v_ours then
    insert into public.connection_edits (connection_id, edited_by, changes, by_band)
    values (p_id, auth.uid(),
      jsonb_build_object('not_active', jsonb_build_array(v_old.inactive_since is not null, v_new is not null)),
      case when v_moderator then null else v_by_band end);
  end if;
  return v_new;
end;
$$;
