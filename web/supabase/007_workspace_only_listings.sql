begin;

-- Listing discovery is available to signed-in workspace users.
alter policy listings_read on public.listings to authenticated;

commit;
