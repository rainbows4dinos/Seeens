-- Folded panels (#314): each person's own, across bands.
-- Run with: npm run db:test. Fixture data is fictional and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('9d111111-1111-1111-1111-111111111111', 'fp-a@example.com'),
  ('9d222222-2222-2222-2222-222222222222', 'fp-b@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.my_folded_panels(), null, 'nothing saved yet');
select public.set_panel_folded('notes', true);
select public.set_panel_folded('contact', true);
select public.set_panel_folded('notes', true);
select is(public.my_folded_panels(), '{contact,notes}'::text[], 'folding twice keeps one');
select public.set_panel_folded('contact', false);
select is(public.my_folded_panels(), '{notes}'::text[], 'unfolding removes it');
select throws_ok($$ select public.set_panel_folded('Not An Id!', true) $$, '22023', 'bad panel id', 'ids are checked');

select set_config('request.jwt.claims', '{"sub":"9d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.my_folded_panels(), null, 'someone else keeps their own');
select throws_ok($$ select * from public.folded_panels $$, '42501', null, 'the table itself is closed');

reset role;
set local role anon;
select throws_ok($$ select public.my_folded_panels() $$, '42501', null, 'signed out can''t ask');

select * from finish();
rollback;
