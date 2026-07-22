# Security, Privacy and Performance Guardrails

## Purpose

This document must be reviewed constantly during the development of Mandaloria.

Goal:

- protect members;
- prevent data leaks;
- reduce vulnerabilities;
- maintain acceptable performance;
- avoid technical decisions that are difficult to correct later.

Important: no website is literally "unhackable". The realistic goal is to reduce attack surface, apply defense in depth, detect abuse quickly and avoid exposing unnecessary data.

Base references:

- OWASP Top 10 for critical web risks.
- OWASP ASVS for verifiable security requirements.
- Supabase RLS and official security guides for data protection.

## Non-negotiable rules

- [ ] Do not expose service role key in frontend.
- [ ] Do not trust frontend permissions.
- [ ] Every sensitive table must have RLS.
- [ ] Every sensitive action must be validated server-side.
- [ ] All user content must be sanitized before rendering.
- [ ] All uploaded files must be validated.
- [ ] Private member data must not be public by accident.
- [ ] Admin/mod actions must be logged in audit logs.
- [ ] Defaults must be restrictive.
- [ ] A feature is not marked finished without reviewing security, privacy and performance.

## Security mental model

Mandatory questions per feature:

- [ ] What data does it touch?
- [ ] Who can read it?
- [ ] Who can create it?
- [ ] Who can edit it?
- [ ] Who can delete it?
- [ ] What happens if the user manipulates the request?
- [ ] What happens if the user changes IDs in the URL?
- [ ] What happens if the user has no session?
- [ ] What happens if the user is banned?
- [ ] What happens if the content is private?
- [ ] What is logged?
- [ ] How is spam/abuse prevented?

## Main web risks

### Broken Access Control

- [ ] Validate permissions on server/database.
- [ ] Use RLS to separate data by user, role, clan/house, plaza or channel.
- [ ] Do not allow access by changing IDs.
- [ ] Test read/write as anonymous user.
- [ ] Test read/write as normal user.
- [ ] Test read/write as moderator.
- [ ] Test read/write as admin.

### Cryptographic Failures

- [ ] Do not store passwords ourselves.
- [ ] Use Supabase Auth for passwords and sessions.
- [ ] Do not store sensitive tokens in public tables.
- [ ] Do not expose emails unless necessary.
- [ ] Do not store secrets in logs.
- [ ] Always use HTTPS.

### Injection

- [ ] Use parameterized queries or safe APIs.
- [ ] Do not build SQL from user strings.
- [ ] Validate inputs with schemas.
- [ ] Escape searches.
- [ ] Sanitize Markdown/HTML.

### Insecure Design

- [ ] Define permissions before building UI.
- [ ] Apply least privilege.
- [ ] Separate role, rank, badge and clan/house.
- [ ] Do not grant permissions by reputation without explicit rule.
- [ ] Design appeal/reversal flow for moderation.

### Security Misconfiguration

- [ ] RLS enabled.
- [ ] Storage buckets with correct policies.
- [ ] Private variables not exposed.
- [ ] Security headers configured.
- [ ] CORS restricted if applicable.
- [ ] Errors do not leak stack traces in production.

### Vulnerable Dependencies

- [ ] Keep dependencies updated.
- [ ] Review advisories.
- [ ] Avoid unnecessary packages.
- [ ] Lock versions with lockfile.
- [ ] Review Markdown, upload and auth libraries with special care.

### Auth Failures

- [ ] Require verified email to post if decided.
- [ ] Rate limit on login and sensitive actions.
- [ ] Handle suspended/banned accounts.
- [ ] Protect admin routes.
- [ ] Do not trust profile data for permissions.

### Data Integrity Failures

- [ ] Validate webhooks if they exist.
- [ ] Do not execute code uploaded by users.
- [ ] Do not install dependencies without review.
- [ ] Protect deployment workflows.

### Logging and Monitoring Failures

- [ ] Log admin actions.
- [ ] Log moderation actions.
- [ ] Log permission changes.
- [ ] Log bans/suspensions.
- [ ] Log relevant errors.
- [ ] Do not log unnecessary sensitive data.

### SSRF

- [ ] Do not fetch server-side to arbitrary URLs without allowlist.
- [ ] Validate link previews if implemented.
- [ ] Block internal IPs in preview fetch.
- [ ] Limit redirects.

## Supabase

### RLS

- [ ] RLS enabled on every exposed table.
- [ ] Separate policies for select, insert, update and delete.
- [ ] Policies use `auth.uid()` when applicable.
- [ ] Policies consider banned/suspended user.
- [ ] Policies consider private content.
- [ ] Policies consider role/mod/admin.
- [ ] Policies consider clan/house/channel/plaza.
- [ ] Indexes created for columns used by policies.
- [ ] Manual RLS tests with anon, user, mod and admin.

### API keys

- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is only used as anon key.
- [ ] Service role key only on secure server.
- [ ] Service role key never reaches browser bundle.
- [ ] Rotate keys if leaked.
- [ ] Do not copy keys into public docs.

### Storage

- [ ] Separate public and private buckets.
- [ ] Avatars in controlled bucket.
- [ ] Private attachments with signed URLs.
- [ ] Validate MIME type.
- [ ] Validate extension.
- [ ] Validate size.
- [ ] Use generated names, not trusted original names.
- [ ] Do not allow file execution.
- [ ] RLS policies on file metadata.

## Member privacy

Public data by default:

- [ ] display name;
- [ ] public avatar if the user allows;
- [ ] public bio if the user allows;
- [ ] public rank;
- [ ] public badges;
- [ ] public clan/house if the user allows;
- [ ] public posts and comments.

Private data by default:

- [ ] email;
- [ ] auth provider IDs;
- [ ] IPs;
- [ ] login attempts;
- [ ] moderation notes;
- [ ] reports made by the user;
- [ ] blocks;
- [ ] private settings;
- [ ] private messages/channels.

Privacy options:

- [ ] Show/hide clan on profile.
- [ ] Show/hide friends.
- [ ] Show/hide recent activity.
- [ ] Allow/hide external links.
- [ ] Allow public indexing if decided.
- [ ] Download own data if implemented.
- [ ] Request deletion/anonymization if implemented.

## Image metadata

Recommended rule:

By default, Mandaloria should remove EXIF metadata from uploaded images to protect location, device and personal data.

Flow:

- [ ] Upon image upload, detect if it has metadata.
- [ ] By default remove EXIF/metadata.
- [ ] Show advanced option to preserve metadata.
- [ ] Explain risk before preserving metadata.
- [ ] Save preference if decided.
- [ ] Do not preserve GPS by default.
- [ ] Generate optimized web version.
- [ ] Keep original only if there is a clear reason and explicit permission.

Button/option:

- [ ] Toggle: "Preserve image metadata".
- [ ] Default: off.
- [ ] Visible warning before activating.

## User content

Markdown:

- [ ] Sanitize output.
- [ ] Block scripts.
- [ ] Block HTML event handlers.
- [ ] Block iframes except allowlist.
- [ ] External links with `rel="noopener noreferrer"`.
- [ ] Images limited to allowed sources.
- [ ] Mentions and embeds parsed safely.

HTML:

- [ ] Avoid raw HTML in MVP.
- [ ] If allowed, use strict allowlist.

Spam:

- [ ] Rate limit by user.
- [ ] Rate limit by IP if possible.
- [ ] Limits for new accounts.
- [ ] Review queue for suspicious behavior.
- [ ] Automatic temporary block if abuse occurs.

## Safe admin and moderation

- [ ] Admin panel protected server-side.
- [ ] Admin actions require explicit permission.
- [ ] Destructive actions have confirmation.
- [ ] Moderator cannot act on admin.
- [ ] Moderator cannot change permissions.
- [ ] Moderator cannot delete audit logs.
- [ ] Admin cannot delete audit logs from normal UI.
- [ ] Permission changes require audit log.
- [ ] Bans/suspensions require reason.
- [ ] Permanent deletion only for authorized admins.

## Performance

Important note:

`if` and `try/catch` are usually not the real cause of lag in a web app. Lag typically comes from slow queries, too many renders, large payloads, N+1 queries, heavy images, large loops, blocking work on the main thread or missing indexes.

Rules:

- [ ] Measure before optimizing.
- [ ] Optimize queries before micro-optimizing code.
- [ ] Avoid N+1 queries.
- [ ] Use pagination.
- [ ] Use indexes on frequent filters.
- [ ] Use indexes on columns used by RLS.
- [ ] Avoid loading infinite comments at once.
- [ ] Avoid loading infinite chat messages at once.
- [ ] Optimize images.
- [ ] Lazy load heavy content.
- [ ] Memoize only when there is a reason.
- [ ] Do not put heavy work in render.
- [ ] Debounce search.
- [ ] Throttle repeated actions.
- [ ] Cache stable public reads if applicable.

## Applied math optimization

Counts:

- [ ] Avoid recalculating likes/comments on every request if it scales.
- [ ] Use denormalized counters when it makes sense.
- [ ] Keep counters consistent with transactions or jobs.
- [ ] Recalculate counters periodically if there is drift.

Ranking:

- [ ] Define simple formula for popularity.
- [ ] Avoid letting old content with many votes always win.
- [ ] Use temporal decay if there is a popular feed.
- [ ] Separate moderation score and social score.

Rate limits:

- [ ] Use temporal window by user.
- [ ] Use temporal window by IP if applicable.
- [ ] Stricter limits for new accounts.
- [ ] Configurable limits from admin.

Search:

- [ ] Use Postgres full-text search for Codex/posts.
- [ ] Index searchable fields.
- [ ] Do not search with `ILIKE '%...%'` on large tables without strategy.

## Database

- [ ] UUIDs for main entities.
- [ ] Foreign keys.
- [ ] Unique constraints where applicable.
- [ ] Check constraints for states.
- [ ] Indexes on foreign keys.
- [ ] Indexes on `created_at` for feeds.
- [ ] Indexes on slugs.
- [ ] Composite indexes for frequent queries.
- [ ] Soft delete for community content.
- [ ] Hard delete only for defined cases.
- [ ] Versioned migrations.
- [ ] Reproducible seeds.

## Frontend

- [ ] Do not show buttons the user cannot use.
- [ ] Even if buttons are hidden, backend validates permissions.
- [ ] Loading states.
- [ ] Empty states.
- [ ] Error states.
- [ ] Access denied state.
- [ ] Forms with validation.
- [ ] Error messages do not leak internal details.
- [ ] Responsive UI.
- [ ] Text does not overlap on mobile.
- [ ] Dangerous actions ask for confirmation.

## Backend / server actions / API

- [ ] Validate input schema.
- [ ] Verify session.
- [ ] Verify account status.
- [ ] Verify permission.
- [ ] Execute action.
- [ ] Log audit log if applicable.
- [ ] Return safe error.
- [ ] Do not return extra private data.
- [ ] Handle expected errors without public stack trace.

## Per-PR checklist

- [ ] The feature is in `MASTER_CHECKLIST.md`.
- [ ] The feature has defined permissions.
- [ ] The feature respects RLS.
- [ ] The feature does not expose private data.
- [ ] The feature has input validation.
- [ ] The feature handles errors.
- [ ] The feature has loading/empty/error state.
- [ ] The feature logs if sensitive.
- [ ] The feature has rate limiting if abusable.
- [ ] The feature does not load unnecessary data.
- [ ] The feature was tested as anon, user, mod and admin if applicable.

## Periodic review

Each phase must review:

- [ ] security;
- [ ] privacy;
- [ ] permissions;
- [ ] RLS;
- [ ] logs;
- [ ] performance;
- [ ] basic accessibility;
- [ ] mobile;
- [ ] exposed data;
- [ ] abuse/spam.
