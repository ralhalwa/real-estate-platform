begin;

create policy guest_listings_read on public.listings for select to anon
using (approval_status = 'approved' and availability_status = 'available');

commit;
