-- Getting started (#68): a checklist on a band's My Network for each new
-- member, until they've done it or put it away. Per person, per band: a
-- bandmate who joins later still gets it.

alter table public.workspace_members add column getting_started_dismissed_at timestamptz;

-- Where you are on the checklist, for a band you're in. Null otherwise.
create function public.getting_started(p_workspace_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dismissed', me.getting_started_dismissed_at is not null,
    -- Your band's page: its listing, and whether it has a town or a link.
    'listing_id', w.listing_id,
    'listing_filled', exists (
      select 1 from public.connections c
      where c.id = w.listing_id
        and (c.locality_id is not null or exists (select 1 from public.connection_links l where l.connection_id = c.id))),
    'members', (select count(*) from public.workspace_members m where m.workspace_id = p_workspace_id),
    -- My Network's size: what the band added, or gave a status or "played
    -- together" (the band's own page aside).
    'network', (
      select count(*) from public.connections c
      left join public.connection_band_details cd on cd.workspace_id = p_workspace_id and cd.connection_id = c.id
      where c.merged_into is null and c.id is distinct from w.listing_id and not (c.is_us and c.workspace_id = p_workspace_id)
        and (c.workspace_id = p_workspace_id or cd.status is not null or cd.played_together)
        and (c.workspace_id = p_workspace_id or not c.keep_private)),
    'linked', me.connection_id is not null)
  from public.workspace_members me
  join public.workspaces w on w.id = me.workspace_id
  where me.workspace_id = p_workspace_id and me.user_id = auth.uid()
$$;

create function public.dismiss_getting_started(p_workspace_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspace_members set getting_started_dismissed_at = now()
  where workspace_id = p_workspace_id and user_id = auth.uid()
$$;

revoke all on function public.getting_started, public.dismiss_getting_started from public, anon;
grant execute on function public.getting_started, public.dismiss_getting_started to authenticated;

-- It's for new members: everyone already in a band has it put away.
update public.workspace_members set getting_started_dismissed_at = now();
