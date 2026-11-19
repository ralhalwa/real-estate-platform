begin;

alter table public.listings
 add column furnishing text check (furnishing in ('furnished','partly_furnished','unfurnished')),
 add column available_from date,
 add column published_at timestamptz;

-- Recover known first publication dates without rewriting last-update timestamps.
alter table public.listings disable trigger guard_listing;
update public.listings l
set published_at=history.first_approval
from (
 select listing_id,min(created_at) as first_approval
 from public.listing_reviews
 where decision='approved'
 group by listing_id
) history
where l.id=history.listing_id;
alter table public.listings enable trigger guard_listing;

create or replace function private.guard_listing() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.office_id is not null and not exists(select 1 from public.office_members m join public.offices o on o.id=m.office_id where m.office_id=new.office_id and m.user_id=new.agent_user_id and m.membership_status='active' and o.account_status='active') then
 raise exception 'Agent must be an active member of the listing office'; end if;
 if TG_OP='INSERT' and not private.has_role('admin') and new.approval_status not in ('draft','pending') then raise exception 'Admin approval is required'; end if;
 if TG_OP='UPDATE' and not private.has_role('admin') then
 if new.agent_user_id<>old.agent_user_id or new.office_id is distinct from old.office_id then raise exception 'Only admins may change listing ownership'; end if;
 if old.approval_status='suspended' and not private.manages_office(old.office_id) then raise exception 'Suspended listing requires admin action'; end if;
 if new.approval_status<>old.approval_status and new.approval_status not in ('draft','pending') and not (private.manages_office(old.office_id) and current_setting('bayt.review_listing',true)=old.id::text) then raise exception 'Admin approval is required'; end if;
 if row(new.title,new.description,new.city,new.district,new.price,new.purpose,new.property_type,new.currency,new.rent_period,new.bedrooms,new.bathrooms,new.area_sqm,new.image_urls,new.furnishing,new.available_from) is distinct from row(old.title,old.description,old.city,old.district,old.price,old.purpose,old.property_type,old.currency,old.rent_period,old.bedrooms,old.bathrooms,old.area_sqm,old.image_urls,old.furnishing,old.available_from) then new.approval_status='pending'; end if;
 end if;
 if TG_OP='INSERT' then
  new.published_at=null;
 else
  new.published_at=old.published_at;
 end if;
 if new.approval_status='approved' and new.published_at is null
    and (TG_OP='INSERT' or old.approval_status<>'approved') then
  new.published_at=now();
 end if;
 new.updated_at=now();return new; end;
$$;

commit;
