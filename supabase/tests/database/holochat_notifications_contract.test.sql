begin;

-- Holochat and notifications contract.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(68);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'h-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Chat Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'h-other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Chat Other"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'h-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Chat Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'h-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Chat Admin"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'e0000000-0000-0000-0000-000000000003', id from public.roles where name = 'Moderator';
insert into public.user_roles (user_id, role_id)
select 'e0000000-0000-0000-0000-000000000004', id from public.roles where name = 'Administrator';

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

create or replace function pg_temp.act_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), true);
end;
$$;

create or replace function pg_temp.channel(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.chat_channels where chat_channels.slug = p_slug;
$$;

create or replace function pg_temp.plaza(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.message_status(p_message_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.chat_messages where chat_messages.id = p_message_id;
$$;

create or replace function pg_temp.outbox_count()
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.event_outbox;
$$;

create or replace function pg_temp.outbox_attempts(p_event_id uuid)
returns integer language sql security definer set search_path = '' as $$
  select attempts from public.event_outbox where event_outbox.id = p_event_id;
$$;

create or replace function pg_temp.notification_count(p_recipient uuid)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.notifications where notifications.recipient_id = p_recipient;
$$;

create or replace function pg_temp.notification_type(p_recipient uuid)
returns text language sql security definer set search_path = '' as $$
  select type::text from public.notifications
  where notifications.recipient_id = p_recipient
  order by created_at desc, id desc limit 1;
$$;

create or replace function pg_temp.notification_types(p_recipient uuid)
returns text[] language sql security definer set search_path = '' as $$
  select coalesce(array_agg(type::text), '{}'::text[]) from public.notifications
  where notifications.recipient_id = p_recipient;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.chat_channels') is not null, 'chat_channels exists');
select ok(to_regclass('public.chat_messages') is not null, 'chat_messages exists');
select ok(to_regclass('public.chat_reactions') is not null, 'chat_reactions exists');
select ok(to_regclass('public.event_outbox') is not null, 'event_outbox exists');
select ok(to_regclass('public.notifications') is not null, 'notifications exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.chat_messages'::regclass),
  'chat_messages has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'chat_messages'),
  0::bigint,
  'chat_messages carries no policy'
);
select is(has_table_privilege('authenticated', 'public.event_outbox', 'select'), false, 'members cannot read the outbox directly');
select is(
  has_function_privilege('anon', 'public.send_chat_message(uuid, text, uuid)', 'execute'),
  false,
  'anon cannot send messages'
);
select is(
  has_function_privilege('anon', 'public.outbox_list_failed(integer)', 'execute'),
  false,
  'anon cannot inspect failed events'
);

-- ── Channels ───────────────────────────────────────────────────────────────

set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.list_chat_channels()),
  9::bigint,
  'visitors see the nine canonical channels'
);
select is(
  (select kind::text from public.get_chat_channel('announcements')),
  'announcements',
  'the announcements channel exists'
);

-- A private channel is invisible without membership.
set local role authenticated;
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
create temp table t_private as
select channel_id from public.admin_create_chat_channel('secret-den', 'Secret Den', 'private');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.get_chat_channel('secret-den')$sql$),
  'P0002',
  'a non-member cannot see a private channel'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select ok(
  public.admin_add_chat_channel_member((select channel_id from t_private), 'e0000000-0000-0000-0000-000000000001') is not null,
  'an admin grants private-channel access'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  (select name from public.get_chat_channel('secret-den')),
  'Secret Den',
  'the member now sees the private channel'
);

-- ── Sending ────────────────────────────────────────────────────────────────

create temp table t_msg as
select message_id from public.send_chat_message(pg_temp.channel('general'), 'Hello, Holochat.');
select ok((select message_id from t_msg) is not null, 'a member sends a message');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('announcements'), 'Unauthorized notice')$sql$),
  '42501',
  'a member cannot post to announcements'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.send_chat_message(pg_temp.channel('announcements'), 'Council notice') is not null,
  'a moderator posts to announcements'
);

-- Replies count against the parent.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
create temp table t_reply as
select message_id from public.send_chat_message(pg_temp.channel('general'), 'A reply.', (select message_id from t_msg));
select ok((select message_id from t_reply) is not null, 'a reply is sent');
select is(
  (select replies_count from public.list_chat_messages(pg_temp.channel('general'), null, null, 50) where id = (select message_id from t_msg)),
  1,
  'the parent counts the reply'
);

-- Rate limit is counted from the messages themselves. The fixture rows are
-- inserted as the migration owner, since members cannot write chat_messages.
set local role postgres;
insert into public.chat_messages (channel_id, author_id, body)
select pg_temp.channel('general'), 'e0000000-0000-0000-0000-000000000001', 'Body ' || g
from generate_series(1, 120) as g;
set local role authenticated;
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'Too much')$sql$),
  '53400',
  'the chat rate limit is enforced from the source table'
);

-- ── Editing and traceability ───────────────────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select ok(
  public.update_own_chat_message((select message_id from t_msg), 'Hello, Holochat. Edited.') is not null,
  'the author edits their message'
);
select is(
  (select old_body from public.list_chat_message_edits((select message_id from t_msg)) limit 1),
  'Hello, Holochat.',
  'the edit keeps the previous wording for reports'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_own_chat_message((select message_id from t_reply), 'Not yours')$sql$),
  'P0002',
  'a member cannot edit someone else''s message'
);

-- ── Delete and moderation ──────────────────────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select ok(
  public.delete_own_chat_message((select message_id from t_reply)) is not null,
  'the author deletes their reply'
);
select is(
  pg_temp.message_status((select message_id from t_reply)),
  'deleted',
  'deletion is a soft status'
);
select is(
  (select body from public.list_chat_messages(pg_temp.channel('general'), null, null, 50) where id = (select message_id from t_reply)),
  null,
  'a deleted message has no body in the member read'
);

select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_set_chat_message_status((select message_id from t_msg), 'visible', 'hidden', 'Reported and hidden') is not null,
  'a moderator hides a message'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.list_chat_messages(pg_temp.channel('general'), null, null, 50) where id = (select message_id from t_msg)),
  0::bigint,
  'a hidden message leaves the member read'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_set_chat_message_status((select message_id from t_msg), 'hidden', 'visible', 'Clean after review') is not null,
  'a moderator restores it'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_set_chat_message_status((select message_id from t_reply), 'deleted', 'visible', 'Bring it back')$sql$),
  '22023',
  'a deleted message cannot be restored'
);

-- ── Reactions and blocks ───────────────────────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
create temp table t_react as
select * from public.toggle_chat_reaction((select message_id from t_msg), 'teaches');
select is(
  (select caller_reacted from t_react),
  true,
  'a member reacts to a message'
);
select is(
  (select caller_reacted from public.toggle_chat_reaction((select message_id from t_msg), 'teaches')),
  false,
  'toggling again removes the reaction'
);

-- A block stops a reply and a reaction.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select ok(
  public.block_user('e0000000-0000-0000-0000-000000000001') is not null,
  'a member blocks the author'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'To the author', (select message_id from t_msg))$sql$),
  '42501',
  'a block stops a reply'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.toggle_chat_reaction((select message_id from t_msg), 'teaches')$sql$),
  '42501',
  'a block stops a reaction'
);
select ok(
  public.unblock_user('e0000000-0000-0000-0000-000000000001') is not null,
  'unblocking restores the interaction'
);

-- ── Chat reports reach the queue ───────────────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
create temp table t_report as
select report_id from public.report_chat_message((select message_id from t_msg), 'harassment', 'Reported in chat');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.report_chat_message((select message_id from t_msg), 'harassment')$sql$),
  '23505',
  'one open report per reporter per chat message'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select is(
  (select target_type from public.moderation_list_reports('open') where report_id = (select report_id from t_report)),
  'chat_message',
  'the chat report appears in the existing queue'
);
select is(
  (select target_body from public.moderation_get_report((select report_id from t_report))),
  'Hello, Holochat. Edited.',
  'the queue shows the chat evidence'
);

-- ── The outbox and notifications ───────────────────────────────────────────

-- A comment reply records its notification event in the same transaction.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
create temp table t_post as
select post_id from public.create_post(pg_temp.plaza('central-plaza'), 'A post to reply to', 'Reply bait.');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
create temp table t_comment as
select comment_id from public.create_comment((select post_id from t_post), 'A reply from another member.');
select is(
  pg_temp.outbox_count(),
  1::bigint,
  'the reply wrote one outbox event'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_comment((select post_id from t_post), 'Same body again.')$sql$),
  '00000',
  'a second reply is fine'
);
select is(
  pg_temp.notification_count('e0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'no notification exists before the consumer runs'
);

-- The consumer is idempotent. The drainer returns how many events it handled.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
create temp table t_events as
select event_id from public.outbox_list_ready();
select ok((select count(*) from t_events) >= 2::bigint, 'the ready events are listed for the worker');
select is(
  (select processed from public.process_pending_outbox()),
  2,
  'the drainer delivered every ready event'
);
select is(
  pg_temp.notification_count('e0000000-0000-0000-0000-000000000001'),
  2::bigint,
  'consuming created one notification per event'
);
select is(
  pg_temp.notification_type('e0000000-0000-0000-0000-000000000001'),
  'post_reply',
  'the notification is a post_reply'
);

-- Consuming an already delivered event is a no-op.
select is(
  (select created_notification from public.outbox_consume((select event_id from t_events limit 1))),
  false,
  'a delivered event cannot create a duplicate notification'
);
select is(
  pg_temp.notification_count('e0000000-0000-0000-0000-000000000001'),
  2::bigint,
  'the notification was not duplicated'
);
select is(
  (select processed from public.process_pending_outbox()),
  0,
  'nothing remains to drain'
);

-- Failure, backoff and reprocessing.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
create temp table t_extra as
select comment_id from public.create_comment((select post_id from t_post), 'A third reply to fail.');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
create temp table t_fail as
select event_id from public.outbox_list_ready();
select is(
  (select status from public.outbox_fail((select event_id from t_fail limit 1), 'Worker crashed')),
  'pending',
  'a failing event stays pending and backs off'
);
select is(
  pg_temp.outbox_attempts((select event_id from t_fail limit 1)),
  1,
  'the failure recorded an attempt'
);
-- Exhaust the attempts one statement at a time: several calls inside a single
-- statement would share one snapshot and never see each other's increments.
select (select status from public.outbox_fail((select event_id from t_fail limit 1), 'e2'));
select (select status from public.outbox_fail((select event_id from t_fail limit 1), 'e3'));
select (select status from public.outbox_fail((select event_id from t_fail limit 1), 'e4'));
select (select status from public.outbox_fail((select event_id from t_fail limit 1), 'e5'));
select is(
  (select attempts from public.outbox_list_failed() where event_id = (select event_id from t_fail limit 1)),
  5,
  'an exhausted event is failed and inspectable'
);
select ok(
  public.outbox_reprocess((select event_id from t_fail limit 1)) is not null,
  'an administrator reprocesses the failed event'
);
select is(
  (select created_notification from public.outbox_consume((select event_id from t_fail limit 1))),
  true,
  'the reprocessed event is consumed'
);

-- ── Friend request and warning notifications ───────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
create temp table t_friend as
select friendship_id from public.send_friend_request('e0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select public.send_friend_request('e0000000-0000-0000-0000-000000000002')$sql$),
  '22023',
  'a duplicate friend request is refused'
);
select is(
  pg_temp.outbox_count() >= 1::bigint,
  true,
  'the friend request enqueued an event'
);

select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_warn_user('e0000000-0000-0000-0000-000000000001', 'Mind the rate limits') is not null,
  'a moderator warns the member'
);

select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select ok((select count(*) from public.process_pending_outbox()) >= 1, 'the drainer delivers the pending notifications');
select ok(
  'friend_request' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000002')),
  'the addressee is notified of the request'
);
select ok(
  'warning' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000001')),
  'the warned member is notified'
);

-- Reading and marking notifications.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.list_own_notifications()),
  4::bigint,
  'a member reads only their own notifications'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.mark_notification_read('99999999-0000-4000-8000-000000000001')$sql$),
  'P0002',
  'a member cannot mark a stranger''s notification'
);
select ok(
  public.mark_all_notifications_read() is not null,
  'marking all as read works'
);
select is(
  (select count(*) from public.list_own_notifications(true)),
  0::bigint,
  'no unread notifications remain'
);

-- Notification preferences are shape-checked.
select is(
  pg_temp.capture_sqlstate($sql$select * from public.set_notification_preferences('{"bogus_type":true}'::jsonb)$sql$),
  '22023',
  'unknown notification types are refused'
);
select ok(
  public.set_notification_preferences('{"post_reply":false,"reaction":true}'::jsonb) is not null,
  'known types are accepted'
);

-- Failed events are inspectable and reprocessable by an administrator.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select is(
  (select count(*) from public.outbox_list_failed()),
  0::bigint,
  'no events have exhausted their attempts'
);

select * from extensions.finish();
rollback;
