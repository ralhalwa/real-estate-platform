begin;

create function private.listing_agent_profiles(listing_id uuid, photo_path text)
returns table (full_name text, avatar_path text, office_name text)
language sql stable security definer set search_path = '' as $$
  select p.full_name, p.avatar_path, o.name
  from public.listings l
  join public.profiles p on p.id = l.agent_user_id
  left join public.offices o on o.id = l.office_id
    and o.account_status = 'active'
    and (o.verification_status = 'verified' or private.has_role('admin') or private.manages_office(o.id))
  where (l.id = listing_id or p.avatar_path = photo_path)
    and private.is_active()
    and p.account_status = 'active' and p.archived_at is null
    and (
      (l.approval_status = 'approved' and l.availability_status = 'available')
      or l.agent_user_id = auth.uid()
      or private.has_role('admin')
      or private.manages_office(l.office_id)
      or private.assigned_staff_listing(l.id)
    );
$$;

create function public.listing_agent_profile(listing_id uuid)
returns table (full_name text, avatar_path text, office_name text)
language sql stable security invoker set search_path = '' as $$
  select * from private.listing_agent_profiles(listing_id, null);
$$;

revoke all on function private.listing_agent_profiles(uuid, text), public.listing_agent_profile(uuid) from public, anon;
grant execute on function private.listing_agent_profiles(uuid, text), public.listing_agent_profile(uuid) to authenticated;

create policy listing_agent_photo_read on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (select 1 from private.listing_agent_profiles(null, name))
);

commit;
