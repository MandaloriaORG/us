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
- [ ] Lock post. — `moderation_set_post_status` accepts `closed` and the action layer allows it; not surfaced in the Council UI, which only offers hide/quarantine/delete/restore from the report queue.
- [ ] Reopen post. — same RPC, same gap.
- [ ] Pin post. — `moderation_set_post_flags`/`setPostFlags` implemented and tested; no UI control.
- [ ] Highlight post. — same.
- [ ] Move post. — `moderation_move_post`/`movePost` implemented and tested; no UI control.
- [ ] Lock editing. — `edit_locked` flag, same gap as pin/highlight.
- [x] Put in quarantine during investigation.
- [x] Remove from quarantine and restore allowed state.

## Comment moderation

- [x] Hide comment.
- [x] Restore comment.
- [x] Delete comment as moderator/admin.
- [ ] Pin comment. — `moderation_set_comment_flags`/`setCommentFlags` implemented and tested; no UI control.
- [ ] Lock replies. — same.
- [ ] View edit history if it exists. — migration `0012` records it: `update_own_post`/`update_own_comment` snapshot the previous wording, `list_content_revisions` reads it back for the author or a moderator. No UI surfaces it yet.
- [x] Put comment and related attachments in quarantine. — quarantine works; the app has no attachment feature to carry along.

## Reversibility

- [x] Hiding does not destroy content or evidence. — proven by `content_moderation_contract.test.sql` and by the report detail page still rendering the body of hidden/quarantined content.
- [x] Quarantine removes content from feed, search, previews and public storage. — removed from every list/read RPC for non-moderators (0007/0010); there is no search feature or post attachment storage yet for the rest of the claim to apply to.
- [x] Restore preserves traceability. — the restore transition is audited like every other one.
- [ ] Permanent deletion requires superior permission, reason and confirmation. — there is no permanent/physical deletion in this system by design (rule 1 of migration 0010: hiding and deleting are both state changes, not erasure); this item does not apply until such an action is deliberately added.
- [ ] Appeal is linked to the original action. — no appeals feature exists.
- [ ] Evidence has limited access and retention. — edit history has both since `0012`: readable only by the author or `moderation.hide`, and bounded to the 50 most recent revisions per item. Reports and audit rows still have no retention policy.

## Users

- [ ] Warn user.
- [x] Suspend user.
- [x] Ban user.
- [x] Unban user.
- [ ] View user moderation history.
- [ ] Add internal note.

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
