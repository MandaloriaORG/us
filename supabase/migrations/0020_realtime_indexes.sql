-- Performance indexes for holochat realtime at 1k concurrent users.
-- Existing chat_messages_channel_idx covers the channel filter; this composite
-- supports the message-list ordering and the realtime filter in one scan.
create index if not exists chat_messages_channel_created_idx
  on public.chat_messages (channel_id, created_at desc);

-- Same composite for parent thread (used when a user clicks "view replies").
create index if not exists chat_messages_parent_created_idx
  on public.chat_messages (parent_id, created_at asc)
  where parent_id is not null;

-- chat_reactions lookups by message_id happen on every render of the thread.
-- The existing chat_reactions_message_idx already covers that; this covers the
-- uniqueness lookup that drives the toggle action.
create unique index if not exists chat_reactions_actor_msg_unique
  on public.chat_reactions (actor_id, message_id)
  where actor_id is not null;

-- notifications fan-out: per-user unread ordering drives the bell + outbox.
create index if not exists notifications_user_created_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;