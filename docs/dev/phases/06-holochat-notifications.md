# Phase 6 - Holochat and Notifications

## Objective

Add live conversation and notifications without cloning Discord entirely.

## Holochat

- [x] List channels.
- [x] View channel.
- [x] Send message.
- [x] Edit own message.
- [x] Delete own message.
- [x] Reply to message.
- [x] React to message.
- [x] Report message.
- [ ] Propose message or conversation eligible for the Codex. — blocked: no DB RPC accepts a `chat_message_id` source (`add_codex_proposal_source` rejects it in migration 0015).
- [x] Pagination or incremental loading.
- [x] Announcement channel, Council write-only.

## Chat moderation

- [x] Moderator can delete message.
- [x] Moderator can hide message.
- [x] Moderator can restore message.
- [x] Moderator can pin message.
- [ ] Moderator can mute user. — no mute RPC in the 0015-0018 contract.
- [x] Admin can create channel.
- [x] Admin can edit channel.
- [x] Admin can archive channel.
- [x] Admin can configure channel permissions.

## Special channels

- [x] welcome.
- [x] general.
- [x] questions.
- [x] philosophy.
- [x] library.
- [x] announcements.
- [x] clans.
- [x] projects.
- [x] off-topic.

## Notifications

- [x] Notify reply to post.
- [x] Notify reply to comment.
- [x] Notify received reaction.
- [ ] Notify mention. — `mention` enum exists but no producer enqueues it.
- [x] Notify friend request.
- [x] Notify clan/casa invitation.
- [x] Notify warning.
- [ ] Notify important announcement. — the event is recorded without a recipient; member fan-out is not in the contract.
- [x] Mark as read.
- [x] Mark all as read.
- [x] Notification preferences.

## Reliable delivery

- [x] Create event outbox in the same transaction as the main action.
- [x] Process notifications off the critical path when appropriate.
- [x] Idempotent consumer does not create duplicate notifications.
- [x] Retries have a limit and backoff.
- [x] Failed event can be inspected and reprocessed.
- [x] Payload does not copy unnecessary private content.

## Security

- [x] User only sees permitted channels.
- [x] Rate limit on messages.
- [x] Private clan messages do not appear publicly.
- [x] Chat reports reach the queue.
- [x] Blocks affect direct interactions.

## Done when

- [x] Holochat allows conversation via channels.
- [x] Mods/admins can delete messages.
- [x] Basic notifications work.
- [x] Failing to notify does not revert correctly created content.
- [x] Private channels respect permissions.
