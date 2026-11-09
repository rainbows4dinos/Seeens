-- Town nicknames (#234). Scenes are often named with a city's abbreviation
-- or nickname (LA Punk, PDX Garage, Sactown Hardcore), and town search only
-- knew official names, so those scenes lost their town and sat loose instead
-- of inside the town's scene. Now:
--   - place_aliases maps a nickname to one town (a starter list; moderators
--     add more).
--   - Town search knows them: "PDX" suggests Portland, OR.
--   - A new scene whose name has a town's name or nickname as a whole word
--     gets that town, and goes inside the town's own scene when there is one.
--   - Existing scenes get suggestions to confirm; nothing moves on its own.
-- All-caps nicknames (LA, SF, PDX) match only in caps, so "La Luz" isn't LA;
-- others (Sactown, Philly) match any case.

create table public.place_aliases (
  alias text primary key check (char_length(btrim(alias)) between 2 and 40),
  place_id integer not null references public.places (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index place_aliases_lower_idx on public.place_aliases (lower(alias));
create index place_aliases_place_idx on public.place_aliases (place_id);
alter table public.place_aliases enable row level security;
create policy place_aliases_read on public.place_aliases for select to authenticated using (true);
grant select on public.place_aliases to authenticated;

insert into public.place_aliases (alias, place_id) values
  ('PDX', 5746545),
  ('LA', 5368361),
  ('SF', 5391959),
  ('Frisco', 5391959),
  ('NYC', 5128581),
  ('CHI', 4887398),
  ('Chi-Town', 4887398),
  ('Chitown', 4887398),
  ('Sactown', 5389489),
  ('SAC', 5389489),
  ('ATL', 4180439),
  ('Philly', 4560349),
  ('PHL', 4560349),
  ('NOLA', 4335045),
  ('ABQ', 5454711),
  ('Burque', 5454711),
  ('SLC', 5780993),
  ('KC', 4393217),
  ('KCMO', 4393217),
  ('Oly', 5805687),
  ('Bmore', 4347778),
  ('B-more', 4347778),
  ('DC', 4140963),
  ('DMV', 4140963),
  ('BOS', 4930956),
  ('SEA', 5809844),
  ('Vegas', 5506956),
  ('LV', 5506956),
  ('SD', 5391811),
  ('MPLS', 5037649),
  ('Mpls', 5037649),
  ('Oaktown', 5378538),
  ('BK', 5110302),
  ('ATX', 4671654),
  ('HTX', 4699066),
  ('H-Town', 4699066),
  ('DFW', 4684888),
  ('DEN', 5419384),
  ('Motown', 4990729),
  ('PGH', 5206379),
  ('Burgh', 5206379),
  ('Cincy', 4508722),
  ('CLE', 5150529),
  ('Indy', 4259418),
  ('MKE', 5263045),
  ('STL', 4407066),
  ('MEM', 4641239),
  ('PHX', 5308655),
  ('LBC', 5367929),
  ('RVA', 4781708),
  ('MIA', 4164138),
  ('Tampa Bay', 4174757),
  ('O-Town', 4167147),
  ('Jax', 4160021),
  ('CBUS', 4509177),
  ('C-Bus', 4509177),
  ('Provi', 5224151),
  ('BUF', 5110629),
  ('YVR', 6173331),
  ('Tdot', 6167865),
  ('The 6ix', 6167865),
  ('MTL', 6077243),
  ('OKC', 4544349),
  ('SATX', 4726206),
  ('EPT', 5520993),
  ('Funkytown', 4691930)
on conflict do nothing;

-- Moderators keep the list.
create function public.add_place_alias(p_alias text, p_place_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias text := btrim(coalesce(p_alias, ''));
begin
  if not public.is_moderator() then
    raise exception 'only moderators' using errcode = '42501';
  end if;
  if char_length(v_alias) not between 2 and 40 or v_alias !~ '^[[:alnum:]][[:alnum:] .''-]*$' then
    raise exception 'not a nickname' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.places where id = p_place_id) then
    raise exception 'place not found' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.place_aliases where lower(alias) = lower(v_alias)) then
    raise exception 'already a nickname' using errcode = 'unique_violation';
  end if;
  insert into public.place_aliases (alias, place_id) values (v_alias, p_place_id);
end;
$$;

create function public.remove_place_alias(p_alias text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'only moderators' using errcode = '42501';
  end if;
  delete from public.place_aliases where lower(alias) = lower(btrim(p_alias));
end;
$$;

create or replace function public.search_places(
  q text,
  max_results integer default 8,
  prefer_countries text[] default null,
  workspace_id uuid default null
)
returns setof public.places
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_town text := lower(trim(split_part(q, ',', 1)));
  v_qual text := nullif(lower(trim(split_part(q, ',', 2))), '');
  v_prefer text[] := prefer_countries;
  v_nick integer[];
begin
  if length(v_town) < 2 then
    return;
  end if;

  if v_prefer is null then
    -- RLS limits this to workspaces the caller belongs to; workspace_id
    -- narrows it to the band they're working in.
    select coalesce(array_agg(distinct l.country_code), '{}') into v_prefer
    from public.localities l
    where l.country_code is not null
      and (search_places.workspace_id is null or l.workspace_id = search_places.workspace_id);
  end if;

  -- A nickname ("PDX", "Sactown") goes first: the town it means (#234).
  if v_qual is null then
    select coalesce(array_agg(a.place_id), '{}') into v_nick
    from public.place_aliases a where lower(a.alias) = v_town;
    return query select p.* from public.places p where p.id = any (v_nick);
  else
    v_nick := '{}';
  end if;

  -- The town prefix goes in as a literal so the planner can use the indexes.
  return query execute format($sql$
    select p.*
    from public.places p
    where (lower(p.ascii_name) like %1$L or lower(p.name) like %1$L)
      and p.id <> all ($6)
      and (
        $1 is null
        or lower(p.region_code) = $1
        or lower(p.region_name) like $2
        or lower(p.country_code) = $1
        or lower(p.country_name) like $2
      )
    order by (lower(p.ascii_name) = $3 or lower(p.name) = $3) desc,
             p.population::bigint * (case when p.country_code = any ($4) then 20 else 1 end) desc
    limit greatest(least(greatest($5, 1), 20) - cardinality($6), 0)
  $sql$, private.like_prefix(v_town))
  using v_qual, private.like_prefix(v_qual), v_town, v_prefer, max_results, v_nick;
end;
$$;

-- Matching ------------------------------------------------------------------

-- Does the scene name contain this word (a town name or nickname), whole?
-- All caps: exact case. Otherwise any case.
create function private.has_word(p_name text, p_word text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_word is null or char_length(p_word) < 2 then false
    when p_word = upper(p_word) and p_word <> lower(p_word)
      then p_name ~ ('(^|[^[:alnum:]])' || regexp_replace(p_word, '([^[:alnum:] ])', '\\\1', 'g') || '($|[^[:alnum:]])')
    else p_name ~* ('(^|[^[:alnum:]])' || regexp_replace(p_word, '([^[:alnum:] ])', '\\\1', 'g') || '($|[^[:alnum:]])')
  end
$$;

-- Is the whole name just this town (its name or a nickname)? Then the scene
-- is the town's own scene: it gets the town, and nothing to go inside.
create function private.is_town_name(p_name text, p_place_id integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.places p where p.id = p_place_id
                   and lower(btrim(p_name)) in (lower(p.name), lower(p.ascii_name)))
      or exists (select 1 from public.place_aliases a where a.place_id = p_place_id
                   and lower(btrim(p_name)) = lower(a.alias))
$$;

-- The town a scene's name points at, for this band: nicknames, the towns
-- nicknames point at, and the towns the band already knows. One match wins;
-- several (Portland, OR or ME) go to the band's own town if it's one of
-- them; otherwise none (someone places it).
create function private.guess_scene_place(p_workspace_id uuid, p_name text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with hits as (
    select a.place_id from public.place_aliases a where private.has_word(p_name, a.alias)
    union
    select p.id from public.places p
    where p.id in (select place_id from public.place_aliases)
      and (private.has_word(p_name, p.name) or private.has_word(p_name, p.ascii_name))
    union
    select l.place_id from public.localities l
    where l.workspace_id = p_workspace_id and l.place_id is not null and char_length(l.name) >= 3
      and private.has_word(p_name, l.name)
  ),
  home as (
    select l.place_id from public.workspaces w
    join public.connections c on c.id = w.listing_id
    join public.localities l on l.id = c.locality_id
    where w.id = p_workspace_id
  )
  select case
    when (select count(*) from hits) = 1 then (select place_id from hits)
    else (select place_id from hits where place_id in (select place_id from home) limit 1)
  end
$$;

-- The band's locality for a place, added if it's new.
create function private.locality_for(p_workspace_id uuid, p_place_id integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.localities where workspace_id = p_workspace_id and place_id = p_place_id;
  if v_id is null then
    insert into public.localities
      (workspace_id, place_id, name, region, region_code, country, country_code, latitude, longitude)
    select p_workspace_id, p.id, p.name, p.region_name, p.region_code, p.country_name, p.country_code, p.latitude, p.longitude
    from public.places p where p.id = p_place_id
    on conflict (workspace_id, place_id) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.localities where workspace_id = p_workspace_id and place_id = p_place_id;
    end if;
  end if;
  return v_id;
end;
$$;

-- The town's own scene in this band: a top-level scene named for the town
-- (its name or a nickname), or one set to that town that already holds
-- scenes. Oldest first.
create function private.town_scene(p_workspace_id uuid, p_place_id integer, p_not uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.scenes s
  left join public.localities l on l.id = s.locality_id
  where s.workspace_id = p_workspace_id and s.parent_id is null and s.id is distinct from p_not
    and (private.is_town_name(s.name, p_place_id)
      or (l.place_id = p_place_id and exists (select 1 from public.scenes k where k.parent_id = s.id)))
  order by private.is_town_name(s.name, p_place_id) desc, s.created_at
  limit 1
$$;

-- New scenes find their town and the town's scene. Only what's left blank:
-- a town or parent someone chose stays put.
create function private.place_new_scene()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_place integer;
begin
  if new.locality_id is null then
    v_place := private.guess_scene_place(new.workspace_id, new.name);
    if v_place is not null then
      new.locality_id := private.locality_for(new.workspace_id, v_place);
    end if;
  else
    select place_id into v_place from public.localities where id = new.locality_id;
  end if;
  if new.parent_id is null and v_place is not null and not private.is_town_name(new.name, v_place) then
    new.parent_id := private.town_scene(new.workspace_id, v_place, new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.place_new_scene from public;
-- "a_" so it runs before scenes_guard_nesting checks the parent.
create trigger scenes_a_place_new
  before insert on public.scenes
  for each row execute function private.place_new_scene();

-- Existing scenes: suggestions ----------------------------------------------

alter table public.scenes add column town_suggestion_dismissed_at timestamptz;

-- For each scene in the band with something to suggest: the town (when it
-- has none) and the town's scene to go inside (when it's loose, holds no
-- scenes, and isn't the town's own scene).
create function public.scene_suggestions(p_workspace_id uuid)
returns table (scene_id uuid, scene_name text, place_id integer, town text, parent_id uuid, parent_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select s.*, coalesce(l.place_id, private.guess_scene_place(s.workspace_id, s.name)) as place
    from public.scenes s
    left join public.localities l on l.id = s.locality_id
    where s.workspace_id = p_workspace_id
      and private.my_role(p_workspace_id) is not null
      and s.town_suggestion_dismissed_at is null
  ),
  guessed as (
    select m.*,
      case when m.parent_id is null and m.place is not null
             and not private.is_town_name(m.name, m.place)
             and not exists (select 1 from public.scenes k where k.parent_id = m.id)
        then private.town_scene(m.workspace_id, m.place, m.id) end as parent
    from mine m
  )
  select g.id, g.name, case when g.locality_id is null then g.place end,
    case when g.locality_id is null then
      (select p.name || coalesce(', ' || coalesce(p.region_code, case when p.country_code <> 'US' then p.country_name end), '')
       from public.places p where p.id = g.place) end,
    g.parent, (select s.name from public.scenes s where s.id = g.parent)
  from guessed g
  where (g.locality_id is null and g.place is not null) or g.parent is not null
  order by lower(g.name)
$$;

-- Take a suggestion, worked out again here. Members of the scene's band.
create function public.apply_scene_suggestion(p_scene_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select * into s from public.scene_suggestions(
    (select workspace_id from public.scenes where id = p_scene_id)) x where x.scene_id = p_scene_id;
  if not found then
    raise exception 'nothing to suggest' using errcode = 'no_data_found';
  end if;
  update public.scenes set
    locality_id = coalesce(locality_id, case when s.place_id is not null
      then private.locality_for(workspace_id, s.place_id) end),
    parent_id = coalesce(parent_id, s.parent_id)
  where id = p_scene_id;
end;
$$;

create function public.dismiss_scene_suggestion(p_scene_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.scenes set town_suggestion_dismissed_at = now()
  where id = p_scene_id and private.my_role(workspace_id) is not null
$$;

revoke all on function public.add_place_alias, public.remove_place_alias, public.scene_suggestions,
  public.apply_scene_suggestion, public.dismiss_scene_suggestion from public, anon;
grant execute on function public.add_place_alias, public.remove_place_alias, public.scene_suggestions,
  public.apply_scene_suggestion, public.dismiss_scene_suggestion to authenticated;
