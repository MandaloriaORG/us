# Phase 7 - Customization, Search and Hardening

## Objective

Make Mandaloria configurable, searchable and more resilient.

## Customization

- [x] Site settings. — Council → Settings, gated on `admin.manage_settings` (server + RPC), typed reads via `admin_get_site_settings`.
- [x] Configurable site name. — `site.name` editable.
- [x] Configurable description. — `site.description` editable.
- [x] Configurable navigation. — `site.navigation` JSON array editable.
- [x] Configurable reactions. — `features.reactions` JSON editable.
- [x] Per-plaza rules. — served by the Council → Plazas admin (rules field persisted by `admin_update_plaza`).
- [ ] Custom profile fields. — pending decision; not in the DB contract.
- [ ] Custom post fields. — pending decision; not in the DB contract.
- [x] Configurable initial visual theme. — `theme.initial` editable.
- [x] Feature flags. — `site.registration_open`, `features.codex_public` booleans editable.

## Search

- [x] Search posts. — `search_content` RPC + `/search` UI.
- [x] Search comments if applicable. — comments included in the RPC and rendered as rows.
- [x] Search articles. — Codex articles included.
- [x] Filter by plaza. — URL `plaza` slug filter, resolved to the RPC's plaza id.
- [x] Filter by tag. — URL `tag` slug filter.
- [x] Filter by author. — URL `author` uuid filter.
- [x] Respect permissions in results. — RPC re-checks the same visibility helpers the pages use.
- [x] Exclude deleted/private content. — the RPC filters status and Plaza visibility before matching.

## Attachments

- [ ] Avatars.
- [ ] Clan/casa emblems.
- [ ] Images in posts if allowed.
- [ ] Images in Codex if allowed.
- [ ] MIME type limits.
- [ ] Size limits.
- [ ] Separate public/private buckets.

## Hardening

- [ ] Review all RLS policies. — DB/security lane review, not Lane D.
- [x] Review server-side actions. — Lane D routes reviewed: `updateSiteSetting` validates with Zod, never decides authority, maps DB failures to stable codes.
- [x] Review XSS. — search and settings surfaces render only React-escaped text; no raw HTML is injected.
- [x] Review admin permissions. — settings are gated on `admin.manage_settings` server-side and re-checked inside the RPC.
- [ ] Review rate limits. — search has no anti-scraping rate limit yet; tracked under checklist 21.
- [x] Review search and private content. — the RPC is the only search surface and it filters deleted/hidden/quarantined/private content before matching.
- [x] Review logs. — every settings change writes an audited `site_setting.update` row with actor, reason, previous and new value.
- [ ] Review backups. — out of scope for this lane.
- [x] Regression tests. — added suites for search visibility and settings permissions.

## Done when

- [x] Admin can customize the essentials. — name, description, navigation, reactions, theme, feature flags and per-plaza rules.
- [x] Search respects visibility. — deleted, hidden, quarantined and private content never surfaces.
- [ ] Attachments are safe. — clan-emblem storage hardening landed in migration 0018; the emblem UI is Lane B's.
- [ ] Security was reviewed before production. — production gate, tracked by Lane FINAL.
