-- Connection photos (#37).
--
-- One photo per connection, run through the copier (xerox shader) in the
-- browser when it's added. Two files are kept in a private bucket:
--
--   <workspace_id>/<connection_id>/<photo_id>.webp           the copy we show
--   <workspace_id>/<connection_id>/<photo_id>-original.webp  resized, no EXIF
--
-- The original is only for re-copying with new settings; photo_settings holds
-- the copier settings used (contrast, grit, plate, grain). Nothing is public:
-- the app serves short-lived signed URLs.

alter table public.connections
  add column photo_path text,
  add column photo_original_path text,
  add column photo_settings jsonb,
  add column photo_alt text,
  -- Both files live under this connection's folder, and come and go together.
  add constraint connections_photo_paths check (
    (photo_path is null and photo_original_path is null and photo_settings is null)
    or (
      photo_path is not null and photo_original_path is not null and photo_settings is not null
      and photo_path like workspace_id::text || '/' || id::text || '/%'
      and photo_original_path like workspace_id::text || '/' || id::text || '/%'
      and jsonb_typeof(photo_settings) = 'object'
    )
  ),
  add constraint connections_photo_alt_length check (char_length(photo_alt) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('connection-photos', 'connection-photos', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A file's folder must be a workspace you belong to, then a connection in that
-- workspace. Archived connections keep their photos.
create function private.can_use_photo_path(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where c.workspace_id::text = (storage.foldername(object_name))[1]
      and c.id::text = (storage.foldername(object_name))[2]
      and c.workspace_id in (select private.my_workspace_ids())
  )
$$;

revoke all on function private.can_use_photo_path(text) from public;
grant execute on function private.can_use_photo_path(text) to authenticated;

create policy "Members can view connection photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'connection-photos' and private.can_use_photo_path(name));

create policy "Members can add connection photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'connection-photos' and private.can_use_photo_path(name));

create policy "Members can replace connection photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'connection-photos' and private.can_use_photo_path(name))
  with check (bucket_id = 'connection-photos' and private.can_use_photo_path(name));

create policy "Members can remove connection photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'connection-photos' and private.can_use_photo_path(name));
