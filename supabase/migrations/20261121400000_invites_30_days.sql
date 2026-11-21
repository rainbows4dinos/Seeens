-- Invites last 30 days, not 7 (#367). Bands and labels are busy; a week
-- ran out on several before anyone opened them. Open invites get the
-- longer window too, counted from when they were made.
alter table public.invites alter column expires_at set default now() + interval '30 days';
update public.invites set expires_at = greatest(expires_at, created_at + interval '30 days')
where accepted_at is null and revoked_at is null and expires_at > now();

-- A fresh link: good for 30 days from now.
create or replace function public.renew_band_invite(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := private.invite_token();
begin
  if not public.is_app_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  update public.invites
  set token_hash = private.token_hash(v_token), expires_at = greatest(expires_at, now() + interval '30 days')
  where id = p_invite_id and role = 'owner' and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'invite closed' using errcode = 'check_violation';
  end if;
  return v_token;
end;
$$;

create or replace function public.renew_invite_link(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invites;
  v_token text := private.invite_token();
begin
  select * into i from public.invites where id = p_invite_id for update;
  if not found or private.my_role(i.workspace_id) is null then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  if i.invited_by is distinct from auth.uid() and private.my_role(i.workspace_id) <> 'owner' then
    raise exception 'only the sender or an owner' using errcode = 'insufficient_privilege';
  end if;
  if i.accepted_at is not null or i.revoked_at is not null then
    raise exception 'invite closed' using errcode = 'check_violation';
  end if;
  update public.invites
  set token_hash = private.token_hash(v_token), expires_at = greatest(expires_at, now() + interval '30 days')
  where id = p_invite_id;
  return v_token;
end;
$$;
