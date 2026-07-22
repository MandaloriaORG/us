# PR Review Checklist

## Mandatory checklist

- [ ] The feature appears in `docs/dev/MASTER_CHECKLIST.md`.
- [ ] The corresponding phase was reviewed.
- [ ] Uses canonical names from `CONTEXT.md`.
- [ ] Has source of truth, states and transitions defined.
- [ ] Permissions are defined.
- [ ] Backend validates permissions.
- [ ] RLS applies if the table is exposed.
- [ ] Every schema/RLS/Storage/configuration change has a migration or reproducible declaration.
- [ ] No migration already applied in a shared environment was modified.
- [ ] The database can be rebuilt from scratch using the migrations.
- [ ] No hardcoded project refs, Supabase URLs or keys.
- [ ] Files are identified by bucket and object path, not by signed URL.
- [ ] Generated types were updated if the schema changed.
- [ ] No `select *` in public responses.
- [ ] No emails, IPs, internal notes, private reports or admin-only fields are returned without permission.
- [ ] No bypass by changing IDs.
- [ ] No mass assignment.
- [ ] Inputs are validated.
- [ ] Markdown/HTML/user content is sanitized.
- [ ] Uploaded files validate size and MIME.
- [ ] EXIF metadata is removed by default if applicable.
- [ ] Sensitive actions log audit trail.
- [ ] Reversible actions can be restored without manually editing data.
- [ ] Side effects use idempotent operation/outbox when appropriate.
- [ ] Aggregate counters do not replace the exact source.
- [ ] Abusable actions have rate limit.
- [ ] Private/admin routes have secure access denied.
- [ ] Private content does not appear in search.
- [ ] Private content does not appear in sitemap/SEO metadata.
- [ ] The UI has loading, empty and error states.
- [ ] Mobile UI does not break layout.
- [ ] Meets the route's query, payload and pagination budget.
- [ ] The feature was tested as anon, user, mod and admin if applicable.

## Documents to consult

- [Master Checklist](../dev/MASTER_CHECKLIST.md)
- [Threat Model and Attack Checklist](../dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md)
- [Security, Privacy and Performance Guardrails](../dev/SECURITY_PRIVACY_PERFORMANCE_GUARDRAILS.md)
- [System Simplicity and Performance](../dev/SYSTEM_SIMPLICITY_AND_PERFORMANCE.md)
- [Core System Rules](../dev/CORE_SYSTEM_RULES.md)
- [Supabase Portability and Recovery](../dev/SUPABASE_PORTABILITY_AND_RECOVERY.md)
- [Knowledge Lifecycle](../KNOWLEDGE_LIFECYCLE.md)
- [Permissions and Security](../PERMISSIONS_AND_SECURITY.md)
