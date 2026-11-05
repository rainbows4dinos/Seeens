-- #48: who books a venue is a link, like a band member: a person or a
-- promoter -> the venue. Its own migration, because a new enum value can't be
-- used in the transaction that adds it.
alter type public.affiliation_kind add value if not exists 'books' after 'works_with';
