-- Length limits on text members can write (launch hardening). The forms cap
-- these too; this holds for anyone writing to the API directly. NOT VALID:
-- checked on every new write, without failing on anything already stored.

alter table public.connection_band_details
  add constraint connection_band_details_notes_length check (char_length(notes) <= 10000) not valid,
  add constraint connection_band_details_phone_length check (char_length(phone) <= 100) not valid,
  add constraint connection_band_details_email_length check (char_length(email) <= 320) not valid;

alter table public.connection_links
  add constraint connection_links_url_length check (char_length(url) <= 2000) not valid,
  add constraint connection_links_label_length check (char_length(label) <= 100) not valid;

alter table public.scenes
  add constraint scenes_description_length check (char_length(description) <= 2000) not valid;

alter table public.affiliations
  add constraint affiliations_notes_length check (char_length(notes) <= 2000) not valid;

alter table public.connections
  add constraint connections_can_help_with_size check (
    cardinality(can_help_with) <= 30 and char_length(array_to_string(can_help_with, ',')) <= 1000
  ) not valid;
