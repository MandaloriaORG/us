# Mandaloria Compact Context

Mandaloria is a community and free-knowledge network: Plazas for durable discussion, Holochat for live conversation, Codex Libre for reviewed knowledge, and Casas/Clanes/Circulos for belonging and responsibility. Its distinctive cycle is conversation -> proposal -> review -> Codex article, preserving allowed sources and attribution.

## Product invariants

- Knowledge essential to the community remains free and accessible.
- Roles grant permissions. Ranks show progression. Badges verify achievements. Reputation records trust. Houses express belonging and responsibility. Never mix these concepts.
- Every sensitive action follows `can(actor, action, resource, context)` and is enforced server-side plus RLS. Deny by default.
- Content and workflows use explicit states and valid transitions, not contradictory booleans.
- Moderation is reversible by default: visible -> hidden -> quarantined -> restored. Permanent deletion is exceptional, confirmed, reasoned, authorized, and audited.
- Private data stays private in UI, API, search, sitemap, previews, exports, logs, Realtime, backups, and Storage.
- Prefer a small architecture, minimal queries and payloads, cursor pagination, exact source records, denormalized read counters, idempotency, and transactional outbox events.

## Supabase invariants

- One primary Supabase during MVP; portability and tested recovery from the start.
- Every table, column, index, constraint, function, trigger, grant and RLS policy lives in forward-only versioned migrations.
- Storage buckets/policies and Auth, Realtime, cron, webhook and extension configuration are reproducible or documented.
- Never hardcode project refs, provider URLs, keys or connection strings.
- Service role is server-only. Files are stored as bucket + object path; never persist signed URLs.
- Database/Auth, Storage objects and operational configuration need separate encrypted off-site backups. A backup is valid only after a restore drill.

## Read only what the task needs

- Domain terms: `CONTEXT.md`.
- Any feature: relevant heading in `docs/dev/MASTER_CHECKLIST.md` and its file under `docs/dev/phases/`.
- Database/Auth/Storage/RLS/infrastructure: `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md` and `docs/DATABASE_DESIGN.md`.
- Security/privacy/abuse: `docs/dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md` and `docs/dev/SECURITY_PRIVACY_PERFORMANCE_GUARDRAILS.md`.
- Architecture/performance: `docs/dev/CORE_SYSTEM_RULES.md` and `docs/dev/SYSTEM_SIMPLICITY_AND_PERFORMANCE.md`.
- Codex/destillation/attribution: `docs/KNOWLEDGE_LIFECYCLE.md` and `docs/dev/CODEX_EDITOR.md`.
- Admin/moderation: `docs/dev/ADMIN_PANEL.md` and phase 03.
- Review or completion: `docs/always-review/PR_REVIEW_CHECKLIST.md` and `docs/always-review/PHASE_REVIEW_CHECKLIST.md`.

Do not mark a feature complete until behavior, permissions, RLS, validation, privacy, moderation, audit, error states and proportional tests are implemented and verified.
