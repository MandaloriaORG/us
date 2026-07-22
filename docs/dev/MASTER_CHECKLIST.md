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

- [ ] List plazas.
- [ ] View plaza details.
- [ ] Central Plaza.
- [ ] Initiate's Questions.
- [ ] Mandalorian Philosophy.
- [ ] The Way.
- [ ] Debates and Discussion.
- [ ] Lore and Culture.
- [ ] Creative Forge.
- [ ] Council Announcements.
- [ ] Tavern.
- [ ] Create plaza from admin.
- [ ] Edit plaza from admin.
- [ ] Change slug.
- [ ] Change description.
- [ ] Change visibility.
- [ ] Reorder plazas.
- [ ] Archive plaza.
- [ ] Configure plaza rules.
- [ ] Configure permissions per plaza.
- [ ] Archived plaza does not accept new posts.
- [ ] Council Announcements only allows posting by authorized roles.

## 6. Posts

- [ ] Create post.
- [ ] View post.
- [ ] Edit own post.
- [ ] Delete own post with soft delete.
- [ ] List posts by plaza.
- [ ] Main post feed.
- [ ] Post pagination.
- [ ] Recent order.
- [ ] Popular order.
- [ ] Highlighted order.
- [ ] Tags in posts.
- [ ] Save/bookmark post.
- [ ] Remove bookmark.
- [ ] Share link.
- [ ] Draft status.
- [ ] Published status.
- [ ] Pending review status.
- [ ] Closed status.
- [ ] Pinned status.
- [ ] Highlighted status.
- [ ] Hidden status.
- [ ] Deleted by author status.
- [ ] Deleted by moderator status.
- [ ] Archived status.
- [ ] Lock editing if moderation decides.
- [ ] Closed post does not accept comments.
- [ ] Pending post does not appear publicly.
- [ ] Deleted post does not break comments.

## 7. Comments and replies

- [ ] Create comment.
- [ ] View comments.
- [ ] Reply to comment.
- [ ] Show replies.
- [ ] Edit own comment.
- [ ] Delete own comment with soft delete.
- [ ] Copy direct link to comment.
- [ ] Comment pagination.
- [ ] Order by date.
- [ ] Order by relevance if implemented.
- [ ] Deleted parent comment maintains context.
- [ ] Reply to hidden comment is handled correctly.
- [ ] Comment cannot be created on closed post.
- [ ] Edited comment saves version if applicable.

## 8. Likes, dislikes and reactions

- [ ] Like on post.
- [ ] Dislike on post.
- [ ] Remove vote on post.
- [ ] Change like to dislike.
- [ ] Like on comment.
- [ ] Dislike on comment.
- [ ] Remove vote on comment.
- [ ] Emoji reaction on post.
- [ ] Emoji reaction on comment.
- [ ] Remove reaction.
- [ ] Avoid duplicate reaction.
- [ ] Consistent counters.
- [ ] Admin can create reaction type.
- [ ] Admin can deactivate reaction type.
- [ ] Admin decides if reaction affects reputation.
- [ ] New users may have reaction limit.
- [ ] Cannot react to deleted content.

## 9. Reports

- [ ] Report post.
- [ ] Report comment.
- [ ] Report chat message.
- [ ] Report profile.
- [ ] Choose report reason.
- [ ] Write description.
- [ ] Prevent report spam.
- [ ] Group duplicate reports.
- [ ] Report queue.
- [ ] Moderator can assign report to self.
- [ ] Moderator can resolve report.
- [ ] Moderator can reject report.
- [ ] Moderator can take action from report.
- [ ] Admin can view all reports.
- [ ] Admin can configure reasons.
- [ ] Decision is recorded.

## 10. Moderation

- [ ] Moderator can hide post.
- [ ] Moderator can restore post.
- [ ] Authorized moderator can quarantine post.
- [ ] Authorized moderator can remove post from quarantine.
- [ ] Moderator can delete post.
- [ ] Moderator can close post.
- [ ] Moderator can reopen post.
- [ ] Moderator can pin post.
- [ ] Moderator can highlight post.
- [ ] Moderator can move post.
- [ ] Moderator can lock post editing.
- [ ] Moderator can hide comment.
- [ ] Moderator can restore comment.
- [ ] Authorized moderator can quarantine comment/attachments.
- [ ] Moderator can delete comment.
- [ ] Moderator can pin comment.
- [ ] Moderator can lock replies.
- [ ] Moderator can warn user.
- [x] Moderator can suspend user if they have permission.
- [x] Moderator can ban user if they have permission.
- [ ] Moderator can add internal note.
- [ ] Moderator sees user history.
- [x] Moderator only acts within their scope.
- [x] Moderator cannot moderate admins.
- [ ] Sensitive actions are logged in moderator_actions.
- [x] Sensitive actions are logged in audit_logs.
- [ ] Hiding and quarantine are reversible.
- [ ] Restore recovers the last allowed state.
- [ ] Permanent deletion requires higher permission, reason and confirmation.
- [ ] Moderation evidence has limited access and retention.
- [ ] Appeal can be linked to the original action.

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

- [ ] List categories.
- [ ] View published article.
- [ ] Search articles.
- [ ] Save article.
- [ ] Link article to discussion/plaza.
- [ ] Admin can create article.
- [ ] Admin can edit article.
- [ ] Admin can delete/archive article.
- [ ] Admin can publish article.
- [ ] Admin can unpublish article.
- [ ] Admin can lock article.
- [ ] Admin can restore article.
- [ ] Archivist can create article if they have permission.
- [ ] Archivist can edit article if they have permission.
- [ ] User can suggest correction.
- [ ] Review suggestions.
- [ ] Accept suggestion.
- [ ] Reject suggestion.
- [ ] Create category.
- [ ] Edit category.
- [ ] Archive category.
- [ ] Version history.
- [ ] Restore previous version.
- [ ] Change author saved.
- [ ] Change summary saved.
- [ ] Propose conversation for the Codex.
- [ ] Add allowed sources to proposal.
- [ ] Detect/merge duplicate proposals.
- [ ] Classify proposal.
- [ ] Assign Archivist.
- [ ] Create draft from proposal.
- [ ] Confirm or reject contributions.
- [ ] Accept, reject, withdraw and reopen proposal.
- [ ] Publish reviewed version, never the proposal directly.
- [ ] Link conversation and article in both directions.
- [ ] Show allowed provenance and confirmed contributors.
- [ ] Re-validate source privacy before publishing.
- [ ] Allow anonymous or withdrawn attribution according to policy.
- [ ] Drafts, private sources and reviews are not indexed.
- [ ] Permission, privacy, duplicate and concurrency tests.

## 13. Codex Markdown Editor

- [ ] Title field.
- [ ] Slug field.
- [ ] Category selector.
- [ ] Markdown Editor.
- [ ] Markdown Preview.
- [ ] Save draft.
- [ ] Publish.
- [ ] Unpublish.
- [ ] Archive.
- [ ] Restore.
- [ ] Change message/summary.
- [ ] Title validation.
- [ ] Slug validation.
- [ ] Content validation.
- [ ] Markdown sanitization.
- [ ] Raw HTML blocked or filtered.
- [ ] Scripts blocked.
- [ ] Safe external links.
- [ ] Images restricted if allowed.

## 14. Clans, houses and circles

- [ ] List clans/houses.
- [ ] View clan/house page.
- [ ] Create clan/house.
- [ ] Edit name.
- [ ] Edit slug.
- [ ] Edit description.
- [ ] Edit emblem.
- [ ] Change color.
- [ ] Change privacy.
- [ ] Archive clan/house.
- [ ] Request to join.
- [ ] Invite user.
- [ ] Accept request.
- [ ] Reject request.
- [ ] Leave clan/house.
- [ ] Expel member.
- [ ] Change leader.
- [ ] Create internal roles.
- [ ] Assign internal role.
- [ ] Remove internal role.
- [ ] Create internal announcement.
- [ ] Clan internal space if applicable.
- [ ] Clan internal channel if applicable.
- [ ] Define House mission.
- [ ] Define areas of responsibility/Codex.
- [ ] Create research expedition.
- [ ] Define expedition goal and responsible parties.
- [ ] Manage expedition participants and sources.
- [ ] Close or archive expedition with result.
- [ ] Propose expedition result to the Codex.
- [ ] Maintaining an area does not grant ownership or automatic publishing.
- [ ] Leader only manages their clan/house.
- [ ] Admin can intervene.

## 15. Ranks and badges

- [ ] Create rank.
- [ ] Edit rank.
- [ ] Delete/archive rank.
- [ ] Assign rank manually.
- [ ] Remove rank.
- [ ] Show rank on profile.
- [ ] Show rank next to name.
- [ ] Create badge.
- [ ] Edit badge.
- [ ] Delete/archive badge.
- [ ] Assign badge manually.
- [ ] Withdraw badge.
- [ ] Show badges on profile.
- [ ] Show issuer, date, reason and verifiable badge status.
- [ ] Link public evidence or show protected reference.
- [ ] Revoke badge without deleting internal history.
- [ ] Only authorized issuers assign each badge type.
- [ ] Private evidence is not exposed on profiles.
- [ ] Automatic badges if implemented.
- [ ] Automatic ranks if implemented.
- [ ] Rank does not grant permissions without explicit rule.
- [ ] Badge does not grant permissions without explicit rule.

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

- [ ] Send friend request.
- [ ] Accept request.
- [ ] Reject request.
- [ ] Cancel request.
- [ ] Remove friend.
- [ ] View friends on profile according to privacy.
- [ ] Block user.
- [ ] Unblock user.
- [ ] Blocked user cannot send request.
- [ ] Blocked user cannot interact directly.
- [ ] Rate limit on requests.
- [ ] Moderation can review abuse/harassment.

## 18. Holochat

- [ ] List channels.
- [ ] View channel.
- [ ] Welcome channel.
- [ ] General channel.
- [ ] Questions channel.
- [ ] Philosophy channel.
- [ ] Library channel.
- [ ] Announcements channel.
- [ ] Clans channel.
- [ ] Projects channel.
- [ ] Off-topic channel.
- [ ] Send message.
- [ ] Edit own message.
- [ ] Delete own message.
- [ ] Reply to message.
- [ ] React to message.
- [ ] Report message.
- [ ] Propose eligible message/conversation for the Codex.
- [ ] Load history.
- [ ] Pagination/incremental loading.
- [ ] Pinned messages.
- [ ] Announcements channel is Council write-only.
- [ ] Private channels by role if applicable.
- [ ] Private channels by clan/house if applicable.
- [ ] User only sees allowed channels.

## 19. Holochat moderation

- [ ] Moderator can delete message.
- [ ] Moderator can hide message.
- [ ] Moderator can restore message.
- [ ] Moderator can pin message.
- [ ] Moderator can mute user.
- [ ] Admin can create channel.
- [ ] Admin can edit channel.
- [ ] Admin can archive channel.
- [ ] Admin can configure channel permissions.
- [ ] Chat reports enter the queue.
- [ ] Rate limit on messages.
- [ ] Message edited after report remains traceable.

## 20. Notifications

- [ ] Create notification.
- [ ] List user's notifications.
- [ ] Mark one as read.
- [ ] Mark all as read.
- [ ] Notify post reply.
- [ ] Notify comment reply.
- [ ] Notify received reaction.
- [ ] Notify mention.
- [ ] Notify friend request.
- [ ] Notify clan/house invitation.
- [ ] Notify resolved report.
- [ ] Notify warning.
- [ ] Notify important announcement.
- [ ] Notification preferences.
- [ ] Mute plaza.
- [ ] Mute post.
- [ ] Mute user.
- [ ] Optional email if implemented.
- [ ] Notification does not show disallowed private content.
- [ ] Outbox event is created alongside the main action.
- [ ] Notification consumer is idempotent.
- [ ] Retries have limit and backoff.
- [ ] Failed events can be inspected and reprocessed.
- [ ] Notification failure does not revert valid content.

## 21. Search

- [ ] Search posts.
- [ ] Search comments if decided.
- [ ] Search Codex articles.
- [ ] Filter by plaza.
- [ ] Filter by tag.
- [ ] Filter by author.
- [ ] Filter by date.
- [ ] Results respect permissions.
- [ ] Deleted content does not appear.
- [ ] Private content does not appear.
- [ ] Paginated search.
- [ ] Anti-scraping/rate limit protection.

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

- [ ] Configurable site name.
- [ ] Configurable description.
- [ ] Open/closed registration.
- [ ] Configurable navigation.
- [ ] Configurable reactions.
- [ ] Configurable posting limits.
- [ ] Configurable comment limits.
- [ ] Configurable attachment limits.
- [ ] Configurable Codex visibility.
- [ ] Configurable per-plaza rules.
- [ ] Configurable initial visual theme.
- [ ] Theme settings.
- [ ] Feature flags.
- [ ] Custom profile fields if implemented.
- [ ] Custom post fields if implemented.
- [ ] Each setting has type and default value.
- [ ] Each numeric setting has minimum and maximum.
- [ ] Server-side validation of settings.
- [ ] Absolute security limits are not edited from UI.
- [ ] Critical changes require permission and confirmation.
- [ ] Save author, date, previous and new value.
- [ ] Version configuration.
- [ ] Restore only valid versions.

## 24. Security

- [x] RLS on profiles.
- [x] RLS on roles.
- [x] RLS on user_roles.
- [x] RLS on permissions.
- [x] RLS on role_permissions.
- [ ] RLS on spaces.
- [ ] RLS on posts.
- [ ] RLS on comments.
- [ ] RLS on reactions/content_reactions.
- [ ] RLS on reports.
- [ ] RLS on moderation_queue.
- [ ] RLS on moderator_actions.
- [x] RLS on audit_logs.
- [ ] RLS on clans.
- [ ] RLS on clan_members.
- [ ] RLS on library_articles.
- [ ] RLS on library_article_versions.
- [ ] RLS on knowledge_proposals.
- [ ] RLS on knowledge_proposal_sources.
- [ ] RLS on knowledge_proposal_contributors.
- [ ] RLS on chat_channels.
- [ ] RLS on chat_messages.
- [ ] RLS on notifications.
- [x] Server-side validation on actions.
- [ ] Markdown sanitization.
- [x] Bio/profile sanitization.
- [ ] Rate limit posting.
- [ ] Rate limit commenting.
- [ ] Rate limit replying.
- [ ] Rate limit reacting.
- [ ] Rate limit reporting.
- [ ] Rate limit friend requests.
- [ ] Rate limit chat.
- [ ] Rate limit file upload.
- [ ] Soft delete on community content.
- [x] Audit logs on admin/mod changes.
- [x] XSS protection.
- [x] Private data protection.
- [x] Search respects permissions.
- [x] Restricted storage.
- [x] Private variables not exposed.

## 25. Audit and logs

- [x] Log assign role.
- [x] Log remove role.
- [ ] Log change permissions.
- [x] Log ban user.
- [x] Log suspend user.
- [ ] Log hide content.
- [ ] Log restore content.
- [ ] Log delete content as mod/admin.
- [ ] Log publish Codex article.
- [ ] Log unpublish Codex article.
- [ ] Log restore Codex version.
- [ ] Log change settings.
- [ ] Log change plaza visibility.
- [ ] Log change channel visibility.
- [ ] Log change clan/house visibility.
- [ ] Log change clan/house leader.
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
