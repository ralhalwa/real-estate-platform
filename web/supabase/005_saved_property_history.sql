-- Keep approved homes visible to customers who saved them before they became unavailable.
-- Public browsing still shows available homes only. Withdrawn/unapproved listings stay private.
create policy saved_listing_history_read on public.listings
for select to authenticated
using (
 approval_status = 'approved'
 and private.is_active()
 and exists (
  select 1 from public.favorites f
  where f.listing_id = listings.id and f.user_id = auth.uid()
 )
);
