-- Migration: 0004_storage_mutation_anon_boundary
-- Extend the forward-only restrictive Storage boundary to both Data API roles.
-- service_role keeps its provider-managed BYPASSRLS behavior.

alter policy "Avatar objects are server-only insert"
  on storage.objects
  to anon, authenticated;

alter policy "Avatar objects are server-only update"
  on storage.objects
  to anon, authenticated;

alter policy "Avatar objects are server-only delete"
  on storage.objects
  to anon, authenticated;
