-- Roles (#195): members, moderators, and admins, the way forums have long
-- worked.
--
-- Members add records, edit what their band added, and keep their band's
-- own notes. Moderators, trusted people an admin picks, can also fix any
-- shared record's details: name, type, town, links, what they can help
-- with, and venue details. Every moderator edit is logged. Admins (the
-- existing app_admins) can do what moderators can, and make moderators.
--
-- Keep Private gets rules: a venue, band, or any other group can only be
-- kept private by an owner of the band that added it, or a moderator. A
-- person is the person's own call once they've linked their account; until
-- then, the band that added them decides. Moderators can do either.

create table public.app_moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.app_moderators enable row level security;
revoke all on public.app_moderators from anon, authenticated;

-- A moderator or an admin.
create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_moderators where user_id = auth.uid())
    or exists (select 1 from public.app_admins where user_id = auth.uid())
$$;
revoke all on function public.is_moderator from public, anon;
grant execute on function public.is_moderator to authenticated;

-- Admins manage moderators ------------------------------------------------

create function public.list_moderators()
returns table (user_id uuid, email text, display_name text, granted_at timestamptz, admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text,
    (select m.display_name from public.workspace_members m where m.user_id = u.id order by m.created_at limit 1),
    coalesce(mo.granted_at, ad.created_at), ad.user_id is not null
  from auth.users u
  left join public.app_moderators mo on mo.user_id = u.id
  left join public.app_admins ad on ad.user_id = u.id
  where public.is_app_admin() and (mo.user_id is not null or ad.user_id is not null)
  order by ad.user_id is null, lower(u.email)
$$;
revoke all on function public.list_moderators from public, anon;
grant execute on function public.list_moderators to authenticated;

create function public.grant_moderator(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_app_admin() then
    raise exception 'only admins can make moderators' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'no account with that email' using errcode = 'no_data_found';
  end if;
  insert into public.app_moderators (user_id, granted_by) values (v_user, auth.uid())
  on conflict (user_id) do nothing;
  return v_user;
end;
$$;
revoke all on function public.grant_moderator from public, anon;
grant execute on function public.grant_moderator to authenticated;

create function public.revoke_moderator(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'only admins can remove moderators' using errcode = '42501';
  end if;
  delete from public.app_moderators where user_id = p_user_id;
end;
$$;
revoke all on function public.revoke_moderator from public, anon;
grant execute on function public.revoke_moderator to authenticated;

-- Moderator edits -----------------------------------------------------------

-- What a moderator changed, and when. The band that added the record and
-- moderators can read it.
create table public.connection_edits (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.connections (id) on delete cascade,
  edited_by uuid references auth.users (id) on delete set null,
  edited_at timestamptz not null default now(),
  -- Field name -> [before, after].
  changes jsonb not null
);
create index connection_edits_connection_idx on public.connection_edits (connection_id, edited_at desc);
alter table public.connection_edits enable row level security;
revoke all on public.connection_edits from anon, authenticated;
grant select on public.connection_edits to authenticated;
create policy "The record's band and moderators read its edits" on public.connection_edits
  for select to authenticated
  using (
    public.is_moderator()
    or exists (select 1 from public.connections c
      where c.id = connection_id and c.workspace_id in (select private.my_workspace_ids())));

-- A shared record's own details, as a moderator. Not scenes, Our band, or
-- any band's private layer: those stay each band's. The town is kept in the
-- record's band's localities.
create function public.moderate_connection(
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
begin
  if not public.is_moderator() then
    raise exception 'only moderators can edit other bands'' records' using errcode = '42501';
  end if;

  select * into v_old from public.connections
  where id = p_id and merged_into is null and not keep_private
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
    insert into public.connection_edits (connection_id, edited_by, changes)
    values (p_id, auth.uid(), v_changes);
  end if;
end;
$$;
revoke all on function public.moderate_connection from public, anon;
grant execute on function public.moderate_connection to authenticated;

-- Keep Private ---------------------------------------------------------------

-- Who may keep a record private, or share it.
create function private.can_set_keep_private(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_moderator() or exists (
    select 1 from public.connections c
    where c.id = p_connection_id and c.merged_into is null
      and case
        -- Groups: an owner of the band that added it.
        when c.kind = 'group' then exists (
          select 1 from public.workspace_members m
          where m.workspace_id = c.workspace_id and m.user_id = auth.uid() and m.role = 'owner')
        -- A person who's linked their account decides for themselves.
        when exists (select 1 from public.workspace_members l where l.connection_id = c.id) then exists (
          select 1 from public.workspace_members l where l.connection_id = c.id and l.user_id = auth.uid())
        -- Anyone else: the band that added them.
        else c.workspace_id in (select private.my_workspace_ids())
      end)
$$;
revoke all on function private.can_set_keep_private from public;
grant execute on function private.can_set_keep_private to authenticated;

-- Keep records private or share them. Records the caller may not change are
-- left alone and counted; Our band's own page is always shared.
create function public.set_keep_private(p_ids uuid[], p_keep boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed uuid[];
  v_changed int;
begin
  select coalesce(array_agg(c.id), '{}') into v_allowed
  from public.connections c
  where c.id = any (p_ids) and private.can_see_connection(c.id) and private.can_set_keep_private(c.id)
    and not (p_keep and c.is_us);

  perform set_config('seeens.keep_private_ok', 'on', true);
  update public.connections set keep_private = p_keep
  where id = any (v_allowed) and keep_private is distinct from p_keep;
  get diagnostics v_changed = row_count;
  perform set_config('seeens.keep_private_ok', 'off', true);

  return jsonb_build_object('changed', v_changed,
    'refused', cardinality(p_ids) - cardinality(v_allowed));
end;
$$;
revoke all on function public.set_keep_private from public, anon;
grant execute on function public.set_keep_private to authenticated;

-- Members can't flip it directly any more; set_keep_private applies the
-- rules. (Database jobs with no signed-in user, like the seed, still can.)
create function private.guard_keep_private()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.keep_private is distinct from old.keep_private
    and auth.uid() is not null
    and coalesce(current_setting('seeens.keep_private_ok', true), 'off') <> 'on' then
    raise exception 'use set_keep_private' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_keep_private from public;

create trigger connections_guard_keep_private
  before update of keep_private on public.connections
  for each row execute function private.guard_keep_private();

-- A record stays in the band that added it.
create function private.guard_connection_band()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'a record stays with the band that added it' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_connection_band from public;

create trigger connections_guard_band
  before update of workspace_id on public.connections
  for each row execute function private.guard_connection_band();
