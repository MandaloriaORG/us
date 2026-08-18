-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 — Holochat and notification contract gaps
--
-- Closes the documented DB-contract gaps of §2.12 for Holochat and
-- notifications. The two functions that are recreated (`send_chat_message`,
-- `moderation_set_report_status`) keep their exact argument list, return shape
-- and behaviour and only gain a side-effect in the same transaction, exactly as
-- 0017 recreated the actions that notify. Everything else here is new: enum
-- value, table, and RPCs.
--
-- In order:
--   5.  Codex proposals may take a chat message as their source.
--   6.  Sending a chat message enqueues `mention` notifications for @mentions.
--   7.  Resolving a report notifies the reporter (`report_resolved`).
--   8.  Posting an announcement fans out an `announcement` notification.
--   9.  Moderators can mute and unmute a chat member.
--   10. A private channel's members can be listed by those who can see it.
--   11. A council surface can list and reactivate archived channels.
--   12. (No new RPC: `outbox_list_failed`/`outbox_reprocess` already exist and
--       are surfaced by the /council/settings panel added alongside this file.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── New notification type for resolved reports ─────────────────────────────
--
-- The bell already renders every `notification_type`; a resolved report is a
-- distinct, actionable outcome (unlike a dismissal), so it gets its own type
-- rather than borrowing an unrelated one. The frontend vocabulary in
-- `src/lib/holochat/notifications.ts` is updated alongside this migration.

alter type public.notification_type add value if not exists 'report_resolved';

-- ── 9. Chat mutes ──────────────────────────────────────────────────────────
--
-- A mute is a moderation-imposed wall, distinct from a self-initiated block
-- (0016). It persists so the Council can see who is muted and why, and carries
-- an optional expiry so a temporary mute lifts itself. Only one active mute per
-- member is allowed (the unique partial index); unmuting removes it.

create table public.chat_mutes (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The moderator who applied it. Kept as `set null` rather than cascade: the
  -- mute is a record about the member and must survive the moderator's account
  -- being removed.
  muted_by uuid references public.profiles (id) on delete set null,
  reason text not null
    constraint chat_mutes_reason_length
    check (char_length(btrim(reason)) between 3 and 1000),
  -- Null means indefinite. A past expiry is an expired mute, not an active one.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_mutes_not_self check (user_id is distinct from muted_by)
);

create index chat_mutes_user_idx on public.chat_mutes (user_id, created_at desc);

-- At most one ACTIVE mute per user (indefinite or not-yet-expired), enforced by
-- trigger rather than a partial unique index: `expires_at > now()` is not
-- IMMUTABLE, so it cannot appear in an index predicate. Multiple fully-expired
-- rows per user stay allowed (an audit history), which a plain unique index on
-- user_id would forbid.
create or replace function private.chat_mutes_enforce_active_unique()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.chat_mutes
    where user_id = new.user_id
      and (expires_at is null or expires_at > now())
      and id is distinct from new.id
  ) then
    raise exception 'user already has an active chat mute (chat_mutes_active_unique)'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger chat_mutes_enforce_active_unique
  before insert or update of user_id, expires_at on public.chat_mutes
  for each row
  execute function private.chat_mutes_enforce_active_unique();

alter table public.chat_mutes enable row level security;

revoke all on table public.chat_mutes from public, anon, authenticated;
grant all on table public.chat_mutes to service_role;

-- True when the caller is under an active mute. Used by the write boundary.
create or replace function private.user_is_chat_muted(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_mutes
    where chat_mutes.user_id = p_user_id
      and (chat_mutes.expires_at is null or chat_mutes.expires_at > now())
  );
$$;

revoke all on function private.user_is_chat_muted(uuid) from public, anon, authenticated;

-- ── 5. Codex proposals from a chat message ─────────────────────────────────
--
-- `create_codex_proposal` (0015) accepts post, comment or external sources but
-- not a chat message, even though the source type exists. This complementary
-- function creates a proposal whose first source is a chat message, validating
-- the message through the same visibility rule the reader used so a proposal
-- cannot be built on a hidden or unreachable message. The existing overloads
-- are untouched; the distinct name avoids overload ambiguity.

create or replace function public.create_codex_proposal_from_chat(
  p_reason text,
  p_chat_message_id uuid,
  p_working_title text default null
)
returns table (proposal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_reason text := btrim(coalesce(p_reason, ''));
  v_clean_title text := nullif(btrim(coalesce(p_working_title, '')), '');
  v_proposal_id uuid;
begin
  v_actor_id := private.require_permission('codex.propose');

  if char_length(v_clean_reason) not between 20 and 2000 then
    raise exception using errcode = '22023', message = 'a reason must contain between 20 and 2000 characters';
  end if;

  if v_clean_title is not null and char_length(v_clean_title) not between 3 and 300 then
    raise exception using errcode = '22023', message = 'a working title must contain between 3 and 300 characters';
  end if;

  if p_chat_message_id is null or not private.chat_message_is_visible_to_caller(p_chat_message_id) then
    raise exception using errcode = 'P0002', message = 'source not found';
  end if;

  perform private.enforce_codex_proposal_rate_limit(v_actor_id);

  insert into public.codex_proposals (proposer_id, reason, working_title)
  values (v_actor_id, v_clean_reason, v_clean_title)
  returning codex_proposals.id into v_proposal_id;

  insert into public.codex_proposal_sources (
    proposal_id, source_type, chat_message_id, added_by
  )
  values (v_proposal_id, 'chat_message'::public.codex_source_type, p_chat_message_id, v_actor_id);

  return query select v_proposal_id;
end;
$$;

-- The source adder rejects `chat_message` (0015: "chat message sources arrive
-- with Holochat"), but 0017 never supplied the overload. This complementary
-- adder attaches a chat source to an open proposal, for the proposer or an
-- Archivist, exactly like the other branches of `add_codex_proposal_source`.

create or replace function public.add_chat_codex_proposal_source(
  p_proposal_id uuid,
  p_chat_message_id uuid,
  p_note text default null
)
returns table (source_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_proposal public.codex_proposals;
  v_clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_source_id uuid;
begin
  v_actor_id := private.require_active_actor();

  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id for update;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not (v_proposal.proposer_id = v_actor_id or private.caller_edits_codex()) then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not private.codex_proposal_is_open(v_proposal.status) then
    raise exception using errcode = '22023', message = 'proposal is not open to new sources';
  end if;

  if v_clean_note is not null and char_length(v_clean_note) > 500 then
    raise exception using errcode = '22023', message = 'note must not exceed 500 characters';
  end if;

  if p_chat_message_id is null or not private.chat_message_is_visible_to_caller(p_chat_message_id) then
    raise exception using errcode = 'P0002', message = 'source not found';
  end if;

  insert into public.codex_proposal_sources (proposal_id, source_type, chat_message_id, note, added_by)
  values (p_proposal_id, 'chat_message'::public.codex_source_type, p_chat_message_id, v_clean_note, v_actor_id)
  returning id into v_source_id;

  return query select v_source_id;
end;
$$;

-- ── 6. Mention producer ────────────────────────────────────────────────────
--
-- `send_chat_message` is recreated with identical arguments, return shape and
-- behaviour, and now also enforces the mute wall. After the message is written
-- it scans the body for `@display_name` mentions of active members and enqueues
-- a `mention` notification for each, in the same transaction, so a message is
-- never sent without its mention record. The author never notifies themselves;
-- a mention must be a whole word (preceded by start-of-line or whitespace) so
-- an email-like `x@name` is not a mention. Display names match
-- case-insensitively.

create or replace function public.send_chat_message(
  p_channel_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns table (message_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_channel public.chat_channels;
  v_parent public.chat_messages;
  v_clean_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
  v_mention public.profiles;
begin
  v_actor_id := private.require_permission('chat.send');

  -- A muted member cannot send or reply in chat until the mute expires or is
  -- lifted. The mute is a wall like a block, enforced at the write boundary.
  if private.user_is_chat_muted(v_actor_id) then
    raise exception using errcode = '42501', message = 'you are muted in chat';
  end if;

  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id;

  if v_channel.id is null or not private.chat_channel_is_visible_to_caller(v_channel.id) then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  if v_channel.status <> 'active' then
    raise exception using errcode = '42501', message = 'channel is archived';
  end if;

  -- The announcements channel is Council write-only.
  if v_channel.kind = 'announcements'
     and not private.user_has_permission(v_actor_id, 'chat.announce') then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if char_length(v_clean_body) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'a message must contain between 1 and 4000 characters';
  end if;

  if p_parent_id is not null then
    select * into v_parent from public.chat_messages where chat_messages.id = p_parent_id;

    if v_parent.id is null or v_parent.channel_id <> v_channel.id then
      raise exception using errcode = 'P0002', message = 'parent message not found';
    end if;

    -- A reply is a direct interaction: a block in either direction stops it.
    if private.users_are_blocked(v_actor_id, v_parent.author_id) then
      raise exception using errcode = '42501', message = 'cannot reply to this message';
    end if;
  end if;

  perform private.enforce_chat_rate_limit(v_actor_id);

  insert into public.chat_messages (channel_id, author_id, parent_id, body)
  values (v_channel.id, v_actor_id, p_parent_id, v_clean_body)
  returning chat_messages.id into v_message_id;

  if p_parent_id is not null then
    update public.chat_messages
    set replies_count = chat_messages.replies_count + 1
    where chat_messages.id = p_parent_id;
  end if;

  -- Mention fan-out. A whole-word `@display_name` of an active member other
  -- than the author produces one notification event per mention. Both the
  -- leading and trailing edges must be word boundaries, so `@Bob` does not
  -- match inside `x@Bob` or as a prefix of `@Bobby`.
  for v_mention in
    select profiles.*
    from public.profiles
    where profiles.status = 'active'
      and profiles.id <> v_actor_id
      and position(lower('@' || profiles.display_name) in lower(v_clean_body)) > 0
      and (
        position(lower('@' || profiles.display_name) in lower(v_clean_body)) = 1
        or substring(
             lower(v_clean_body)
             from position(lower('@' || profiles.display_name) in lower(v_clean_body)) - 1
             for 1
           ) ~ '[[:space:]]'
      )
      and (
        position(lower('@' || profiles.display_name) in lower(v_clean_body))
          + char_length('@' || profiles.display_name) > char_length(v_clean_body)
        or substring(
             lower(v_clean_body)
             from position(lower('@' || profiles.display_name) in lower(v_clean_body))
                  + char_length('@' || profiles.display_name)
             for 1
           ) ~ '[[:space:]]'
      )
  loop
    perform private.enqueue_notification(
      v_mention.id,
      'mention',
      v_actor_id,
      'mention:' || v_message_id || ':' || v_mention.id,
      jsonb_build_object('channel_id', v_channel.id, 'message_id', v_message_id)
    );
  end loop;

  return query select v_message_id;
end;
$$;

-- ── 7. Resolved-report notification ────────────────────────────────────────
--
-- `moderation_set_report_status` (0009) is recreated with identical arguments,
-- return shape and behaviour: it still claims, resolves or dismisses a report
-- with the same compare-and-swap and audit. When a report is closed as
-- `resolved` it now also enqueues a `report_resolved` notification to the
-- reporter in the same transaction, so a member is told their report was acted
-- on. `dismissed` deliberately does not notify: a dismissal is not a decision
-- the reporter can act on, and the reporter-triage signal is exactly what the
-- queue hides.

drop function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
);
create or replace function public.moderation_set_report_status(
  p_report_id uuid,
  p_expected_status public.report_status,
  p_status public.report_status,
  p_resolution text default null
)
returns table (report_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_report public.content_reports;
  v_clean_resolution text;
  v_closing boolean := p_status in ('resolved', 'dismissed');
begin
  v_actor_id := private.require_permission('moderation.hide');

  if v_closing then
    v_clean_resolution := private.validated_reason(p_resolution);
  elsif nullif(btrim(coalesce(p_resolution, '')), '') is not null then
    raise exception using
      errcode = '22023',
      message = 'a resolution belongs only to a resolved or dismissed report';
  end if;

  select * into v_report
  from public.content_reports
  where content_reports.id = p_report_id
  for update;

  if v_report.id is null then
    raise exception using errcode = 'P0002', message = 'report not found';
  end if;

  if v_report.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'report status changed since it was read';
  end if;

  if v_report.status = p_status then
    raise exception using errcode = '22023', message = 'report already has that status';
  end if;

  -- A closed report stays closed. Reopening would erase who decided what and
  -- when; the reporter files again instead, which leaves both records.
  if v_report.status in ('resolved', 'dismissed') then
    raise exception using errcode = '22023', message = 'a closed report cannot be reopened';
  end if;

  update public.content_reports
  set
    status = p_status,
    resolution = case when v_closing then v_clean_resolution else null end,
    resolved_by = case when v_closing then v_actor_id else null end,
    resolved_at = case when v_closing then now() else null end
  where content_reports.id = v_report.id;

  perform private.write_audit_log(
    v_actor_id,
    'report.status',
    'report',
    v_report.id,
    v_clean_resolution,
    jsonb_build_object('status', v_report.status),
    jsonb_build_object('status', p_status),
    jsonb_build_object(
      'target_type',
      case
        when v_report.post_id is not null then 'post'
        when v_report.comment_id is not null then 'comment'
        when v_report.chat_message_id is not null then 'chat_message'
        else 'profile'
      end,
      'target_id',
      coalesce(v_report.post_id, v_report.comment_id, v_report.chat_message_id, v_report.profile_id)
    )
  );

  -- A resolved report tells the reporter their claim was acted on.
  if p_status = 'resolved' then
    perform private.enqueue_notification(
      v_report.reporter_id,
      'report_resolved',
      v_actor_id,
      'report_resolved:' || v_report.id,
      jsonb_build_object('report_id', v_report.id)
    );
  end if;

  return query select v_report.id;
end;
$$;

-- ── 8. Announcement fan-out ────────────────────────────────────────────────
--
-- `post_chat_announcement` is recreated with identical arguments and return
-- shape. It keeps the `announcement` event (the durable record that the notice
-- was posted) and additionally fans out one `announcement` notification per
-- active member who can see the channel. Announcement channels are public, so
-- every active member is notified; this is the broadcast the bell expects.
-- Each recipient gets its own dedupe key, so a retried post cannot duplicate a
-- member's copy.

create or replace function public.post_chat_announcement(
  p_channel_id uuid,
  p_body text
)
returns table (message_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_channel public.chat_channels;
  v_message_id uuid;
  v_recipient uuid;
begin
  v_actor_id := private.require_permission('chat.announce');

  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id;

  if v_channel.id is null or v_channel.kind <> 'announcements' then
    raise exception using errcode = 'P0002', message = 'announcement channel not found';
  end if;

  insert into public.chat_messages (channel_id, author_id, body)
  values (p_channel_id, v_actor_id, btrim(p_body))
  returning chat_messages.id into v_message_id;

  -- A broadcast announcement has no single recipient; the event is the record
  -- that it was posted, and delivery is the app's job.
  perform private.enqueue_event(
    'announcement',
    jsonb_build_object('channel_id', p_channel_id, 'message_id', v_message_id, 'actor_id', v_actor_id),
    'chat_message',
    v_message_id,
    'announcement:' || v_message_id
  );

  -- Fan-out: one `announcement` notification per active member who can see the
  -- channel. Announcement channels are public, so that is every active member.
  for v_recipient in
    select profiles.id
    from public.profiles
    where profiles.status = 'active'
      and private.chat_channel_is_visible_to_caller(p_channel_id)
  loop
    perform private.enqueue_notification(
      v_recipient,
      'announcement',
      v_actor_id,
      'announcement:' || v_message_id || ':' || v_recipient,
      jsonb_build_object('channel_id', p_channel_id, 'message_id', v_message_id)
    );
  end loop;

  return query select v_message_id;
end;
$$;

-- ── 9. Moderator mute RPCs ─────────────────────────────────────────────────

-- Mute a member for an optional duration (minutes) or indefinitely. Only a
-- chat moderator may apply a mute, and only to a member they may act on. The
-- mute is written, audited, and the member is told in the same transaction.
create or replace function public.moderation_mute_chat_user(
  p_user_id uuid,
  p_reason text,
  p_duration_minutes integer default null
)
returns table (mute_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_reason text;
  v_expires_at timestamptz;
  v_mute_id uuid;
begin
  v_actor_id := private.require_permission('chat.moderate');
  v_clean_reason := private.validated_reason(p_reason);

  if p_user_id = v_actor_id then
    raise exception using errcode = '22023', message = 'cannot mute yourself';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_user_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  perform private.require_unprotected_target(v_actor_id, p_user_id);

  if p_duration_minutes is not null then
    if p_duration_minutes < 1 or p_duration_minutes > 525600 then
      raise exception using errcode = '22023', message = 'a mute duration must be between 1 minute and one year';
    end if;
    v_expires_at := now() + (p_duration_minutes * interval '1 minute');
  end if;

  -- Re-muting an already-muted member replaces their mute, so a moderator can
  -- extend or shorten without first unmuting. An explicit update-then-insert
  -- avoids relying on partial-index ON CONFLICT inference.
  update public.chat_mutes
  set reason = v_clean_reason,
      expires_at = v_expires_at,
      muted_by = v_actor_id
  where chat_mutes.user_id = p_user_id
    and (chat_mutes.expires_at is null or chat_mutes.expires_at > now());

  if found then
    select chat_mutes.id into v_mute_id
    from public.chat_mutes
    where chat_mutes.user_id = p_user_id
      and (chat_mutes.expires_at is null or chat_mutes.expires_at > now());
  else
    insert into public.chat_mutes (user_id, muted_by, reason, expires_at)
    values (p_user_id, v_actor_id, v_clean_reason, v_expires_at)
    returning chat_mutes.id into v_mute_id;
  end if;

  perform private.write_audit_log(
    v_actor_id,
    'chat_user.mute',
    'user',
    p_user_id,
    v_clean_reason,
    null,
    jsonb_build_object('expires_at', v_expires_at)
  );

  perform private.enqueue_notification(
    p_user_id,
    'warning',
    v_actor_id,
    'chat_mute:' || v_mute_id,
    jsonb_build_object('mute_id', v_mute_id, 'expires_at', v_expires_at)
  );

  return query select v_mute_id, v_expires_at;
end;
$$;

-- Lift an active mute. Only a chat moderator may; the reason is audited.
create or replace function public.moderation_unmute_chat_user(
  p_user_id uuid,
  p_reason text
)
returns table (mute_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_reason text;
  v_mute_id uuid;
begin
  v_actor_id := private.require_permission('chat.moderate');
  v_clean_reason := private.validated_reason(p_reason);

  select chat_mutes.id into v_mute_id
  from public.chat_mutes
  where chat_mutes.user_id = p_user_id
    and (chat_mutes.expires_at is null or chat_mutes.expires_at > now())
  for update;

  if v_mute_id is null then
    raise exception using errcode = 'P0002', message = 'member is not muted';
  end if;

  delete from public.chat_mutes where chat_mutes.id = v_mute_id;

  perform private.write_audit_log(
    v_actor_id,
    'chat_user.unmute',
    'user',
    p_user_id,
    v_clean_reason,
    null,
    null
  );

  return query select v_mute_id;
end;
$$;

-- ── 10. Private-channel member list ────────────────────────────────────────

-- Lists the members of a private channel to anyone who can see it (a member or
-- a chat moderator), for the /holochat/[slug] management surface. The channel
-- visibility check is the same one the reads use, so the list leaks nothing to
-- a non-member; a non-private channel has no member list.
create or replace function public.list_chat_channel_members(p_channel_id uuid)
returns table (
  member_id uuid,
  display_name text,
  added_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 500
as $$
declare
  v_channel public.chat_channels;
begin
  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id;

  -- A member can see the channel's own list; a chat moderator may too, so the
  -- Council can manage a private channel without being added to it.
  if v_channel.id is null
     or not (
       private.chat_channel_is_visible_to_caller(v_channel.id)
       or private.caller_moderates_chat()
     )
  then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  if v_channel.kind <> 'private' then
    raise exception using errcode = '22023', message = 'only private channels have a member list';
  end if;

  return query
  select members.member_id, profile.display_name, members.created_at
  from public.chat_channel_members members
  join public.profiles profile on profile.id = members.member_id
  where members.channel_id = p_channel_id
  order by profile.display_name;
end;
$$;

-- ── 11. Archived-channel listing ───────────────────────────────────────────

-- The council surface behind archived-channel reactivation. `list_chat_channels`
-- (0017) returns only visible, active channels; this one is for the manager and
-- lists every channel, active or archived, to a `chat.manage` holder.
create or replace function public.admin_list_chat_channels()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  kind public.chat_channel_kind,
  status public.chat_channel_status,
  clan_id uuid,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = ''
rows 500
as $$
begin
  perform private.require_permission('chat.manage');

  return query
  select
    chat_channels.id,
    chat_channels.slug,
    chat_channels.name,
    chat_channels.description,
    chat_channels.kind,
    chat_channels.status,
    chat_channels.clan_id,
    chat_channels.sort_order
  from public.chat_channels
  order by chat_channels.status, chat_channels.sort_order, chat_channels.name;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.create_codex_proposal_from_chat(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.add_chat_codex_proposal_source(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.send_chat_message(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
) from public, anon, authenticated;
revoke all on function public.post_chat_announcement(uuid, text)
  from public, anon, authenticated;
revoke all on function public.moderation_mute_chat_user(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.moderation_unmute_chat_user(uuid, text)
  from public, anon, authenticated;
revoke all on function public.list_chat_channel_members(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_list_chat_channels()
  from public, anon, authenticated;

-- Proposing from a chat message and adding a chat source follow the Codex flow.
grant execute on function public.create_codex_proposal_from_chat(text, uuid, text)
  to authenticated;
grant execute on function public.add_chat_codex_proposal_source(uuid, uuid, text)
  to authenticated;

-- Members keep talking (the recreated send keeps its grant); the member list
-- and the moderation surfaces are permission-checked inside the RPCs.
grant execute on function public.send_chat_message(uuid, text, uuid) to authenticated;
grant execute on function public.list_chat_channel_members(uuid) to authenticated;
grant execute on function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
) to authenticated;
grant execute on function public.post_chat_announcement(uuid, text) to authenticated;
grant execute on function public.moderation_mute_chat_user(uuid, text, integer)
  to authenticated;
grant execute on function public.moderation_unmute_chat_user(uuid, text) to authenticated;
grant execute on function public.admin_list_chat_channels() to authenticated;

comment on function public.create_codex_proposal_from_chat(text, uuid, text) is
  'Create a Codex proposal whose first source is a chat message, validated against the caller''s visibility.';
comment on function public.add_chat_codex_proposal_source(uuid, uuid, text) is
  'Attach a chat message source to an open proposal, for the proposer or an Archivist.';
comment on function public.send_chat_message(uuid, text, uuid) is
  'Send a chat message, enforcing the mute wall and enqueueing mention notifications for @display_name mentions.';
comment on function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
) is
  'Claim, resolve or dismiss a report. Compare-and-swap on status; resolving notifies the reporter.';
comment on function public.post_chat_announcement(uuid, text) is
  'Post to an announcement channel, recording the event and fanning out an announcement notification to every active member.';
comment on function public.moderation_mute_chat_user(uuid, text, integer) is
  'Mute a chat member for a duration in minutes or indefinitely, with a reason, audited.';
comment on function public.moderation_unmute_chat_user(uuid, text) is
  'Lift an active chat mute, audited.';
comment on function public.list_chat_channel_members(uuid) is
  'List a private channel''s members to anyone who can see the channel.';
comment on function public.admin_list_chat_channels() is
  'List every channel (active and archived) to a chat.manage holder, for archived-channel reactivation.';
