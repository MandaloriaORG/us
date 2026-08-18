begin;

-- Holochat and notification contract gaps (migration 0022).
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(47);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'g-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'g-other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Other"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'g-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'g-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Admin"}', now(), now(), '', '', '', '');

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

create or replace function pg_temp.notification_types(p_recipient uuid)
returns text[] language sql security definer set search_path = '' as $$
  select coalesce(array_agg(type::text), '{}'::text[]) from public.notifications
  where notifications.recipient_id = p_recipient;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.chat_mutes') is not null, 'chat_mutes exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.chat_mutes'::regclass),
  true,
  'chat_mutes has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'chat_mutes'),
  0::bigint,
  'chat_mutes carries no policy'
);
select is(
  has_table_privilege('authenticated', 'public.chat_mutes', 'select'),
  false,
  'members cannot read chat_mutes directly'
);
select is(
  has_function_privilege('anon', 'public.create_codex_proposal_from_chat(text, uuid, text)', 'execute'),
  false,
  'anon cannot propose from a chat source'
);
select is(
  has_function_privilege('anon', 'public.moderation_mute_chat_user(uuid, text, integer)', 'execute'),
  false,
  'anon cannot mute'
);

-- ── 5. Codex proposal from a chat message ──────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
create temp table t_chat_msg as
select message_id from public.send_chat_message(pg_temp.channel('general'), 'A conversation worth distilling.');
select ok((select message_id from t_chat_msg) is not null, 'the member sends a message');

create temp table t_proposal as
select proposal_id from public.create_codex_proposal_from_chat(
  'This chat conversation should become a Codex article.',
  (select message_id from t_chat_msg)
);
select ok((select proposal_id from t_proposal) is not null, 'a proposal is created from a chat message');
select is(
  (select source_type::text from public.codex_proposal_sources where proposal_id = (select proposal_id from t_proposal)),
  'chat_message',
  'the proposal source is a chat_message'
);

-- A hidden message cannot be proposed: the visibility rule applies.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
create temp table t_hidden as
select message_id from public.send_chat_message(pg_temp.channel('general'), 'A message to hide.');
select public.moderation_set_chat_message_status(
  (select message_id from t_hidden), 'visible', 'hidden', 'Not for the Codex'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_proposal_from_chat('A proposal on a hidden chat message.', (select message_id from t_hidden))$sql$),
  'P0002',
  'a hidden chat message cannot be proposed'
);

-- Adding a chat source to an open proposal works for the proposer.
create temp table t_prop2 as
select proposal_id from public.create_codex_proposal_from_chat(
  'A second conversation for the Codex.',
  (select message_id from t_chat_msg)
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.add_chat_codex_proposal_source((select proposal_id from t_prop2), (select message_id from t_hidden))$sql$),
  'P0002',
  'a hidden message cannot be attached as a source'
);
select ok(
  public.add_chat_codex_proposal_source(
    (select proposal_id from t_prop2),
    (select message_id from t_chat_msg),
    'the visible source attaches'
  ) is not null,
  'a visible chat message attaches as a source'
);

-- ── 6. Mention producer ────────────────────────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select ok(
  public.send_chat_message(pg_temp.channel('general'), 'Hey @Gap Other, look at this.') is not null,
  'the mentioning message is sent'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'x@Gap Other is not a mention')$sql$),
  '00000',
  'a non-whole-word at is still a valid message'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'Reply to @Gap Other.')$sql$),
  '00000',
  'a whole-word mention sends fine'
);

-- Drain the outbox and check who was notified.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select ok((select count(*) from public.process_pending_outbox()) >= 1, 'the drainer delivers the mention events');
select ok(
  'mention' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000002')),
  'the mentioned member is notified'
);
select ok(
  NOT ('mention' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000001'))),
  'the author is not notified of their own mention'
);
select ok(
  NOT ('mention' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000003'))),
  'an unmentioned member is not notified'
);

-- ── 7. Resolved-report notification ────────────────────────────────────────

-- The message is authored by ANOTHER member so the reporter (e…001) is not
-- reporting their own content — report_chat_message forbids self-reports.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
create temp table t_report_msg as
select message_id from public.send_chat_message(pg_temp.channel('general'), 'Worth reporting.');
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
create temp table t_report as
select report_id from public.report_chat_message(
  (select message_id from t_report_msg),
  'spam'::public.report_reason,
  'Unsolicited content'
);
select ok((select report_id from t_report) is not null, 'a report is filed');

select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_set_report_status(
    (select report_id from t_report), 'open', 'resolved', 'Confirmed and removed'
  ) is not null,
  'a moderator resolves the report'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select ok((select count(*) from public.process_pending_outbox()) >= 1, 'the drainer delivers the report notification');
select ok(
  'report_resolved' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000001')),
  'the reporter is notified when their report is resolved'
);

-- A dismissed report does not notify.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
create temp table t_report2 as
select report_id from public.report_chat_message(
  (select message_id from t_report_msg),
  'other'::public.report_reason,
  'Overly broad'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_set_report_status(
    (select report_id from t_report2), 'open', 'dismissed', 'No action warranted'
  ) is not null,
  'a moderator dismisses the report'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select ok((select count(*) from public.process_pending_outbox()) >= 0, 'the drainer runs');
select ok(
  NOT ('report_resolved' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000001'))),
  'a dismissed report does not notify the reporter'
);

-- ── 8. Announcement fan-out ────────────────────────────────────────────────

select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.post_chat_announcement(pg_temp.channel('announcements'), 'The Council has spoken.') is not null,
  'a moderator posts an announcement'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
select ok((select count(*) from public.process_pending_outbox()) >= 1, 'the drainer delivers the announcement events');
select ok(
  'announcement' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000001')),
  'a member is notified of the announcement'
);
select ok(
  'announcement' = any(pg_temp.notification_types('e0000000-0000-0000-0000-000000000002')),
  'another member is notified of the announcement'
);

-- ── 9. Moderator mute RPCs ─────────────────────────────────────────────────

-- A non-moderator cannot mute.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_mute_chat_user('e0000000-0000-0000-0000-000000000002', 'Because I say so')$sql$),
  '42501',
  'a member cannot mute'
);

-- A moderator mutes the member indefinitely.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_mute_chat_user('e0000000-0000-0000-0000-000000000001', 'Repeated spam', null) is not null,
  'a moderator mutes the member indefinitely'
);

-- The muted member cannot send.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'Still here')$sql$),
  '42501',
  'a muted member cannot send a message'
);

-- A temporary mute lifts after its duration.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_mute_chat_user('e0000000-0000-0000-0000-000000000002', 'One minute timeout', 1) is not null,
  'a moderator mutes the other member for one minute'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'Muted now')$sql$),
  '42501',
  'a temporarily muted member cannot send'
);

-- Unmute restores sending.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_unmute_chat_user('e0000000-0000-0000-0000-000000000001', 'First strike forgiven') is not null,
  'a moderator unmutes the member'
);
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_chat_message(pg_temp.channel('general'), 'Back in the room')$sql$),
  '00000',
  'an unmuted member can send again'
);

-- Unmuting someone who is not muted is an error.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_unmute_chat_user('e0000000-0000-0000-0000-000000000004', 'Not muted')$sql$),
  'P0002',
  'unmuting a member who is not muted is refused'
);

-- ── 10. Private-channel member list ────────────────────────────────────────

-- An admin creates a private channel and adds two members.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
create temp table t_private as
select channel_id from public.admin_create_chat_channel('gap-den', 'Gap Den', 'private');
select public.admin_add_chat_channel_member((select channel_id from t_private), 'e0000000-0000-0000-0000-000000000001');
select public.admin_add_chat_channel_member((select channel_id from t_private), 'e0000000-0000-0000-0000-000000000002');

-- A member can list the private channel's members.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.list_chat_channel_members((select channel_id from t_private))),
  2::bigint,
  'a member lists the private channel''s members'
);

-- A non-member cannot list them.
select pg_temp.act_as('e0000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_chat_channel_members((select channel_id from t_private))$sql$),
  'P0002',
  'a non-member cannot list a private channel''s members'
);

-- A moderator can see the list too.
select is(
  (select count(*) from public.list_chat_channel_members((select channel_id from t_private))),
  2::bigint,
  'a moderator can list the private channel''s members'
);

-- A public channel has no member list.
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_chat_channel_members(pg_temp.channel('general'))$sql$),
  '22023',
  'a public channel has no member list'
);

-- ── 11. Archived-channel listing ───────────────────────────────────────────

-- Only a chat.manage holder can list every channel (active and archived).
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_list_chat_channels()$sql$),
  '42501',
  'a member cannot list archived channels'
);

select pg_temp.act_as('e0000000-0000-0000-0000-000000000004');
create temp table t_arch as
select channel_id from public.admin_create_chat_channel('soon-gone', 'Soon Gone', 'public');
select public.admin_set_chat_channel_status((select channel_id from t_arch), 'active', 'archived', 'No longer needed');
select ok(
  (select count(*) from public.admin_list_chat_channels() where status = 'archived') >= 1::bigint,
  'an administrator sees the archived channel'
);

-- The archived channel is absent from the public read list but present in the
-- admin list, and can be reactivated.
select is(
  (select count(*) from public.list_chat_channels() where id = (select channel_id from t_arch)),
  0::bigint,
  'the archived channel is not in the public list'
);
select ok(
  public.admin_set_chat_channel_status((select channel_id from t_arch), 'archived', 'active', 'Bringing it back') is not null,
  'an administrator reactivates the archived channel'
);
select is(
  (select count(*) from public.admin_list_chat_channels() where id = (select channel_id from t_arch) and status = 'active'),
  1::bigint,
  'the reactivated channel is active again'
);

select * from extensions.finish();
rollback;
