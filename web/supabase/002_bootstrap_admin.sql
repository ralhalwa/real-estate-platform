-- Run only after creating and confirming YOUR account through Bayt sign-up.
-- Replace the example email below with your actual email. Run in SQL Editor as owner.
-- No password or service-role key is required by the website.
do $$
declare target uuid;
begin
 select id into target from auth.users where lower(email)=lower('reemhalwachi42@gmail.com');
 if target is null then raise exception 'Create your account first, then replace the email in this script'; end if;
 insert into public.user_roles(user_id,role) values(target,'admin') on conflict do nothing;
end $$;
