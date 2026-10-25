-- Bayt first-release schema. Run once in the Supabase SQL Editor as project owner.
-- No existing tables or data are removed. The transaction rolls back on failure.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', phone text not null default '',
 account_status text not null default 'active' check(account_status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid references public.profiles(id) on delete cascade,
 role text check(role in ('customer','agent','admin')),
 primary key(user_id,role)
);
create table public.offices (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 160),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 account_status text not null default 'active' check(account_status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table public.office_members (
 office_id uuid references public.offices(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,
 office_role text not null check(office_role in ('agent','manager')),
 membership_status text not null default 'active' check(membership_status in ('active','suspended')),
 primary key(office_id,user_id)
);
create table public.locations (
 id uuid primary key default gen_random_uuid(), parent_id uuid references public.locations(id),
 name text not null unique, location_type text not null default 'governorate' check(location_type in ('governorate','city','district')), enabled boolean not null default true
);
create table public.listings (
 id uuid primary key default gen_random_uuid(), agent_user_id uuid not null references public.profiles(id), office_id uuid references public.offices(id),
 title text not null check(length(title) between 5 and 160), description text not null check(length(description) between 20 and 10000),
 city text not null references public.locations(name), district text not null check(length(district) between 2 and 160),
 purpose text not null check(purpose in ('rent','sale')), property_type text not null check(property_type in ('apartment','house','villa','land','commercial')),
 price numeric(16,2) not null check(price>0), currency text not null default 'USD' check(currency in ('USD','SYP')),
 rent_period text check(rent_period in ('month','year')), bedrooms int not null default 0 check(bedrooms between 0 and 50), bathrooms int not null default 0 check(bathrooms between 0 and 50),
 area_sqm numeric not null check(area_sqm>0 and area_sqm<10000000),
 approval_status text not null default 'pending' check(approval_status in ('draft','pending','approved','rejected','suspended')),
 availability_status text not null default 'available' check(availability_status in ('available','sold','rented','unavailable')),
 image_urls text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((purpose='rent' and rent_period is not null) or (purpose='sale' and rent_period is null)),
 check(cardinality(image_urls) between 1 and 12)
);
create table public.favorites (
 user_id uuid references public.profiles(id) on delete cascade, listing_id uuid references public.listings(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,listing_id)
);
create table public.leads (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id),
 customer_user_id uuid not null references public.profiles(id), assigned_agent_user_id uuid not null references public.profiles(id),
 customer_name text not null check(length(customer_name) between 2 and 160), customer_phone text not null check(length(customer_phone) between 5 and 40),
 message text not null check(length(message) between 5 and 3000),
 status text not null default 'new' check(status in ('new','contacted','interested','scheduled_visit','closed','lost')),
 created_at timestamptz not null default now()
);
create table public.listing_reviews (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id), reviewer_user_id uuid not null references public.profiles(id),
 decision text not null check(decision in ('approved','rejected','suspended')), reason text not null default '', created_at timestamptz not null default now()
);
create table public.lead_notes (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id), author_user_id uuid not null references public.profiles(id),
 note text not null check(length(note) between 1 and 3000), created_at timestamptz not null default now()
);
create index listings_status_city on public.listings(approval_status,availability_status,city);
create index listings_agent on public.listings(agent_user_id);
create index listings_office on public.listings(office_id);
create index leads_customer on public.leads(customer_user_id);
create index leads_agent on public.leads(assigned_agent_user_id);
create index leads_listing on public.leads(listing_id);
create index office_members_user on public.office_members(user_id);
create index reviews_listing on public.listing_reviews(listing_id);
create index notes_lead on public.lead_notes(lead_id);

create function private.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and account_status='active');
$$;
create function private.has_role(wanted text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.user_roles where user_id=auth.uid() and role=wanted);
$$;
create function private.manages_office(office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.office_members m join public.offices o on o.id=m.office_id where m.user_id=auth.uid() and m.office_id=office and m.office_role='manager' and m.membership_status='active' and o.account_status='active');
$$;
create function private.owns_listing(listing uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.listings l where l.id=listing and (l.agent_user_id=auth.uid() or private.manages_office(l.office_id)));
$$;
create function private.can_work_lead(lead uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.leads q join public.listings l on l.id=q.listing_id where q.id=lead and (q.assigned_agent_user_id=auth.uid() or private.manages_office(l.office_id) or private.has_role('admin')));
$$;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, anon;

create function private.handle_signup() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),160));
 insert into public.user_roles(user_id,role) values(new.id,'customer');
 return new; end;
$$;
create trigger on_bayt_signup after insert on auth.users for each row execute function private.handle_signup();
-- Backfill accounts already created before this migration, without elevating anyone.
insert into public.profiles(id,full_name) select id,left(coalesce(raw_user_meta_data->>'full_name',''),160) from auth.users on conflict(id) do nothing;
insert into public.user_roles(user_id,role) select id,'customer' from public.profiles on conflict do nothing;

create function private.guard_listing() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.office_id is not null and not exists(select 1 from public.office_members m join public.offices o on o.id=m.office_id where m.office_id=new.office_id and m.user_id=new.agent_user_id and m.membership_status='active' and o.account_status='active') then
 raise exception 'Agent must be an active member of the listing office'; end if;
 if TG_OP='INSERT' and not private.has_role('admin') and new.approval_status not in ('draft','pending') then raise exception 'Admin approval is required'; end if;
 if TG_OP='UPDATE' and not private.has_role('admin') then
 if new.agent_user_id<>old.agent_user_id or new.office_id is distinct from old.office_id then raise exception 'Only admins may change listing ownership'; end if;
 if old.approval_status='suspended' then raise exception 'Suspended listing requires admin action'; end if;
 if new.approval_status<>old.approval_status and new.approval_status not in ('draft','pending') then raise exception 'Admin approval is required'; end if;
 if row(new.title,new.description,new.city,new.district,new.price,new.purpose,new.property_type,new.currency,new.rent_period,new.bedrooms,new.bathrooms,new.area_sqm,new.image_urls) is distinct from row(old.title,old.description,old.city,old.district,old.price,old.purpose,old.property_type,old.currency,old.rent_period,old.bedrooms,old.bathrooms,old.area_sqm,old.image_urls) then new.approval_status='pending'; end if;
 end if;
 new.updated_at=now();return new; end;
$$;
create trigger guard_listing before insert or update on public.listings for each row execute function private.guard_listing();

-- Admin-only transactional moderation: records every decision and updates the listing together.
create function public.review_listing(p_listing_id uuid,p_decision text,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.has_role('admin') then raise exception 'Admin role required'; end if;
 if p_decision not in ('approved','rejected','suspended') then raise exception 'Invalid decision'; end if;
 if p_decision='rejected' and length(trim(p_reason))<3 then raise exception 'Rejection reason required'; end if;
 perform 1 from public.listings where id=p_listing_id for update;
 if not found then raise exception 'Listing not found'; end if;
 update public.listings set approval_status=p_decision where id=p_listing_id;
 insert into public.listing_reviews(listing_id,reviewer_user_id,decision,reason) values(p_listing_id,auth.uid(),p_decision,left(p_reason,3000));
 end;
$$;
create function public.admin_set_role(p_user_id uuid,p_role text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.has_role('admin') then raise exception 'Admin role required'; end if;
 if p_role not in ('agent','admin') then raise exception 'Invalid role'; end if;
 if p_role='admin' and p_user_id=auth.uid() and not p_enabled then raise exception 'Cannot remove your own admin access'; end if;
 if p_enabled then insert into public.user_roles values(p_user_id,p_role) on conflict do nothing;
 else delete from public.user_roles where user_id=p_user_id and role=p_role;end if;
 end;
$$;
create function public.admin_set_account_status(p_user_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.has_role('admin') then raise exception 'Admin role required'; end if;
 if p_status not in ('active','suspended') then raise exception 'Invalid account status'; end if;
 if p_user_id=auth.uid() then raise exception 'Cannot suspend your own account'; end if;
 update public.profiles set account_status=p_status where id=p_user_id;
 end;
$$;
create function public.assign_lead(p_lead_id uuid,p_agent_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare office uuid;
 begin
 select l.office_id into office from public.leads q join public.listings l on l.id=q.listing_id where q.id=p_lead_id;
 if not (private.has_role('admin') or private.manages_office(office)) then raise exception 'Office manager or admin required'; end if;
 if office is null then raise exception 'Only office leads can be reassigned'; end if;
 if not exists(select 1 from public.office_members m join public.profiles p on p.id=m.user_id join public.user_roles r on r.user_id=p.id and r.role='agent' where m.office_id=office and m.user_id=p_agent_user_id and m.membership_status='active' and p.account_status='active') then raise exception 'Choose an active agent in the same office'; end if;
 update public.leads set assigned_agent_user_id=p_agent_user_id where id=p_lead_id;
 end;
$$;
revoke all on function public.admin_set_account_status(uuid,text),public.assign_lead(uuid,uuid) from public,anon;
grant execute on function public.admin_set_account_status(uuid,text),public.assign_lead(uuid,uuid) to authenticated;
create function public.update_lead(p_lead_id uuid,p_status text,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.can_work_lead(p_lead_id) then raise exception 'Access denied'; end if;
 if p_status not in ('new','contacted','interested','scheduled_visit','closed','lost') then raise exception 'Invalid lead status'; end if;
 update public.leads set status=p_status where id=p_lead_id;
 if length(trim(p_note))>0 then insert into public.lead_notes(lead_id,author_user_id,note) values(p_lead_id,auth.uid(),left(trim(p_note),3000));end if;
 end;
$$;
revoke all on function public.review_listing(uuid,text,text), public.admin_set_role(uuid,text,boolean),public.update_lead(uuid,text,text) from public,anon;
grant execute on function public.review_listing(uuid,text,text), public.admin_set_role(uuid,text,boolean),public.update_lead(uuid,text,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.locations enable row level security;
alter table public.listings enable row level security;
alter table public.favorites enable row level security;
alter table public.leads enable row level security;
alter table public.listing_reviews enable row level security;
alter table public.lead_notes enable row level security;
-- Explicit grants; privileged changes go through narrowly scoped RPCs.
revoke all on public.profiles,public.user_roles,public.offices,public.office_members,public.locations,public.listings,public.favorites,public.leads,public.listing_reviews,public.lead_notes from anon,authenticated;
grant select on public.listings,public.locations,public.offices to anon,authenticated;
grant select on public.profiles,public.user_roles,public.office_members,public.favorites,public.leads,public.listing_reviews,public.lead_notes to authenticated;
grant update(full_name,phone) on public.profiles to authenticated;
grant insert,update on public.listings to authenticated;
grant insert,delete on public.favorites to authenticated;
grant insert on public.leads to authenticated;
grant insert,update on public.offices,public.office_members,public.locations to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.has_role('admin') or (private.is_active() and exists(select 1 from public.office_members m where m.user_id=profiles.id and private.manages_office(m.office_id))));
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid() and private.is_active()) with check(id=auth.uid());
create policy roles_read on public.user_roles for select to authenticated using(user_id=auth.uid() or private.has_role('admin'));
create policy offices_read on public.offices for select using((account_status='active' and verification_status='verified') or private.has_role('admin') or private.manages_office(id));
create policy offices_admin on public.offices for all to authenticated using(private.has_role('admin')) with check(private.has_role('admin'));
create policy members_read on public.office_members for select to authenticated using(user_id=auth.uid() or private.has_role('admin') or private.manages_office(office_id));
create policy members_admin on public.office_members for all to authenticated using(private.has_role('admin')) with check(private.has_role('admin'));
create policy locations_read on public.locations for select using(enabled or private.has_role('admin'));
create policy locations_admin on public.locations for all to authenticated using(private.has_role('admin')) with check(private.has_role('admin'));
create policy listings_read on public.listings for select using((approval_status='approved' and availability_status='available') or private.has_role('admin') or (private.is_active() and (agent_user_id=auth.uid() or private.manages_office(office_id))));
create policy listings_create on public.listings for insert to authenticated with check(private.has_role('admin') or (private.has_role('agent') and agent_user_id=auth.uid()));
create policy listings_edit on public.listings for update to authenticated using(private.has_role('admin') or (private.has_role('agent') and agent_user_id=auth.uid()) or private.manages_office(office_id)) with check(private.has_role('admin') or (private.has_role('agent') and agent_user_id=auth.uid()) or private.manages_office(office_id));
create policy favorites_read on public.favorites for select to authenticated using(user_id=auth.uid() and private.is_active());
create policy favorites_add on public.favorites for insert to authenticated with check(user_id=auth.uid() and private.is_active() and exists(select 1 from public.listings l where l.id=listing_id and l.approval_status='approved' and l.availability_status='available'));
create policy favorites_remove on public.favorites for delete to authenticated using(user_id=auth.uid() and private.is_active());
create policy leads_read on public.leads for select to authenticated using((private.is_active() and customer_user_id=auth.uid()) or private.can_work_lead(id));
create policy leads_create on public.leads for insert to authenticated with check(private.is_active() and customer_user_id=auth.uid() and status='new' and exists(select 1 from public.listings l where l.id=listing_id and l.approval_status='approved' and l.availability_status='available' and l.agent_user_id=assigned_agent_user_id));
create policy reviews_read on public.listing_reviews for select to authenticated using(private.has_role('admin') or private.owns_listing(listing_id));
create policy notes_read on public.lead_notes for select to authenticated using(private.can_work_lead(lead_id));

insert into public.locations(name) values('دمشق'),('ريف دمشق'),('حلب'),('حمص'),('حماة'),('اللاذقية'),('طرطوس'),('درعا'),('السويداء'),('القنيطرة'),('إدلب'),('دير الزور'),('الرقة'),('الحسكة');
-- Public property photos only. Never put identity/license documents in this bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('listing-images','listing-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy bayt_image_upload on storage.objects for insert to authenticated with check(bucket_id='listing-images' and (storage.foldername(name))[1]=auth.uid()::text and (private.has_role('agent') or private.has_role('admin')));
-- No overwrite/delete from browser: published photos cannot silently change after approval.
commit;
