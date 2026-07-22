# Roadmap

## Phase 0: Definition

Objective: make the project's identity clear before programming.

Deliverables:

- Product vision.
- Community model.
- Content model.
- Canonical domain language.
- Knowledge cycle: conversation, proposal, review, and Codex.
- Structural system rules.
- Initial features list.
- Feature matrix by user, moderator, admin, data, permissions, and edge cases.
- Permission and security model.
- Initial roadmap.
- Initial database design.
- Supabase portability and recovery plan.
- ADR for primary Supabase with portable core.
- Stack decision.
- Initial product names: Plazas, Codex Libre, Holochat, Clans/Houses, and Council.

Status: in progress.

## Phase 1: Basic Community

Objective: Mandaloria functions as a minimum community network.

Features:

- registration and login;
- profiles;
- main feed;
- plazas/categories;
- posts;
- comments;
- replies;
- reactions;
- likes/dislikes;
- saved items;
- reports;
- own editing and deletion;
- basic roles;
- minimum admin panel;
- basic library.
- proposal to turn a conversation into knowledge.

Expected result:

The community can register, post, comment, read important content, and report problems.

## Phase 2: Serious Moderation

Objective: make the community manageable.

Features:

- moderation queue;
- moderator actions;
- bans and suspensions;
- warnings;
- audit logs;
- featured content;
- closing and archiving of posts;
- user management from admin;
- plaza management from admin.
- quarantine and restoration of content/evidence.

Expected result:

Administrators and moderators can maintain order without touching the database manually.

## Phase 3: Clans, Houses, and Identity

Objective: give Mandaloria its own identity.

Features:

- clans/houses;
- clan membership;
- internal roles;
- community ranks;
- badges;
- emblems;
- clan/house pages;
- channels per clan/house.
- mission and areas of responsibility;
- research expeditions;
- badges with verifiable provenance.

Expected result:

Members not only use the site: they belong to a community structure.

## Phase 4: Holochat

Objective: add live conversation without trying to copy Discord entirely.

Features:

- public channels;
- real-time or near-real-time messages;
- announcements channel;
- message moderation;
- private channels by role or clan;
- pinned messages;
- basic mentions.

Expected result:

Mandaloria has a space for daily coexistence, not just long debates.

## Phase 5: Advanced Customization

Objective: allow the site to evolve without reprogramming every detail.

Features:

- site settings;
- visual themes;
- configurable navigation;
- configurable reactions;
- custom user fields;
- custom post fields;
- email templates;
- feature flags.

Expected result:

Mandaloria's identity, structure, and rules can be adjusted from admin.

## Phase 6: Scaling and Quality

Objective: prepare the platform for more users.

Features:

- full-text search;
- query optimization;
- robust pagination;
- anti-spam limits;
- backups;
- observability;
- automated tests;
- audited RLS policies;
- security review.

Expected result:

The platform can grow without becoming fragile.

## Technical Priority

Recommended order:

1. Documentation.
2. Supabase schema.
3. Authentication.
4. Profiles and roles.
5. Plazas, posts, and comments.
6. Minimum moderation.
7. Library.
8. Admin.
9. Clans/houses.
10. Chat.

## Development Checklists

Detailed execution lives in:

- `CONTEXT.md`
- `docs/KNOWLEDGE_LIFECYCLE.md`
- `docs/always-review/README.md`
- `docs/always-review/PR_REVIEW_CHECKLIST.md`
- `docs/always-review/PHASE_REVIEW_CHECKLIST.md`
- `docs/dev/README.md`
- `docs/dev/MASTER_CHECKLIST.md`
- `docs/dev/MVP_SCOPE.md`
- `docs/dev/ADMIN_PANEL.md`
- `docs/dev/CODEX_EDITOR.md`
- `docs/dev/IMPLEMENTATION_SECURITY.md`
- `docs/dev/SECURITY_PRIVACY_PERFORMANCE_GUARDRAILS.md`
- `docs/dev/SYSTEM_SIMPLICITY_AND_PERFORMANCE.md`
- `docs/dev/CORE_SYSTEM_RULES.md`
- `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md`
- `docs/dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md`
- `docs/adr/0001-single-supabase-portable-core.md`
- `docs/dev/phases/00-foundation.md`
- `docs/dev/phases/01-auth-profiles-permissions.md`
- `docs/dev/phases/02-plazas-posts-comments.md`
- `docs/dev/phases/03-moderation-admin.md`
- `docs/dev/phases/04-codex-libre.md`
- `docs/dev/phases/05-clans-identity.md`
- `docs/dev/phases/06-holochat-notifications.md`
- `docs/dev/phases/07-customization-search-hardening.md`

## Pending Decision

Before building UI, the following need to be decided:

- final visible project name;
- visual style;
- whether clans/houses are open, invitation-only, or manual;
- whether the library will be public for visitors;
- whether chat will be real-time from the start;
- whether attachments will be allowed in the first version.
