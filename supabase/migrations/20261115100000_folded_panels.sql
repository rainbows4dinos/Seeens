-- Folded panels (#314): which panels each person keeps folded, saved to their
-- account so it follows them across devices. Per person, not per band: a
-- panel id means the same thing in every band.

create table public.folded_panels (
  user_id uuid primary key references auth.users (id) on delete cascade,
  panels text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (cardinality(panels) <= 100)
);
alter table public.folded_panels enable row level security;
-- No policies: only the functions below read or write it.
revoke all on public.folded_panels from anon, authenticated;

-- Null until they've folded or opened anything, so a device's older copy
-- can be carried over the first time.
create function public.my_folded_panels()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select f.panels from public.folded_panels f where f.user_id = auth.uid()
$$;

create function public.set_panel_folded(p_panel text, p_folded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_panel is null or p_panel !~ '^[a-z0-9-]{1,60}$' then
    raise exception 'bad panel id' using errcode = '22023';
  end if;
  insert into public.folded_panels (user_id, panels)
  values (auth.uid(), case when p_folded then array[p_panel] else '{}' end)
  on conflict (user_id) do update set
    panels = case
      when p_folded then array_append(array_remove(public.folded_panels.panels, p_panel), p_panel)
      else array_remove(public.folded_panels.panels, p_panel)
    end,
    updated_at = now();
end;
$$;

revoke all on function public.my_folded_panels, public.set_panel_folded from public, anon;
grant execute on function public.my_folded_panels, public.set_panel_folded to authenticated;
