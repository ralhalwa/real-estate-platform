-- Office managers may review only listings in their active managed offices.
create or replace function private.guard_listing() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.office_id is not null and not exists(select 1 from public.office_members m join public.offices o on o.id=m.office_id where m.office_id=new.office_id and m.user_id=new.agent_user_id and m.membership_status='active' and o.account_status='active') then
 raise exception 'Agent must be an active member of the listing office'; end if;
 if TG_OP='INSERT' and not private.has_role('admin') and new.approval_status not in ('draft','pending') then raise exception 'Admin approval is required'; end if;
 if TG_OP='UPDATE' and not private.has_role('admin') then
 if new.agent_user_id<>old.agent_user_id or new.office_id is distinct from old.office_id then raise exception 'Only admins may change listing ownership'; end if;
 if old.approval_status='suspended' and not private.manages_office(old.office_id) then raise exception 'Suspended listing requires admin action'; end if;
 if new.approval_status<>old.approval_status and new.approval_status not in ('draft','pending') and not (private.manages_office(old.office_id) and current_setting('bayt.review_listing',true)=old.id::text) then raise exception 'Admin approval is required'; end if;
 if row(new.title,new.description,new.city,new.district,new.price,new.purpose,new.property_type,new.currency,new.rent_period,new.bedrooms,new.bathrooms,new.area_sqm,new.image_urls) is distinct from row(old.title,old.description,old.city,old.district,old.price,old.purpose,old.property_type,old.currency,old.rent_period,old.bedrooms,old.bathrooms,old.area_sqm,old.image_urls) then new.approval_status='pending'; end if;
 end if;
 new.updated_at=now();return new; end;
$$;


-- Admin-only transactional moderation: records every decision and updates the listing together.
create or replace function public.review_listing(p_listing_id uuid,p_decision text,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.has_role('admin') and not exists(select 1 from public.listings l where l.id=p_listing_id and private.manages_office(l.office_id)) then raise exception 'Admin role required, or manager access to this office'; end if;
 if p_decision not in ('approved','rejected','suspended') then raise exception 'Invalid decision'; end if;
 if p_decision='rejected' and length(trim(p_reason))<3 then raise exception 'Rejection reason required'; end if;
 perform 1 from public.listings where id=p_listing_id for update;
 if not found then raise exception 'Listing not found'; end if;
 perform set_config('bayt.review_listing',p_listing_id::text,true);
 update public.listings set approval_status=p_decision where id=p_listing_id;
 perform set_config('bayt.review_listing','',true);
 insert into public.listing_reviews(listing_id,reviewer_user_id,decision,reason) values(p_listing_id,auth.uid(),p_decision,left(p_reason,3000));
 end;
$$;

create policy office_manager_reviews_read on public.listing_reviews for select to authenticated using(exists(select 1 from public.listings l where l.id=listing_id and private.manages_office(l.office_id)));
