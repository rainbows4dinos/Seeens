-- Beta feedback (#71). Testers send it from the app; it lands here, private,
-- because it can mention real bands and people. App admins (Larry, to start)
-- read and sort all of it and decide what becomes a public GitHub issue.

-- App admins run Seeens itself. Separate from band owners, and added by hand:
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;
revoke all on function public.is_app_admin from public, anon;
grant execute on function public.is_app_admin to authenticated;

create type public.feedback_kind as enum ('bug', 'idea', 'confusing', 'other');
create type public.feedback_status as enum ('new', 'looking', 'planned', 'done', 'wont_do');

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- Kept if the account is deleted; the name stays as it was.
  user_id uuid references auth.users (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  sender_name text not null,
  band_name text,
  kind public.feedback_kind not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  -- Context sent along. The path has no query string (it can hold names).
  path text check (path is null or (path like '/%' and path not like '%?%' and char_length(path) <= 300)),
  app_version text check (char_length(app_version) <= 64),
  user_agent text check (char_length(user_agent) <= 500),
  screen text check (char_length(screen) <= 40),
  error_digest text check (char_length(error_digest) <= 100),
  screenshot_path text,
  -- Tracking, by app admins.
  status public.feedback_status not null default 'new',
  github_url text check (github_url is null or github_url ~ '^https://github\.com/[^\s]+$'),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);
create index feedback_user_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;
create policy "Testers read their own feedback; app admins read all" on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
-- Written only through the functions below.
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;

-- Screenshots: private, in a folder named for the sender.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Testers add their own feedback screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Testers and app admins view feedback screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'feedback-screenshots'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_app_admin()));

-- Send feedback. Only band members can (everyone invited is a tester).
create function public.submit_feedback(
  p_workspace_id uuid,
  p_kind public.feedback_kind,
  p_body text,
  p_path text default null,
  p_app_version text default null,
  p_user_agent text default null,
  p_screen text default null,
  p_error_digest text default null,
  p_screenshot_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_band text;
  v_id uuid;
begin
  select m.display_name, w.name into v_name, v_band
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.workspace_id = p_workspace_id and m.user_id = auth.uid();
  if not found then
    raise exception 'not a member' using errcode = 'insufficient_privilege';
  end if;

  if p_screenshot_path is not null
    and p_screenshot_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(webp|jpg)$') then
    raise exception 'bad screenshot' using errcode = 'check_violation';
  end if;

  -- A burst limit, so a stuck button can't flood the inbox.
  if (select count(*) from public.feedback
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many' using errcode = 'check_violation';
  end if;

  insert into public.feedback
    (user_id, workspace_id, sender_name, band_name, kind, body, path, app_version, user_agent, screen,
     error_digest, screenshot_path)
  values
    (auth.uid(), p_workspace_id, v_name, v_band, p_kind, btrim(p_body),
     nullif(split_part(btrim(coalesce(p_path, '')), '?', 1), ''),
     nullif(left(btrim(coalesce(p_app_version, '')), 64), ''),
     nullif(left(btrim(coalesce(p_user_agent, '')), 500), ''),
     nullif(left(btrim(coalesce(p_screen, '')), 40), ''),
     nullif(left(btrim(coalesce(p_error_digest, '')), 100), ''),
     p_screenshot_path)
  returning id into v_id;
  return v_id;
end;
$$;

-- Sort it: status and the GitHub issue it became. App admins only.
create function public.update_feedback(
  p_id uuid,
  p_status public.feedback_status,
  p_github_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'app admins only' using errcode = 'insufficient_privilege';
  end if;
  update public.feedback
  set status = p_status,
      github_url = nullif(btrim(coalesce(p_github_url, '')), ''),
      updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'no such feedback' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Closing the loop: the tester was told it shipped.
create function public.mark_feedback_notified(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'app admins only' using errcode = 'insufficient_privilege';
  end if;
  update public.feedback set notified_at = now(), updated_at = now() where id = p_id;
end;
$$;

revoke all on function public.submit_feedback from public, anon;
revoke all on function public.update_feedback from public, anon;
revoke all on function public.mark_feedback_notified from public, anon;
grant execute on function public.submit_feedback to authenticated;
grant execute on function public.update_feedback to authenticated;
grant execute on function public.mark_feedback_notified to authenticated;
