-- Directory order ignores a leading "The".
begin;
select plan(5);
select is(public.name_sort_key('The Shitfits'), 'shitfits', 'a leading The is dropped');
select is(public.name_sort_key('the  Snubs'), 'snubs', 'any case, any spacing');
select is(public.name_sort_key('Theater of Sound'), 'theater of sound', 'only The as a whole word');
select is(public.name_sort_key('The'), 'the', 'a name that is just The stays');
select is(public.name_sort_key('Merwulf'), 'merwulf', 'other names are just lowercased');
select * from finish();
rollback;
