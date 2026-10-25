-- Run once in Supabase SQL Editor after 001_initial.sql. Safe to rerun.
-- Adds Office staff without granting Agent access or listing-write permissions.
begin;
alter table public.office_members drop constraint if exists office_members_office_role_check;
alter table public.office_members add constraint office_members_office_role_check check(office_role in ('agent','manager','staff'));
create or replace function private.is_office_staff(office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.office_members m join public.offices o on o.id=m.office_id where m.user_id=auth.uid() and m.office_id=office and m.office_role='staff' and m.membership_status='active' and o.account_status='active');
$$;
create or replace function private.can_work_lead(lead uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.leads q join public.listings l on l.id=q.listing_id where q.id=lead and (private.has_role('admin') or private.manages_office(l.office_id) or (q.assigned_agent_user_id=auth.uid() and (private.has_role('agent') or private.is_office_staff(l.office_id)))));
$$;
create or replace function private.assigned_staff_listing(listing uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.leads q join public.listings l on l.id=q.listing_id where l.id=listing and q.assigned_agent_user_id=auth.uid() and private.is_office_staff(l.office_id));
$$;
revoke all on function private.is_office_staff(uuid),private.assigned_staff_listing(uuid) from public,anon;
grant execute on function private.is_office_staff(uuid),private.assigned_staff_listing(uuid) to authenticated;
drop policy if exists staff_assigned_listing_read on public.listings;
create policy staff_assigned_listing_read on public.listings for select to authenticated using(private.assigned_staff_listing(id));
drop policy if exists staff_office_read on public.offices;
create policy staff_office_read on public.offices for select to authenticated using(private.is_office_staff(id));
create or replace function public.assign_lead(p_lead_id uuid,p_agent_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare office uuid;
 begin
 select l.office_id into office from public.leads q join public.listings l on l.id=q.listing_id where q.id=p_lead_id;
 if not (private.has_role('admin') or private.manages_office(office)) then raise exception 'Office manager or admin required'; end if;
 if office is null then raise exception 'Only office leads can be reassigned'; end if;
 if not exists(select 1 from public.office_members m join public.profiles p on p.id=m.user_id join public.offices o on o.id=m.office_id where m.office_id=office and m.user_id=p_agent_user_id and m.membership_status='active' and p.account_status='active' and o.account_status='active' and (m.office_role='staff' or exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='agent'))) then raise exception 'Choose an active agent or office staff member in the same office'; end if;
 update public.leads set assigned_agent_user_id=p_agent_user_id where id=p_lead_id;
 end;
$$;
commit;
