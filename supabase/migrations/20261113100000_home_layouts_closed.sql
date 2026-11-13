-- Customize Home (#313): close the home_layouts table itself. RLS with no
-- policies already hid every row, but the default grants still let signed-in
-- users query it. Only home_layout() and set_home_layout() should touch it.
revoke all on public.home_layouts from anon, authenticated;
