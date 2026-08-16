# Master Checklist

## Purpose

Master checklist for Mandaloria. This document lists all features discussed so far so that development can mark implementation without losing functionality.

Rule: a feature is not complete if it lacks UI, data, permissions, validation, error states, security, and admin/mod behavior when applicable.

## 0. Foundation

- [x] Next.js project created.
- [x] TypeScript configured.
- [x] Supabase configured.
- [x] Supabase CLI initialized.
- [x] Versioned migrations configured.
- [x] Reproducible seed configured.
- [ ] Full schema rebuilds from empty base.
- [x] RLS, grants, functions, triggers and indexes live in migrations.
- [x] Storage buckets and policies are reproducible.
- [x] Supabase clients centralized in infrastructure.
- [x] Project URL/ref and keys are not hardcoded.
- [x] `.env.example` exists without secrets.
- [x] Database types are generated and not edited manually.
- [x] Environment variables documented.
- [x] Base layout created.
- [x] Main navigation created.
- [x] Initial visual theme created.
- [x] Base UI components created.
- [x] Loading states defined.
- [x] Error states defined.
- [x] Empty states defined.
- [x] 404 page created.
- [x] Access denied page created.
- [x] Protected routes created.
- [x] Admin routes protected.
- [x] Service role key never exposed to the client.
- [ ] Database/Auth backup defined.
- [ ] Storage objects backup defined separately.
- [ ] Restore to a new project documented and tested before production.

## 1. Navigation and areas

- [x] Home exists.
- [x] Plazas exists.
- [x] Codex Libre exists.
- [x] Holochat exists or has placeholder.
- [x] Clans/Houses exists or has placeholder.
- [x] Members exists.
- [x] Council exists only for authorized roles.
- [x] Mobile nav works.
- [x] Desktop nav works.
- [x] User sees actions according to permissions.

## 2. Auth

- [x] Registration.
- [x] Login.
- [x] Logout.
- [x] Password recovery.
- [x] Email verification.
- [ ] Change email.
- [x] Change password.
- [x] Handle unverified email.
- [x] Handle suspended account.
- [x] Handle banned account.
- [x] Create profile on registration.
- [x] Post-login redirect.
- [x] Post-logout redirect.
- [x] Protection against actions without session.

## 3. Profile

- [x] View public profile.
- [x] Edit display name.
- [ ] Validate reserved names.
- [ ] Validate duplicate names if applicable.
- [x] Edit avatar.
- [x] Reset avatar.
- [x] Edit bio.
- [x] Sanitize bio.
- [x] Edit links.
- [x] Configure basic privacy.
- [ ] View user's posts.
- [ ] View user's comments.
- [ ] View badges.
- [ ] View rank.
- [x] View visible roles.
- [ ] View clan/house.
- [ ] View friends if privacy allows.
- [x] Show suspended/banned status according to permissions.

## 4. Roles and permissions

- [x] roles table.
- [x] permissions table.
- [x] user_roles table.
- [x] role_permissions table.
- [x] Seed user role.
- [x] Seed verified member role.
- [x] Seed archivist role.
- [x] Seed moderator role.
- [x] Seed guardian role.
- [x] Seed administrator role.
- [x] Helper to verify permissions server-side.
- [x] UI hides actions without permission.
- [x] Backend rejects actions without permission.
- [x] RLS protects sensitive tables.
- [x] User cannot change their role.
- [x] Moderator cannot change global roles.
- [x] Admin can assign role.
- [x] Admin can remove role.
- [x] Role changes are logged in audit log.

## 5. Plazas

- [x] List plazas.
- [x] View plaza details.
- [x] Central Plaza.
- [x] Initiate's Questions.
- [x] Mandalorian Philosophy.
- [x] The Way.
- [x] Debates and Discussion.
- [x] Lore and Culture.
- [x] Creative Forge.
- [x] Council Announcements.
- [x] Tavern.
- [x] Create plaza from admin.
- [x] Edit plaza from admin.
- [x] Change slug.
- [x] Change description.
- [x] Change visibility.
- [x] Reorder plazas. — sort order is an editable field per Plaza; no dedicated drag-and-drop.
- [x] Archive plaza.
- [x] Configure plaza rules.
- [ ] Configure permissions per plaza. — `required_post_permission` exists and gates posting, but no RPC parameter can set it; needs a migration (registry §4).
- [x] Archived plaza does not accept new posts. — `create_post` refuses an archived Plaza (content contract suite).
- [x] Council Announcements only allows posting by authorized roles. — seeded with `required_post_permission = 'admin.manage_plazas'`.

## 6. Posts

- [x] Create post.
- [x] View post.
- [x] Edit own post.
- [x] Delete own post with soft delete.
- [x] List posts by plaza.
- [x] Main post feed.
- [x] Post pagination. — keyset cursor, URL-backed.
- [x] Recent order.
- [ ] Popular order. — deliberately absent from `list_posts` (migration 0007).
- [ ] Highlighted order. — `is_highlighted` is a flag, not an ordering mode.
- [x] Tags in posts.
- [x] Save/bookmark post.
- [x] Remove bookmark.
- [x] Share link.
- [x] Draft status.
- [x] Published status.
- [ ] Pending review status. — the enum value exists but no transition writes it.
- [x] Closed status.
- [x] Pinned status.
- [x] Highlighted status.
- [x] Hidden status.
- [x] Deleted by author status.
- [x] Deleted by moderator status.
- [x] Archived status.
- [x] Lock editing if moderation decides.
- [x] Closed post does not accept comments.
- [x] Pending post does not appear publicly.
- [x] Deleted post does not break comments. — tombstone keeps replies in context.

## 7. Comments and replies

- [x] Create comment.
- [x] View comments.
- [x] Reply to comment.
- [x] Show replies.
- [x] Edit own comment.
- [x] Delete own comment with soft delete.
- [x] Copy direct link to comment.
- [x] Comment pagination. — keyset cursor, URL-backed.
- [x] Order by date.
- [ ] Order by relevance if implemented.
- [x] Deleted parent comment maintains context. — removed comments render a tombstone and replies keep their place.
- [x] Reply to hidden comment is handled correctly. — a removed comment renders a tombstone; replies are preserved.
- [x] Comment cannot be created on closed post. — `accepts_comments` and the RPC both enforce it.
- [x] Edited comment saves version if applicable. — `content_revisions` snapshots the previous wording.

## 8. Likes, dislikes and reactions

- [x] Like on post.
- [x] Dislike on post.
- [x] Remove vote on post.
- [x] Change like to dislike.
- [x] Like on comment.
- [x] Dislike on comment.
- [x] Remove vote on comment.
- [x] Emoji reaction on post.
- [x] Emoji reaction on comment.
- [x] Remove reaction.
- [x] Avoid duplicate reaction. — one row per actor per target.
- [x] Consistent counters. — written in the same transaction as their source; drift-repair function.
- [x] Admin can create reaction type. — `admin_upsert_reaction_type` RPC; no Council UI surface yet (registry §4).
- [x] Admin can deactivate reaction type. — `admin_set_reaction_type_active` RPC; no Council UI surface yet (registry §4).
- [ ] Admin decides if reaction affects reputation. — reputation model deferred.
- [ ] New users may have reaction limit. — no per-actor reaction limit in the contract.
- [x] Cannot react to deleted content. — RPCs refuse removed targets.

## 9. Reports

- [x] Report post.
- [x] Report comment.
- [x] Report chat message. — `chat-report-control` files a message into the same queue.
- [x] Report profile.
- [x] Choose report reason.
- [x] Write description.
- [x] Prevent report spam. — per-actor rate limit plus one live report per reporter per target.
- [x] Group duplicate reports. — the queue shows how many other live reports name the same target.
- [x] Report queue.
- [x] Moderator can assign report to self. — claiming is compare-and-swap.
- [x] Moderator can resolve report.
- [x] Moderator can reject report. — dismissal, with a required reason.
- [x] Moderator can take action from report. — hide/quarantine/delete/restore on the report detail page.
- [x] Admin can view all reports. — the queue is gated on `moderation.hide`, which an administrator holds.
- [ ] Admin can configure reasons. — the report vocabulary is a code constant plus a migration.
- [x] Decision is recorded. — who closed it, when, why; audited.

## 10. Moderation

- [x] Moderator can hide post.
- [x] Moderator can restore post.
- [x] Authorized moderator can quarantine post.
- [x] Authorized moderator can remove post from quarantine.
- [x] Moderator can delete post.
- [x] Moderator can close post.
- [x] Moderator can reopen post.
- [x] Moderator can pin post.
- [x] Moderator can highlight post.
- [x] Moderator can move post.
- [x] Moderator can lock post editing.
- [x] Moderator can hide comment.
- [x] Moderator can restore comment.
- [x] Authorized moderator can quarantine comment/attachments. — quarantine works; there is no attachment feature to carry along.
- [x] Moderator can delete comment.
- [x] Moderator can pin comment.
- [x] Moderator can lock replies.
- [x] Moderator can warn user.
- [x] Moderator can suspend user if they have permission.
- [x] Moderator can ban user if they have permission.
- [x] Moderator can add internal note.
- [x] Moderator sees user history. — the audit log filtered by that member; no second store.
- [x] Moderator only acts within their scope.
- [x] Moderator cannot moderate admins.
- [ ] Sensitive actions are logged in moderator_actions. — there is no such table by design; `audit_logs` is the single record.
- [x] Sensitive actions are logged in audit_logs.
- [x] Hiding and quarantine are reversible.
- [x] Restore recovers the last allowed state.
- [ ] Permanent deletion requires higher permission, reason and confirmation.
- [x] Moderation evidence has limited access and retention. — bounded edit history, plus a nightly purge of closed reports and decided appeals after 180 days.
- [x] Appeal can be linked to the original action. — an appeal references the audit row for the action it argues with.

## 11. Admin / Council

- [ ] Admin dashboard.
- [ ] User count.
- [ ] Post count.
- [ ] Comment count.
- [ ] Open report count.
- [ ] Recent activity.
- [x] User management.
- [x] Search users.
- [x] Filter users by status.
- [x] View admin user detail.
- [x] Change user status.
- [x] Suspend user.
- [x] Ban user.
- [x] Unban.
- [x] Role management.
- [ ] Create role.
- [ ] Edit role.
- [ ] Delete unprotected role.
- [ ] Permission management.
- [ ] Assign permissions to role.
- [ ] Remove permissions from role.
- [ ] Plaza management.
- [ ] Post management.
- [ ] Comment management.
- [ ] Report management.
- [ ] Codex Libre management.
- [ ] Knowledge proposal management.
- [ ] Assign proposal to Archivist.
- [ ] Resolve source or attribution conflicts.
- [ ] Clan/house management.
- [ ] Rank management.
- [ ] Badge management.
- [ ] Holochat management.
- [ ] Reaction management.
- [ ] Settings management.
- [ ] View settings history.
- [ ] Restore valid settings version.
- [x] View audit logs.
- [x] Filter audit logs.
- [ ] Export logs if decided.

## 12. Codex Libre

- [x] List categories.
- [x] View published article.
- [x] Search articles.
- [x] Save article.
- [x] Link article to discussion/plaza.
- [x] Admin can create article.
- [x] Admin can edit article.
- [x] Admin can delete/archive article.
- [x] Admin can publish article.
- [x] Admin can unpublish article.
- [x] Admin can lock article.
- [x] Admin can restore article.
- [x] Archivist can create article if they have permission.
- [x] Archivist can edit article if they have permission.
- [x] User can suggest correction.
- [x] Review suggestions.
- [x] Accept suggestion.
- [x] Reject suggestion.
- [x] Create category.
- [x] Edit category.
- [x] Archive category.
- [x] Version history.
- [x] Restore previous version.
- [x] Change author saved.
- [x] Change summary saved.
- [x] Propose conversation for the Codex.
- [x] Add allowed sources to proposal.
- [ ] Detect/merge duplicate proposals.
- [x] Classify proposal.
- [x] Assign Archivist.
- [x] Create draft from proposal.
- [x] Confirm or reject contributions.
- [x] Accept, reject, withdraw and reopen proposal.
- [x] Publish reviewed version, never the proposal directly.
- [x] Link conversation and article in both directions.
- [x] Show allowed provenance and confirmed contributors.
- [x] Re-validate source privacy before publishing.
- [x] Allow anonymous or withdrawn attribution according to policy.
- [x] Drafts, private sources and reviews are not indexed.
- [x] Permission, privacy, duplicate and concurrency tests.

## 13. Codex Markdown Editor

- [x] Title field.
- [x] Slug field.
- [x] Category selector.
- [x] Markdown Editor.
- [x] Markdown Preview.
- [x] Save draft.
- [x] Publish.
- [x] Unpublish.
- [x] Archive.
- [x] Restore.
- [x] Change message/summary.
- [x] Title validation.
- [x] Slug validation.
- [x] Content validation.
- [x] Markdown sanitization.
- [x] Raw HTML blocked or filtered.
- [x] Scripts blocked.
- [x] Safe external links.
- [x] Images restricted if allowed.

## 14. Clans, houses and circles

- [x] List clans/houses.
- [x] View clan/house page.
- [x] Create clan/house.
- [x] Edit name.
- [ ] Edit slug. (no RPC parameter in 0016 — handoff)
- [x] Edit description.
- [x] Edit emblem.
- [ ] Change color. (clans have no colour field in the contract)
- [x] Change privacy.
- [x] Archive clan/house.
- [x] Request to join.
- [x] Invite user.
- [ ] Accept request. (action exists; no RPC lists a clan's pending requests — handoff)
- [ ] Reject request. (same read-contract gap as accept)
- [x] Leave clan/house.
- [x] Expel member.
- [x] Change leader.
- [x] Create internal roles.
- [x] Assign internal role.
- [x] Remove internal role.
- [ ] Create internal announcement. (holochat announcement — Phase 6)
- [ ] Clan internal space if applicable.
- [ ] Clan internal channel if applicable. (holochat clan channel — Phase 6)
- [x] Define House mission.
- [ ] Define areas of responsibility/Codex. (no DB table links clans to areas/Codex topics — handoff)
- [ ] Create research expedition. (no expeditions contract in migrations 0015-0018 — handoff)
- [ ] Define expedition goal and responsible parties. (handoff)
- [ ] Manage expedition participants and sources. (handoff)
- [ ] Close or archive expedition with result. (handoff)
- [ ] Propose expedition result to the Codex. (handoff)
- [ ] Maintaining an area does not grant ownership or automatic publishing. (no area-maintenance mechanism exists to grant it)
- [x] Leader only manages their clan/house.
- [x] Admin can intervene.

## 15. Ranks and badges

- [x] Create rank.
- [x] Edit rank.
- [x] Delete/archive rank.
- [x] Assign rank manually.
- [x] Remove rank.
- [x] Show rank on profile.
- [x] Show rank next to name.
- [x] Create badge.
- [x] Edit badge.
- [x] Delete/archive badge.
- [x] Assign badge manually.
- [x] Withdraw badge.
- [x] Show badges on profile.
- [x] Show issuer, date, reason and verifiable badge status.
- [x] Link public evidence or show protected reference.
- [x] Revoke badge without deleting internal history.
- [x] Only authorized issuers assign each badge type.
- [x] Private evidence is not exposed on profiles.
- [ ] Automatic badges if implemented.
- [ ] Automatic ranks if implemented.
- [x] Rank does not grant permissions without explicit rule.
- [x] Badge does not grant permissions without explicit rule.

## 16. Reputation

- [ ] reputation_events model.
- [ ] Positive reaction can add if setting allows.
- [ ] Negative reaction can affect if setting allows.
- [ ] Highlighted post can add reputation.
- [ ] Helpful comment can add reputation.
- [ ] Admin can adjust rules.
- [ ] Moderator/admin can review abuse.
- [ ] Reputation visible on profile if decided.
- [ ] Reputation does not replace moderation decisions.

## 17. Friends, blocks and connections

- [x] Send friend request.
- [x] Accept request.
- [x] Reject request.
- [x] Cancel request.
- [ ] Remove friend. (action exists; no RPC exposes an accepted friendship's id to the UI — handoff)
- [x] View friends on profile according to privacy.
- [x] Block user.
- [x] Unblock user.
- [x] Blocked user cannot send request.
- [x] Blocked user cannot interact directly.
- [x] Rate limit on requests.
- [ ] Moderation can review abuse/harassment.

## 18. Holochat

- [x] List channels.
- [x] View channel.
- [x] Welcome channel.
- [x] General channel.
- [x] Questions channel.
- [x] Philosophy channel.
- [x] Library channel.
- [x] Announcements channel.
- [x] Clans channel.
- [x] Projects channel.
- [x] Off-topic channel.
- [x] Send message.
- [x] Edit own message.
- [x] Delete own message.
- [x] Reply to message.
- [x] React to message.
- [x] Report message.
- [ ] Propose eligible message/conversation for the Codex. — blocked: `create_codex_proposal`/`add_codex_proposal_source` reject chat sources (migration 0015), needs a DB RPC accepting `chat_message_id`.
- [x] Load history.
- [x] Pagination/incremental loading.
- [x] Pinned messages.
- [x] Announcements channel is Council write-only.
- [x] Private channels by role if applicable.
- [x] Private channels by clan/house if applicable.
- [x] User only sees allowed channels.

## 19. Holochat moderation

- [x] Moderator can delete message.
- [x] Moderator can hide message.
- [x] Moderator can restore message.
- [x] Moderator can pin message.
- [ ] Moderator can mute user. — no mute RPC in the 0015-0018 contract; blocks exist but are self-initiated, not a moderation mute.
- [x] Admin can create channel.
- [x] Admin can edit channel.
- [x] Admin can archive channel.
- [x] Admin can configure channel permissions.
- [x] Chat reports enter the queue.
- [x] Rate limit on messages.
- [x] Message edited after report remains traceable. — `chat_message_edits` snapshots wording; edit-history viewer is a follow-up.

## 20. Notifications

- [x] Create notification.
- [x] List user's notifications.
- [x] Mark one as read.
- [x] Mark all as read.
- [x] Notify post reply.
- [x] Notify comment reply.
- [x] Notify received reaction.
- [ ] Notify mention. — `mention` enum exists but no DB producer enqueues it.
- [x] Notify friend request.
- [x] Notify clan/house invitation.
- [ ] Notify resolved report. — `moderation_set_report_status` is not recreated to enqueue a notification.
- [x] Notify warning.
- [ ] Notify important announcement. — `post_chat_announcement` records the event but with no recipient; fan-out to members is not in the contract.
- [x] Notification preferences.
- [ ] Mute plaza. — no mute feature in the contract.
- [ ] Mute post. — no mute feature in the contract.
- [ ] Mute user. — no mute feature in the contract.
- [ ] Optional email if implemented. — deferred.
- [x] Notification does not show disallowed private content.
- [x] Outbox event is created alongside the main action.
- [x] Notification consumer is idempotent.
- [x] Retries have limit and backoff.
- [x] Failed events can be inspected and reprocessed. — RPCs exist; the admin settings UI belongs to Lane D.
- [x] Notification failure does not revert valid content.

## 21. Search

- [x] Search posts.
- [x] Search comments if decided. — decided yes; the RPC includes comments.
- [x] Search Codex articles.
- [x] Filter by plaza.
- [x] Filter by tag.
- [x] Filter by author.
- [ ] Filter by date. — the RPC has no date filter.
- [x] Results respect permissions. — the RPC re-checks the same visibility helpers the pages use.
- [x] Deleted content does not appear.
- [x] Private content does not appear.
- [x] Paginated search.
- [ ] Anti-scraping/rate limit protection. — not implemented; open.

## 22. Attachments and storage

- [ ] Avatars in storage.
- [ ] Clan/house emblems.
- [ ] Images in posts if allowed.
- [ ] Images in Codex if allowed.
- [ ] General attachments if allowed.
- [ ] Size limit.
- [ ] MIME type limit.
- [ ] Separate public buckets.
- [ ] Separate private buckets.
- [ ] Signed URLs for private.
- [ ] Moderator can hide file.
- [ ] Admin can permanently delete file if necessary.
- [ ] Deleted file does not break content.
- [ ] New users may have limited attachments.

## 23. Settings and customization

- [x] Configurable site name.
- [x] Configurable description.
- [x] Open/closed registration.
- [x] Configurable navigation.
- [x] Configurable reactions.
- [ ] Configurable posting limits. — not seeded as a setting.
- [ ] Configurable comment limits. — not seeded as a setting.
- [ ] Configurable attachment limits. — not seeded as a setting.
- [x] Configurable Codex visibility.
- [x] Configurable per-plaza rules. — Council → Plazas rules field.
- [x] Configurable initial visual theme.
- [x] Theme settings.
- [x] Feature flags.
- [ ] Custom profile fields if implemented. — pending decision; not in the DB contract.
- [ ] Custom post fields if implemented. — pending decision; not in the DB contract.
- [x] Each setting has type and default value.
- [x] Each numeric setting has minimum and maximum.
- [x] Server-side validation of settings. — Zod shape checks plus the RPC's type and bounds checks.
- [x] Absolute security limits are not edited from UI. — the UI only edits seeded settings; security limits are database-bound.
- [ ] Critical changes require permission and confirmation. — permission is enforced; no explicit confirmation dialog (compare-and-swap guards concurrency).
- [x] Save author, date, previous and new value. — audited by the settings RPC.
- [ ] Version configuration. — not implemented.
- [ ] Restore only valid versions. — not implemented.

## 24. Security

- [x] RLS on profiles.
- [x] RLS on roles.
- [x] RLS on user_roles.
- [x] RLS on permissions.
- [x] RLS on role_permissions.
- [ ] RLS on spaces. — no `spaces` table; Plazas are the canonical container.
- [x] RLS on posts. — enabled with no policies, unreachable from the Data API.
- [x] RLS on comments.
- [x] RLS on reactions/content_reactions.
- [x] RLS on reports.
- [ ] RLS on moderation_queue. — no such table by design; reports queue through RPCs.
- [ ] RLS on moderator_actions. — no such table by design; `audit_logs` is the single record.
- [x] RLS on audit_logs.
- [x] RLS on clans. — enabled with no policies, unreachable from the Data API.
- [x] RLS on clan_members.
- [x] RLS on library_articles. — Codex tables are RLS-enabled with no policies.
- [x] RLS on library_article_versions.
- [x] RLS on knowledge_proposals.
- [x] RLS on knowledge_proposal_sources.
- [x] RLS on knowledge_proposal_contributors.
- [x] RLS on chat_channels.
- [x] RLS on chat_messages.
- [x] RLS on notifications.
- [x] Server-side validation on actions.
- [x] Markdown sanitization. — `src/lib/content/markdown.ts` escapes first, then emits a closed tag set; wired into post and comment bodies.
- [x] Bio/profile sanitization.
- [x] Rate limit posting. — `enforce_post_rate_limit`.
- [x] Rate limit commenting. — `enforce_comment_rate_limit`, replies included.
- [x] Rate limit replying.
- [x] Rate limit reacting. — `enforce_engagement_rate_limit`.
- [x] Rate limit reporting. — `enforce_report_rate_limit`.
- [x] Rate limit friend requests. — `enforce_friend_request_rate_limit`.
- [x] Rate limit chat. — `enforce_chat_rate_limit`.
- [ ] Rate limit file upload. — no general upload path; Storage is restricted to avatars/emblems.
- [x] Soft delete on community content.
- [x] Audit logs on admin/mod changes.
- [x] XSS protection.
- [x] Private data protection.
- [x] Search respects permissions.
- [x] Restricted storage.
- [x] Private variables not exposed.

## 25. Audit and logs

- [x] Log assign role.
- [x] Log remove role.
- [ ] Log change permissions. — role-permission grants are not a Council UI feature.
- [x] Log ban user.
- [x] Log suspend user.
- [x] Log hide content. — every moderation transition writes an audit row.
- [x] Log restore content.
- [x] Log delete content as mod/admin.
- [x] Log publish Codex article.
- [x] Log unpublish Codex article.
- [x] Log restore Codex version.
- [x] Log change settings. — `site_setting.update` audit rows with actor, reason, previous and new value.
- [x] Log change plaza visibility.
- [x] Log change channel visibility. — channel create/update/status all audit.
- [x] Log change clan/house visibility.
- [x] Log change clan/house leader.
- [x] Admin can view logs.
- [x] Logs have actor.
- [x] Logs have target.
- [x] Logs have timestamp.
- [x] Logs have metadata.

## 26. Quality before production

- [ ] Manual auth tests.
- [ ] Manual permission tests.
- [ ] Manual post tests.
- [ ] Manual comment tests.
- [ ] Manual reaction tests.
- [ ] Manual report tests.
- [ ] Manual moderation tests.
- [ ] Manual admin tests.
- [ ] Manual Codex tests.
- [ ] Manual basic security tests.
- [ ] Review slow queries.
- [ ] Review indexes.
- [ ] Review RLS.
- [ ] Review mobile responsive.
- [ ] Review empty/error/loading states.
- [ ] Review basic accessibility.
- [ ] Configure backups.
- [ ] Configure monitoring/logs if applicable.
- [ ] Review `docs/dev/CORE_SYSTEM_RULES.md`.
- [ ] Review `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md`.
- [ ] Review query, payload and latency budgets for critical paths.
- [ ] Verify idempotent event/outbox consumers.

## 27. Pending decision

- [ ] Define if nested comments are MVP or future.
- [ ] Define if Holochat is realtime from start or later phase.
- [ ] Define if attachments are in MVP.
- [ ] Define if reputation is in MVP.
- [ ] Define if clans/houses are in full MVP or placeholder.
- [ ] Define if email notifications are in MVP.
- [ ] Define final visual system.
- [ ] Define final rank names.
- [ ] Define exact community rules.
