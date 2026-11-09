-- More than one band (#68). People often play in a few, so someone already
-- in a band can be invited to start another; the account menu switches
-- between them. Same as before, without the one-band check.

create or replace function public.invite_band(p_listing_id uuid, p_band text, p_email text, p_name text)
returns table (workspace_id uuid, invite_id uuid, token text, band text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_band text := btrim(coalesce(p_band, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_token text := private.invite_token();
  v_listing public.connections;
  v_sender text;
  v_workspace uuid;
  v_invite uuid;
  v_claims text;
begin
  if not public.is_app_admin() then
    raise exception 'only admins can invite bands' using errcode = '42501';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'not an email address' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is not null and exists (select 1 from public.invite_optouts o where o.email = v_email) then
    raise exception 'opted out' using errcode = 'check_violation';
  end if;

  if p_listing_id is not null then
    select * into v_listing from public.connections c where c.id = p_listing_id for update;
    if not found or v_listing.merged_into is not null or v_listing.kind <> 'group'
      or v_listing.group_type is distinct from 'band' or v_listing.keep_private or v_listing.is_us then
      raise exception 'not a band listing' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.workspaces w where w.listing_id = p_listing_id) then
      raise exception 'already claimed' using errcode = 'unique_violation';
    end if;
    v_band := v_listing.name;
  else
    if char_length(v_band) not between 1 and 80 then
      raise exception 'band name must be 1 to 80 characters' using errcode = 'check_violation';
    end if;
    -- Listed already: claim that one instead of making a second.
    if exists (
      select 1 from public.connections c
      where c.kind = 'group' and c.group_type = 'band' and c.merged_into is null and not c.keep_private
        and lower(c.name) = lower(v_band)
    ) then
      raise exception 'already listed' using errcode = 'unique_violation';
    end if;
  end if;

  v_sender := coalesce(
    (select m.display_name from public.workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1),
    'Seeens');

  insert into public.workspaces (name, listing_id) values (v_band, p_listing_id) returning id into v_workspace;
  if p_listing_id is null then
    -- Added by nobody in the band yet: the author stamp would put the admin,
    -- who isn't a member, so it's left blank for this one row.
    v_claims := current_setting('request.jwt.claims', true);
    perform set_config('request.jwt.claims', '', true);
    insert into public.connections (workspace_id, name, kind, group_type, is_us, created_by)
    values (v_workspace, v_band, 'group', 'band', true, null)
    returning id into p_listing_id;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    update public.workspaces set listing_id = p_listing_id where id = v_workspace;
  end if;

  insert into public.invites (workspace_id, email, name, role, token_hash, invited_by, invited_by_name)
  values (v_workspace, v_email, v_name, 'owner', private.token_hash(v_token), auth.uid(), v_sender)
  returning id into v_invite;
  return query select v_workspace, v_invite, v_token, v_band;
end;
$$;
