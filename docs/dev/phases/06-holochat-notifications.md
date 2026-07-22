# Phase 6 - Holochat and Notifications

## Objective

Add live conversation and notifications without cloning Discord entirely.

## Holochat

- [ ] List channels.
- [ ] View channel.
- [ ] Send message.
- [ ] Edit own message.
- [ ] Delete own message.
- [ ] Reply to message.
- [ ] React to message.
- [ ] Report message.
- [ ] Propose message or conversation eligible for the Codex.
- [ ] Pagination or incremental loading.
- [ ] Announcement channel, Council write-only.

## Chat moderation

- [ ] Moderator can delete message.
- [ ] Moderator can hide message.
- [ ] Moderator can restore message.
- [ ] Moderator can pin message.
- [ ] Moderator can mute user.
- [ ] Admin can create channel.
- [ ] Admin can edit channel.
- [ ] Admin can archive channel.
- [ ] Admin can configure channel permissions.

## Special channels

- [ ] welcome.
- [ ] general.
- [ ] questions.
- [ ] philosophy.
- [ ] library.
- [ ] announcements.
- [ ] clans.
- [ ] projects.
- [ ] off-topic.

## Notifications

- [ ] Notify reply to post.
- [ ] Notify reply to comment.
- [ ] Notify received reaction.
- [ ] Notify mention.
- [ ] Notify friend request.
- [ ] Notify clan/casa invitation.
- [ ] Notify warning.
- [ ] Notify important announcement.
- [ ] Mark as read.
- [ ] Mark all as read.
- [ ] Notification preferences.

## Reliable delivery

- [ ] Create event outbox in the same transaction as the main action.
- [ ] Process notifications off the critical path when appropriate.
- [ ] Idempotent consumer does not create duplicate notifications.
- [ ] Retries have a limit and backoff.
- [ ] Failed event can be inspected and reprocessed.
- [ ] Payload does not copy unnecessary private content.

## Security

- [ ] User only sees permitted channels.
- [ ] Rate limit on messages.
- [ ] Private clan messages do not appear publicly.
- [ ] Chat reports reach the queue.
- [ ] Blocks affect direct interactions.

## Done when

- [ ] Holochat allows conversation via channels.
- [ ] Mods/admins can delete messages.
- [ ] Basic notifications work.
- [ ] Failing to notify does not revert correctly created content.
- [ ] Private channels respect permissions.
