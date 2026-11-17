-- Getting Started (#354): sending an invite finishes the invite step. Whether
-- they join is up to them, so an open invite counts, or one already taken.
-- A revoked or expired invite doesn't.
create or replace function public.getting_started(p_workspace_id uuid)
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
    'invited', exists (
      select 1 from public.invites i
      where i.workspace_id = p_workspace_id and i.revoked_at is null
        and (i.accepted_at is not null or i.expires_at > now())),
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
