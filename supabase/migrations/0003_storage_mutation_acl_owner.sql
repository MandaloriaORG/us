-- Migration: 0003_storage_mutation_acl_owner
-- Supabase's baseline storage.objects DML ACL is provider-owned and cannot be
-- revoked by the linked migration role. RLS is therefore the effective object
-- mutation boundary. Restrictive policies keep `avatars` server-only even if a
-- future permissive policy grants authenticated mutations for another bucket.

create policy "Avatar objects are server-only insert"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (bucket_id <> 'avatars');

create policy "Avatar objects are server-only update"
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (bucket_id <> 'avatars')
  with check (bucket_id <> 'avatars');

create policy "Avatar objects are server-only delete"
  on storage.objects
  as restrictive
  for delete
  to authenticated
  using (bucket_id <> 'avatars');
