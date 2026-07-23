# Phase 3 - Moderation and Basic Admin

## Objective

Make Mandaloria manageable and moderatable.

## Reports

- [x] Report post. — `ReportControl` on the post page, wired to `createReport`.
- [x] Report comment. — same control on each comment, hidden for its own author.
- [x] Report profile. — same control on a member's profile page, hidden on your own.
- [x] Choose reason. — the reason select uses `report-reasons.ts` labels verbatim.
- [x] Add description. — optional details textarea, server-validated.
- [x] Prevent abusive duplicate reports.
- [x] Report queue.

## Post moderation

- [x] Hide post.
- [x] Restore post.
- [x] Delete post as moderator/admin.
- [x] Lock post. — `PostModerationPanel` on the post page, for `moderation.hide`.
- [x] Reopen post. — same panel; the button names the reverse of the current state.
- [x] Pin post. — flags section of the same panel; only changed flags are sent.
- [x] Highlight post. — same.
- [x] Move post. — same panel; the Plaza the post is already in is not offered.
- [x] Lock editing. — `edit_locked` in the same flags section.
- [x] Put in quarantine during investigation.
- [x] Remove from quarantine and restore allowed state.

## Comment moderation

- [x] Hide comment.
- [x] Restore comment.
- [x] Delete comment as moderator/admin.
- [x] Pin comment. — `CommentModerationControl` on each comment, for `moderation.hide`.
- [x] Lock replies. — same control.
- [x] View edit history if it exists. — migration `0012` records it and `RevisionHistory` shows the earlier wordings under the evidence on the report detail page.
- [x] Put comment and related attachments in quarantine. — quarantine works; the app has no attachment feature to carry along.

## Reversibility

- [x] Hiding does not destroy content or evidence. — proven by `content_moderation_contract.test.sql` and by the report detail page still rendering the body of hidden/quarantined content.
- [x] Quarantine removes content from feed, search, previews and public storage. — removed from every list/read RPC for non-moderators (0007/0010); there is no search feature or post attachment storage yet for the rest of the claim to apply to.
- [x] Restore preserves traceability. — the restore transition is audited like every other one.
- [ ] Permanent deletion requires superior permission, reason and confirmation. — there is no permanent/physical deletion in this system by design (rule 1 of migration 0010: hiding and deleting are both state changes, not erasure); this item does not apply until such an action is deliberately added.
- [x] Appeal is linked to the original action. — migration `0013`: an appeal references the `audit_logs` row for the action it argues with, one per action, filed from the member's own profile and decided in `council/appeals`. Granting records the judgement; undoing the action stays a separate audited call.
- [x] Evidence has limited access and retention. — edit history is bounded to 50 revisions per item (`0012`); closed reports and decided appeals are purged 180 days after they close by `private.purge_expired_moderation_evidence()`, scheduled nightly through `pg_cron` (`0013`, `0014`). Audit rows are deliberately never purged: they are the record that an action happened.

## Users

- [x] Warn user. — `UserModerationPanel` on the Council user page; the member reads and acknowledges it on their own profile (`OwnWarnings`).
- [x] Suspend user.
- [x] Ban user.
- [x] Unban user.
- [x] View user moderation history. — the Council user page links to the audit log filtered by that member; there is deliberately no second store.
- [x] Add internal note. — Council notes on the same panel; only the note's author may remove it, and the subject never sees them.

## Logs

- [x] Log moderation actions.
- [x] Log admin actions.
- [x] View audit logs.
- [x] Filter logs.

## Security

- [x] Moderator only acts within their scope.
- [x] Moderator cannot moderate admins.
- [x] Strong actions require specific permission.
- [x] Every sensitive change is audited.

## Done when

- [x] A user can report.
- [x] A moderator can resolve reports.
- [x] An admin can audit actions.
- [x] A moderator can delete/hide messages and posts according to permissions.
- [x] Reversible actions can be undone without editing the database manually.
