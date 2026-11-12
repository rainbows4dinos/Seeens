-- Arrange Home (#313): each person's order for Home's rows, per band, and
-- which ones they've hidden. Nothing saved means the default.

create table public.home_layouts (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Row keys in order, shown ones only. The app knows the keys; anything it
  -- doesn't know is skipped, and rows it adds later show up at the end.
  shown text[] not null,
  hidden text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  check (cardinality(shown) <= 20 and cardinality(hidden) <= 20)
);
alter table public.home_layouts enable row level security;
-- No policies: only the functions below read or write it.

create function public.home_layout(p_workspace_id uuid)
returns table (shown text[], hidden text[])
language sql
stable
security definer
set search_path = ''
as $$
  select h.shown, h.hidden from public.home_layouts h
  where h.workspace_id = p_workspace_id and h.user_id = auth.uid()
$$;

-- Null clears it back to the default.
create function public.set_home_layout(p_workspace_id uuid, p_shown text[], p_hidden text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role(p_workspace_id) is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if p_shown is null then
    delete from public.home_layouts where workspace_id = p_workspace_id and user_id = auth.uid();
    return;
  end if;
  insert into public.home_layouts (workspace_id, user_id, shown, hidden)
  values (p_workspace_id, auth.uid(), p_shown, coalesce(p_hidden, '{}'))
  on conflict (workspace_id, user_id)
  do update set shown = excluded.shown, hidden = excluded.hidden, updated_at = now();
end;
$$;

revoke all on function public.home_layout, public.set_home_layout from public, anon;
grant execute on function public.home_layout, public.set_home_layout to authenticated;
