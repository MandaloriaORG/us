# Threat Model and Attack Checklist

## Purpose

This document lists how someone could try to extract data, bypass permissions or break Mandaloria.

It must be reviewed before marking any module as finished.

Realistic goal:

- make data theft through common bugs extremely difficult;
- protect members by default;
- reduce attack surface;
- detect abuse;
- make most technical attacks fail by design.

Note: no public system is literally impossible to hack. The goal is defense in depth: if one layer fails, another layer must block or limit the damage.

## Data we must protect most

Critical:

- [ ] emails;
- [ ] internal auth user IDs if not necessary;
- [ ] sessions/tokens;
- [ ] IPs;
- [ ] login attempts;
- [ ] reports made by users;
- [ ] moderation notes;
- [ ] private messages/channels;
- [ ] blocks between users;
- [ ] private settings;
- [ ] sensitive audit logs;
- [ ] service role key;
- [ ] private API keys;
- [ ] EXIF metadata with location/device.

Controlled public:

- [ ] display name;
- [ ] public avatar;
- [ ] public bio;
- [ ] public posts;
- [ ] public comments;
- [ ] visible rank;
- [ ] visible badges;
- [ ] visible clan/house if the user allows it.

Rule:

- [ ] If data does not need to be public, it must be private by default.

## Common ways to extract data

### 1. Changing IDs in routes or requests

Attack:

A user changes `/users/me/reports` to `/users/other-id/reports`, or changes `post_id`, `user_id`, `clan_id`, `channel_id` in the request.

Controls:

- [ ] Each endpoint verifies ownership or permission.
- [ ] RLS blocks rows the user cannot see.
- [ ] Do not use only frontend checks.
- [ ] UUID does not replace authorization.
- [ ] Tests with another user's IDs.

### 2. API returns too many columns

Attack:

The API returns `email`, `is_admin`, `internal_notes`, `last_ip`, `ban_reason_private` or fields the UI does not show but are still in JSON.

Controls:

- [ ] Do not use `select *` in public APIs.
- [ ] Create DTOs or explicit select lists.
- [ ] Separate public views from admin views.
- [ ] Review JSON response in browser/devtools.
- [ ] Tests for forbidden fields.

### 3. Incomplete or misapplied RLS

Attack:

A new table is left without RLS, a policy allows `public`, or `update` allows changing sensitive columns.

Controls:

- [ ] RLS enabled by migration on every exposed table.
- [ ] Separate policies for select/insert/update/delete.
- [ ] Policies use `TO authenticated` when applicable.
- [ ] Tests anon/user/mod/admin per table.
- [ ] CI fails if a public table has no RLS.
- [ ] Sensitive columns are not updated from client.

### 4. Admin route bypass

Attack:

User opens Council URL directly, calls server action or admin API from curl.

Controls:

- [ ] Middleware protects admin routes.
- [ ] Server action/API validates permission.
- [ ] RLS also restricts admin data.
- [ ] UI only helps, does not protect.
- [ ] Direct tests against admin actions.

### 5. Broken function level authorization

Attack:

The user cannot see the delete button, but calls `deletePost(postId)` manually.

Controls:

- [ ] Each action has central permission `can(user, action, resource)`.
- [ ] Destructive actions verify permission server-side.
- [ ] Moderator only acts within their scope.
- [ ] Mandatory audit log.

### 6. Broken object property authorization

Attack:

User can update their profile, but also sends `role: admin`, `rank_id`, `reputation`, `is_banned`, `email`.

Controls:

- [ ] Input schemas allowlist per action.
- [ ] Ignore/reject non-allowed fields.
- [ ] Separate public profile endpoint from admin endpoint.
- [ ] RLS/update policies with protected columns if applicable.
- [ ] Tests attempting to change forbidden fields.

### 7. Accidental indexing

Attack:

Google, bots or previews index private profiles, private channels, reports, staging or sensitive data.

Controls:

- [ ] `robots.txt` for private/admin routes.
- [ ] `noindex` on private profiles.
- [ ] `noindex` on Council.
- [ ] `noindex` on private Holochat.
- [ ] `noindex` on reports.
- [ ] Sitemap only includes public content.
- [ ] Social metadata does not contain private data.
- [ ] Staging protected by auth or noindex.

### 8. Search leak

Attack:

Search returns private, deleted, archived content or from channels/clans without access.

Controls:

- [ ] Search query applies visibility.
- [ ] Search index does not store secrets.
- [ ] Deleted content is removed from index.
- [ ] Results filtered by user permissions.
- [ ] Tests with user without access.

### 9. Storage leak

Attack:

Private file ends up in public bucket, signed URL lasts too long, file name reveals data, or EXIF metadata exposes location.

Controls:

- [ ] Separate public and private buckets.
- [ ] Signed URLs with short expiration.
- [ ] Generated file names.
- [ ] Validate MIME and extension.
- [ ] Remove EXIF by default.
- [ ] Toggle to preserve metadata off by default.
- [ ] Do not keep originals with metadata without explicit consent.
- [ ] Storage policies reviewed.

### 10. XSS via Markdown, bio or chat

Attack:

User injects script in Markdown, bio, comment, name, link or message.

Controls:

- [ ] Sanitize all rendered content.
- [ ] Block raw HTML by default.
- [ ] Strict allowlist if HTML is allowed.
- [ ] Block event handlers.
- [ ] Block `javascript:` URLs.
- [ ] CSP configured.
- [ ] Secure cookies/sessions.

### 11. CSRF or involuntary actions

Attack:

Another website tries to make an admin execute an action.

Controls:

- [ ] Use SameSite cookies.
- [ ] Validate origin in sensitive actions if applicable.
- [ ] Destructive actions use POST/protected server action.
- [ ] Confirmation for dangerous actions.
- [ ] Re-authentication for critical actions if decided.

### 12. SSRF via previews or embeds

Attack:

User pastes a URL that the server tries to fetch, pointing to internal IP or metadata services.

Controls:

- [ ] Do not do server-side link previews in MVP.
- [ ] If implemented, use allowlist/blocking of internal IPs.
- [ ] Limit redirects.
- [ ] Short timeout.
- [ ] Response size limit.
- [ ] Do not send cookies/secrets in fetch.

### 13. Account enumeration

Attack:

Login/registration/recover tells whether an email exists.

Controls:

- [ ] Generic auth messages.
- [ ] Rate limit.
- [ ] Do not expose emails in public profiles.
- [ ] No public endpoint to search by email.

### 14. Spam and resource exhaustion

Attack:

Create thousands of posts, comments, reactions, reports, messages or uploads to crash the app or fill Supabase quota.

Controls:

- [ ] Configurable rate limits from admin.
- [ ] Limits per user.
- [ ] Limits per IP if applicable.
- [ ] Stronger limits for new accounts.
- [ ] Captcha or challenge if abuse occurs.
- [ ] Storage quotas per user.
- [ ] Max page size in APIs.
- [ ] Mandatory pagination.

### 15. Privilege escalation

Attack:

A user achieves admin role through a bug, race condition, poorly protected endpoint or editable field.

Controls:

- [ ] Users never update `user_roles`.
- [ ] Only admin/superadmin assigns roles.
- [ ] Protected roles are not deleted from normal UI.
- [ ] Role changes require audit log.
- [ ] Critical role changes may require confirmation.
- [ ] No endpoint accepts `is_admin` from client.

### 16. Mass assignment

Attack:

Request includes extra fields that the backend saves unintentionally.

Controls:

- [ ] Input schemas in allowlist.
- [ ] DTOs separated by action.
- [ ] Do not pass full payload directly to DB.
- [ ] Tests with extra malicious fields.

### 17. Race conditions

Attack:

Double click or parallel requests duplicate likes, accept invitations twice, break counters or bypass limits.

Controls:

- [ ] Unique constraints.
- [ ] Transactions.
- [ ] Controlled upserts.
- [ ] Locks or atomic RPCs for critical operations.
- [ ] Buttons disabled during submit.

### 18. Secrets in logs

Attack:

Errors store tokens, cookies, private emails or sensitive payloads.

Controls:

- [ ] Redact secrets in logs.
- [ ] Do not log full headers.
- [ ] Do not log service keys.
- [ ] Admin logs do not show unnecessary private data.

### 19. Realtime leaks

Attack:

Realtime subscriptions deliver messages or changes from private channels/reports to users without access.

Controls:

- [ ] Do not enable realtime on sensitive tables without review.
- [ ] Private channels with auth/permission.
- [ ] Minimized realtime payload.
- [ ] RLS/policies reviewed for realtime.

### 20. Backup/export leaks

Attack:

Admin export downloads too much, backups become accessible or logs with private data are shared.

Controls:

- [ ] Export only for authorized admins.
- [ ] Export logs audit log.
- [ ] Export minimizes data.
- [ ] Backups protected.
- [ ] Do not upload dumps to repos.

## Editable configuration from Admin

These parameters must live in `site_settings` or equivalent tables and be editable from Council.

Rate limits:

- [ ] posts per minute;
- [ ] posts per hour;
- [ ] comments per minute;
- [ ] comments per hour;
- [ ] replies per minute;
- [ ] reactions per minute;
- [ ] reports per hour;
- [ ] chat messages per minute;
- [ ] friend requests per day;
- [ ] uploads per day;
- [ ] max page size of APIs.

Anti-abuse:

- [ ] require verified email to post;
- [ ] minimum account age for attachments;
- [ ] minimum account age for links;
- [ ] minimum account age for chat messages;
- [ ] review queue for new accounts;
- [ ] mention limit per post/comment;
- [ ] link limit per post/comment.

Privacy:

- [ ] public profiles by default if decided;
- [ ] friends visible by default;
- [ ] activity visible by default;
- [ ] profile indexing allowed or blocked;
- [ ] remove EXIF metadata by default;
- [ ] allow preserving EXIF metadata.

Storage:

- [ ] max avatar size;
- [ ] max post image size;
- [ ] max Codex image size;
- [ ] allowed MIME types;
- [ ] allowed buckets per feature;
- [ ] signed URL duration.

Moderation:

- [ ] report reasons;
- [ ] report severities;
- [ ] auto-hide after N reports if decided;
- [ ] limits for new users;
- [ ] predefined suspension durations.

Security:

- [ ] enable/disable registration;
- [ ] allowed domains for embeds if they exist;
- [ ] allowed domains for external images if they exist;
- [ ] external link policy.

## Attacker-style tests per feature

Each feature must be tested like this:

- [ ] As anonymous.
- [ ] As normal user.
- [ ] As unverified user.
- [ ] As suspended user.
- [ ] As banned user.
- [ ] As blocked user.
- [ ] As moderator.
- [ ] As admin.
- [ ] With another user's IDs.
- [ ] With payload containing extra fields.
- [ ] With empty payload.
- [ ] With overly large payload.
- [ ] With malicious HTML/Markdown.
- [ ] With repeated parallel requests.
- [ ] With extreme pagination.
- [ ] With search for private content.

## Route checklist

For each route:

- [ ] Define if it is public, auth, mod or admin.
- [ ] Has loading/error/access denied.
- [ ] Does not render private data before redirecting.
- [ ] SEO metadata does not contain private data.
- [ ] Sitemap/robots correct.
- [ ] Server-side validates access if showing private data.

## API/server actions checklist

For each action:

- [ ] Validate input.
- [ ] Verify session.
- [ ] Verify account status.
- [ ] Verify permission.
- [ ] Verify ownership/context.
- [ ] Use minimal select/return.
- [ ] Execute transaction if there are multiple changes.
- [ ] Log audit log if applicable.
- [ ] Apply rate limit if abusable.
- [ ] Return safe error.

## Database checklist

For each table:

- [ ] RLS enabled.
- [ ] Policy select.
- [ ] Policy insert.
- [ ] Policy update.
- [ ] Policy delete or delete blocked.
- [ ] Necessary FKs.
- [ ] Necessary unique constraints.
- [ ] Check constraints for states.
- [ ] Indexes for frequent queries.
- [ ] Indexes for columns used in RLS.
- [ ] Does not contain unnecessary sensitive data.

## Safe response checklist

For each endpoint/query:

- [ ] Does not return email except authorized admin.
- [ ] Does not return internal notes except authorized mod/admin.
- [ ] Does not return private reports except authorized mod/admin.
- [ ] Does not return private blocks.
- [ ] Does not return tokens/secrets.
- [ ] Does not return IPs.
- [ ] Does not return admin-only fields.
- [ ] Does not return private content without permission.

## When to consider a feature fortified

- [ ] Has server-side permissions.
- [ ] Has RLS if touching Supabase directly.
- [ ] Has tests anon/user/mod/admin.
- [ ] Does not expose unnecessary fields.
- [ ] Cannot be accessed by changing IDs.
- [ ] Does not appear in search if private.
- [ ] Does not appear in sitemap if private.
- [ ] Does not leak data through errors.
- [ ] Has rate limit if abusable.
- [ ] Has audit log if sensitive.
- [ ] Has safe defaults.
- [ ] Has rollback/reversion if moderation/admin.
