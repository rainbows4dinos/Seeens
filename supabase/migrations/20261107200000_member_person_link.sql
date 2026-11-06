-- Link member accounts to their person in the directory (#44). A membership
-- points at one person connection: "Larry" who signs in is "Larry" who plays
-- in Merwulf. The link lives on the membership, so removing a member drops
-- it, while the person, their links, and their history stay.

alter table public.workspace_members
  add column connection_id uuid,
  add constraint workspace_members_connection_fkey
    foreign key (workspace_id, connection_id)
    references public.connections (workspace_id, id) on delete set null (connection_id);

-- One person per account and one account per person, within a band.
create unique index workspace_members_connection_idx
  on public.workspace_members (workspace_id, connection_id)
  where connection_id is not null;

-- Only you link yourself, through these functions; nobody can write the
-- column directly (members can only read workspace_members).

create function public.link_me_to_person(p_workspace_id uuid, p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()
  ) then
    raise exception 'not a member' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.connections
    where id = p_connection_id and workspace_id = p_workspace_id and kind = 'person' and merged_into is null
  ) then
    raise exception 'not a person here' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and connection_id = p_connection_id and user_id <> auth.uid()
  ) then
    raise exception 'someone else' using errcode = 'unique_violation';
  end if;

  update public.workspace_members set connection_id = p_connection_id
  where workspace_id = p_workspace_id and user_id = auth.uid();
end;
$$;

create function public.unlink_me(p_workspace_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspace_members set connection_id = null
  where workspace_id = p_workspace_id and user_id = auth.uid();
$$;

-- Make your page: a person named as you are in the band, added as a member
-- of the band marked "us" (if there is one), and linked to you.
create function public.create_my_person(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_us uuid;
  v_id uuid;
begin
  select display_name into v_name from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid() and connection_id is null;
  if not found then
    if exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()) then
      raise exception 'already linked' using errcode = 'unique_violation';
    end if;
    raise exception 'not a member' using errcode = 'insufficient_privilege';
  end if;

  insert into public.connections (workspace_id, name, kind, person_roles, created_by)
  values (p_workspace_id, v_name, 'person', '{musician}', auth.uid())
  returning id into v_id;

  select id into v_us from public.connections
  where workspace_id = p_workspace_id and is_us and kind = 'group' and merged_into is null and archived_at is null
  order by created_at limit 1;
  if v_us is not null then
    insert into public.affiliations (workspace_id, from_connection_id, to_connection_id, kind, is_current)
    values (p_workspace_id, v_id, v_us, 'member', true);
  end if;

  update public.workspace_members set connection_id = v_id
  where workspace_id = p_workspace_id and user_id = auth.uid();
  return v_id;
end;
$$;

-- Merging people (#169): the link follows the person to the one kept, unless
-- that one is already someone's. (Purging the merged row then drops it.)
create function private.move_member_link_on_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into is not null and old.merged_into is null then
    update public.workspace_members m set connection_id = new.merged_into
    where m.workspace_id = new.workspace_id and m.connection_id = new.id
      and not exists (
        select 1 from public.workspace_members o
        where o.workspace_id = new.workspace_id and o.connection_id = new.merged_into
      );
  end if;
  return new;
end;
$$;

create trigger connections_move_member_link
  after update of merged_into on public.connections
  for each row execute function private.move_member_link_on_merge();

revoke all on function public.link_me_to_person from public, anon;
revoke all on function public.unlink_me from public, anon;
revoke all on function public.create_my_person from public, anon;
revoke all on function private.move_member_link_on_merge from public;
grant execute on function public.link_me_to_person to authenticated;
grant execute on function public.unlink_me to authenticated;
grant execute on function public.create_my_person to authenticated;
