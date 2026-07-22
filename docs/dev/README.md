# Developer Documentation

## Purpose

This folder turns the Mandaloria vision into implementable checklists.

Work rule:

- each feature must have UI;
- each sensitive action must have a permission;
- each important permission must be validated on the server/database;
- each sensitive change must log;
- each module must have empty, loading, error and access denied states;
- nothing is considered finished if basic moderation or security is missing.

## Recommended order

1. [Phase 0 - Foundation](./phases/00-foundation.md)
2. [Phase 1 - Auth, profiles and permissions](./phases/01-auth-profiles-permissions.md)
3. [Phase 2 - Plazas, posts and comments](./phases/02-plazas-posts-comments.md)
4. [Phase 3 - Moderation and basic admin](./phases/03-moderation-admin.md)
5. [Phase 4 - Codex Libre](./phases/04-codex-libre.md)
6. [Phase 5 - Clans, ranks and identity](./phases/05-clans-identity.md)
7. [Phase 6 - Holochat and notifications](./phases/06-holochat-notifications.md)
8. [Phase 7 - Customization, search and hardening](./phases/07-customization-search-hardening.md)

## Supporting documents

- [Domain Language](../../CONTEXT.md)
- [Core System Rules](./CORE_SYSTEM_RULES.md)
- [Supabase Portability and Recovery](./SUPABASE_PORTABILITY_AND_RECOVERY.md)
- [Knowledge Lifecycle](../KNOWLEDGE_LIFECYCLE.md)
- [Master Checklist](./MASTER_CHECKLIST.md)
- [MVP Scope](./MVP_SCOPE.md)
- [Admin Panel](./ADMIN_PANEL.md)
- [Codex Editor](./CODEX_EDITOR.md)
- [Implementation Security](./IMPLEMENTATION_SECURITY.md)
- [Security, Privacy and Performance Guardrails](./SECURITY_PRIVACY_PERFORMANCE_GUARDRAILS.md)
- [System Simplicity and Performance](./SYSTEM_SIMPLICITY_AND_PERFORMANCE.md)
- [Threat Model and Attack Checklist](./THREAT_MODEL_AND_ATTACK_CHECKLIST.md)
- [Feature Matrix](../FEATURE_MATRIX.md)
- [Database Design](../DATABASE_DESIGN.md)
- [Permissions and Security](../PERMISSIONS_AND_SECURITY.md)

## Definition of done

A task is finished only if:

- the UI exists;
- the action works;
- permissions are applied;
- errors are clearly displayed;
- data validation exists;
- RLS or server-side validation is in place when applicable;
- logs exist for sensitive actions;
- there is documentable manual test or automated test.
