# Always Review

## Purpose

This folder serves as a reminder of which documents must always be reviewed during development.

It does not duplicate the source documentation. The actual documents live in `docs/dev/` and `docs/`.

## Always read before implementing

1. [Domain Language](../../CONTEXT.md)
2. [Core System Rules](../dev/CORE_SYSTEM_RULES.md)
3. [Supabase Portability and Recovery](../dev/SUPABASE_PORTABILITY_AND_RECOVERY.md)
4. [Master Checklist](../dev/MASTER_CHECKLIST.md)
5. [Threat Model and Attack Checklist](../dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md)
6. [Security, Privacy and Performance Guardrails](../dev/SECURITY_PRIVACY_PERFORMANCE_GUARDRAILS.md)
7. [System Simplicity and Performance](../dev/SYSTEM_SIMPLICITY_AND_PERFORMANCE.md)
8. [Permissions and Security](../PERMISSIONS_AND_SECURITY.md)
9. [Feature Matrix](../FEATURE_MATRIX.md)
10. [Database Design](../DATABASE_DESIGN.md)
11. [MVP Scope](../dev/MVP_SCOPE.md)
12. [Admin Panel](../dev/ADMIN_PANEL.md)
13. [Codex Editor](../dev/CODEX_EDITOR.md)

If the feature touches Plazas, Holochat, Codex, Casas or attribution, also read [Knowledge Lifecycle](../KNOWLEDGE_LIFECYCLE.md).

## Always read when working by phases

- [Phase 0 - Foundation](../dev/phases/00-foundation.md)
- [Phase 1 - Auth, profiles and permissions](../dev/phases/01-auth-profiles-permissions.md)
- [Phase 2 - Plazas, posts and comments](../dev/phases/02-plazas-posts-comments.md)
- [Phase 3 - Moderation and basic admin](../dev/phases/03-moderation-admin.md)
- [Phase 4 - Codex Libre](../dev/phases/04-codex-libre.md)
- [Phase 5 - Clans, ranks and identity](../dev/phases/05-clans-identity.md)
- [Phase 6 - Holochat and notifications](../dev/phases/06-holochat-notifications.md)
- [Phase 7 - Customization, search and hardening](../dev/phases/07-customization-search-hardening.md)

## Rule

Before marking a feature as done, review:

- master checklist;
- corresponding phase;
- permissions;
- RLS;
- privacy;
- threat model;
- performance;
- admin/moderation;
- logs;
- loading/empty/error/access denied states.
- source of truth, states and transitions;
- reversibility and side effects;
- canonical domain language.
- reproducibility and portability of Supabase changes.
