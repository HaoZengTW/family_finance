-- Replace both example emails before running in Supabase SQL Editor.
do $$
declare
  my_email text := 'me@example.com';
  wife_email text := 'wife@example.com';
  my_id uuid;
  wife_id uuid;
  family uuid;
begin
  select id into my_id from auth.users where lower(email) = lower(my_email);
  select id into wife_id from auth.users where lower(email) = lower(wife_email);
  if my_id is null or wife_id is null or my_id = wife_id then
    raise exception '請先建立兩個不同的 Supabase Auth 帳號並填入正確 Email';
  end if;
  insert into public.households (name) values ('我們的家庭帳簿') returning id into family;
  insert into public.household_members (user_id, household_id, owner)
  values (my_id, family, 'me'), (wife_id, family, 'wife');
end;
$$;
