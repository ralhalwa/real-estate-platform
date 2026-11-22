begin;

create index profiles_avatar_path_idx on public.profiles (avatar_path) where avatar_path is not null;

create function private.visible_profile_photos(user_ids uuid[], photo_path text)
returns table (user_id uuid, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.avatar_path
  from public.profiles p
  where p.avatar_path is not null
    and (p.id = any(user_ids) or p.avatar_path = photo_path)
    and (
      p.id = auth.uid()
      or (
        private.is_active()
        and (
          private.has_role('admin')
          or exists (
            select 1 from public.office_members m
            where m.user_id = p.id and private.manages_office(m.office_id)
          )
          or exists (
            select 1 from public.leads l
            where l.customer_user_id = p.id and private.can_work_lead(l.id)
          )
        )
      )
    );
$$;

create function public.workspace_profile_photos(user_ids uuid[])
returns table (user_id uuid, avatar_path text)
language sql stable security invoker set search_path = '' as $$
  select * from private.visible_profile_photos(user_ids, null);
$$;

revoke all on function private.visible_profile_photos(uuid[], text), public.workspace_profile_photos(uuid[]) from public, anon;
grant execute on function private.visible_profile_photos(uuid[], text), public.workspace_profile_photos(uuid[]) to authenticated;

create policy workspace_profile_photo_read on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (select 1 from private.visible_profile_photos(null, name))
);

commit;
