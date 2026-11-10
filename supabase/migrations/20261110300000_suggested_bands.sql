-- Bands you might know, to start a new band's network: bands that already
-- have you in theirs (a good status, or played together), then shared bands
-- in your town. Which status they gave you stays theirs; it only says they
-- know you. Bands you've already sorted are left out, except in an app
-- admin's preview of Getting Started, which shows what a new band would see.
create function public.suggested_bands(p_workspace_id uuid, p_preview boolean default false)
returns table (connection_id uuid, name text, town text, knows_you boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select w.listing_id, l.name as town, l.region
    from public.workspaces w
    left join public.connections c on c.id = w.listing_id
    left join public.localities l on l.id = c.locality_id
    where w.id = p_workspace_id
      and exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace_id and m.user_id = auth.uid())
  ),
  knows as (
    -- The band's listing, or its own page.
    select coalesce(x.listing_id, (select u.id from public.connections u where u.workspace_id = x.id and u.is_us limit 1)) as id
    from public.connection_band_details d
    join public.workspaces x on x.id = d.workspace_id
    cross join me
    where d.connection_id = me.listing_id and d.workspace_id <> p_workspace_id and d.archived_at is null
      and (d.status in ('homies', 'lets_play', 'prospect') or d.played_together)
  )
  select c.id, c.name, concat_ws(', ', l.name, l.region), c.id in (select k.id from knows k)
  from public.connections c
  left join public.localities l on l.id = c.locality_id
  cross join me
  where c.kind = 'group' and c.group_type = 'band' and c.merged_into is null and not c.keep_private
    and c.id is distinct from me.listing_id and (c.workspace_id <> p_workspace_id or (p_preview and public.is_app_admin()))
    and (c.id in (select k.id from knows k)
      or (me.town is not null and lower(l.name) = lower(me.town) and l.region is not distinct from me.region))
    and ((p_preview and public.is_app_admin()) or not exists (
      select 1 from public.connection_band_details cd
      where cd.workspace_id = p_workspace_id and cd.connection_id = c.id and (cd.status is not null or cd.played_together)))
  order by 4 desc, lower(c.name)
  limit 8
$$;
revoke all on function public.suggested_bands from public, anon;
grant execute on function public.suggested_bands to authenticated;
