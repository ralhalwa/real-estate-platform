-- Apply after 003_office_staff.sql. No existing users are removed by this migration.
begin;
alter table public.profiles add column if not exists archived_at timestamptz;
create or replace function private.can_manage_member(target uuid,office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.manages_office(office) and target<>auth.uid() and not exists(select 1 from public.user_roles where user_id=target and role='admin') and exists(select 1 from public.office_members where office_id=office and user_id=target and office_role<>'manager');
$$;
revoke all on function private.can_manage_member(uuid,uuid) from public,anon;
grant execute on function private.can_manage_member(uuid,uuid) to authenticated;
create or replace function public.manage_user_profile(p_user_id uuid,p_name text,p_phone text,p_office_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role('admin') then
  if not private.can_manage_member(p_user_id,p_office_id) then raise exception 'Office access denied'; end if;
  if exists(select 1 from public.office_members where user_id=p_user_id and office_id<>p_office_id and membership_status='active') then raise exception 'Shared account details must be edited by a platform administrator'; end if;
 end if;
 if length(trim(p_name)) not between 2 and 160 or length(p_phone)>40 then raise exception 'Invalid contact details'; end if;
 update public.profiles set full_name=trim(p_name),phone=trim(p_phone) where id=p_user_id and archived_at is null;
 if not found then raise exception 'Account unavailable'; end if;
end;
$$;
create or replace function public.manage_office_member(p_user_id uuid,p_office_id uuid,p_role text,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_role not in ('staff','agent','manager') or p_status not in ('active','suspended') then raise exception 'Invalid membership'; end if;
 if not private.has_role('admin') then
  if not private.can_manage_member(p_user_id,p_office_id) or p_role='manager' then raise exception 'Office access denied'; end if;
 end if;
 if not exists(select 1 from public.offices where id=p_office_id and account_status='active') then raise exception 'Office unavailable'; end if;
 if p_role='agent' and not exists(select 1 from public.user_roles where user_id=p_user_id and role='agent') then raise exception 'Agent access must be enabled by platform administration first'; end if;
 if p_status='suspended' and (exists(select 1 from public.listings where office_id=p_office_id and agent_user_id=p_user_id and availability_status='available') or exists(select 1 from public.leads q join public.listings l on l.id=q.listing_id where l.office_id=p_office_id and q.assigned_agent_user_id=p_user_id and q.status not in ('closed','lost'))) then raise exception 'Reassign active properties and inquiries before removing this membership'; end if;
 insert into public.office_members(office_id,user_id,office_role,membership_status) values(p_office_id,p_user_id,p_role,p_status) on conflict(office_id,user_id) do update set office_role=excluded.office_role,membership_status=excluded.membership_status;
end;
$$;
create or replace function public.archive_user(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role('admin') then raise exception 'Admin role required'; end if;
 if p_user_id=auth.uid() then raise exception 'Cannot delete your own account'; end if;
 if exists(select 1 from public.listings where agent_user_id=p_user_id and availability_status='available') or exists(select 1 from public.leads where assigned_agent_user_id=p_user_id and status not in ('closed','lost')) then raise exception 'Reassign active properties and inquiries before deleting this account'; end if;
 update public.profiles set account_status='suspended',archived_at=now() where id=p_user_id;
 update public.office_members set membership_status='suspended' where user_id=p_user_id;
end;
$$;
-- Only the authenticated Edge Function service client may provision a newly invited account.
create or replace function public.provision_invited_user(p_actor uuid,p_user_id uuid,p_office_id uuid,p_role text,p_name text,p_phone text) returns void language plpgsql security definer set search_path='' as $$
declare actor_admin boolean; actor_manager boolean;
begin
 select exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=p_actor and r.role='admin' and p.account_status='active') into actor_admin;
 select exists(select 1 from public.office_members m join public.offices o on o.id=m.office_id join public.profiles p on p.id=m.user_id where m.user_id=p_actor and m.office_id=p_office_id and m.office_role='manager' and m.membership_status='active' and o.account_status='active' and p.account_status='active') into actor_manager;
 if not actor_admin and (not actor_manager or p_role not in ('staff','agent')) then raise exception 'Office access denied'; end if;
 if p_role not in ('staff','agent','manager','standard') or (p_office_id is null and p_role in ('staff','manager')) or (p_role='standard' and p_office_id is not null) then raise exception 'Invalid invitation position'; end if;
 if length(trim(p_name)) not between 2 and 160 or length(p_phone)>40 then raise exception 'Invalid contact details'; end if;
 if exists(select 1 from public.user_roles where user_id=p_user_id and role in ('admin','agent')) or exists(select 1 from public.office_members where user_id=p_user_id) then raise exception 'Existing accounts must be managed through their account settings'; end if;
 update public.profiles set full_name=trim(p_name),phone=trim(p_phone) where id=p_user_id and archived_at is null;
 if not found then raise exception 'Account unavailable'; end if;
 if p_role='agent' then insert into public.user_roles(user_id,role) values(p_user_id,'agent') on conflict do nothing; end if;
 if p_office_id is not null then
  if not exists(select 1 from public.offices where id=p_office_id and account_status='active') then raise exception 'Office unavailable'; end if;
  insert into public.office_members(office_id,user_id,office_role) values(p_office_id,p_user_id,case when p_role='standard' then 'staff' else p_role end);
 end if;
end;
$$;
revoke all on function public.manage_user_profile(uuid,text,text,uuid),public.manage_office_member(uuid,uuid,text,text),public.archive_user(uuid) from public,anon;
grant execute on function public.manage_user_profile(uuid,text,text,uuid),public.manage_office_member(uuid,uuid,text,text),public.archive_user(uuid) to authenticated;
revoke all on function public.provision_invited_user(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.provision_invited_user(uuid,uuid,uuid,text,text,text) to service_role;
drop policy if exists manager_agent_roles_read on public.user_roles;
create policy manager_agent_roles_read on public.user_roles for select to authenticated using(role='agent' and exists(select 1 from public.office_members m where m.user_id=user_roles.user_id and private.manages_office(m.office_id)));
commit;
