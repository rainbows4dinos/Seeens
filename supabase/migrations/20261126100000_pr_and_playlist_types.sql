-- New listing types: PR (a publicist, or a PR firm) and playlists (a
-- playlist curator, or the playlist itself). Radio already has Radio
-- Station, DJ, and Radio Host. Enum values can't be removed later, so these
-- are the settled names.
alter type public.person_role add value if not exists 'publicist' before 'other';
alter type public.person_role add value if not exists 'playlist_curator' before 'other';
alter type public.group_type add value if not exists 'pr_firm' before 'other';
alter type public.group_type add value if not exists 'playlist' before 'other';
