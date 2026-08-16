-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — Holochat and notifications
--
-- Live conversation and reliable side effects. Two systems in one file.
--
-- **Holochat** is a set of channels with a message ledger. Every channel is
-- public, announcements, a clan's own space, or private. Messages are soft-state:
-- a hidden or deleted message keeps its row so reports keep their evidence, and
-- an edited message keeps its previous wording in `chat_message_edits` so a
-- report answered after the edit still shows what was reported. Chat reports go
-- into the existing `content_reports` queue: the table gains a `chat_message_id`
-- target and the queue RPCs learn to resolve it.
--
-- **Notifications** go through a transactional outbox. The action and its event
-- are written in one transaction, so content that was created is never lost to a
-- notification failure. The consumer is idempotent twice over: a unique
-- `dedupe_key` on the outbox stops duplicate events at the producer, and the
-- same key on `notifications` stops a crash between materialization and
-- acknowledgement from duplicating the row. Events carry ids, never bodies.
--
-- Blocks are a wall for chat too: replying to a message or reacting to one is a
-- direct interaction and is refused when either side blocks the other.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Permissions ─────────────────────────────────────────────────────────────

insert into public.permissions (name, description)
values
  ('chat.send', 'Send, edit, delete and react to Holochat messages'),
  ('chat.moderate', 'Hide, restore, delete and pin any Holochat message'),
  ('chat.manage', 'Create, edit and archive chat channels and configure access'),
  ('chat.announce', 'Post to announcement channels')
on conflict (name) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.name = 'chat.send'
where roles.name = 'User'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.name = 'chat.moderate'
where roles.name in ('Moderator', 'Guardian')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.name in ('chat.manage', 'chat.announce')
where roles.name = 'Administrator'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.name = 'chat.announce'
where roles.name in ('Moderator', 'Guardian')
on conflict (role_id, permission_id) do nothing;

-- ── Enums ──────────────────────────────────────────────────────────────────

create type public.chat_channel_kind as enum ('public', 'announcements', 'clan', 'private');

create type public.chat_channel_status as enum ('active', 'archived');

-- `deleted` is the soft removal that keeps report evidence; the read RPCs blank
-- the body of a deleted message.
create type public.chat_message_status as enum ('visible', 'hidden', 'deleted');

create type public.outbox_status as enum ('pending', 'delivered', 'failed');

create type public.notification_type as enum (
  'post_reply',
  'comment_reply',
  'reaction',
  'mention',
  'friend_request',
  'clan_invite',
  'warning',
  'announcement'
);

-- ── Channels ────────────────────────────────────────────────────────────────

create table public.chat_channels (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint chat_channels_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  name text not null
    constraint chat_channels_name_length check (char_length(btrim(name)) between 2 and 60),
  description text
    constraint chat_channels_description_length
    check (description is null or char_length(description) <= 500),
  kind public.chat_channel_kind not null default 'public',
  status public.chat_channel_status not null default 'active',
  -- Clan channels hang off their clan; a private channel hangs off nothing and
  -- grants access through `chat_channel_members`.
  clan_id uuid references public.clans (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_channels_clan_kind_matches check (
    (kind = 'clan') = (clan_id is not null)
  )
);

-- Clan channels carry a sort position so the canonical nine stay in their
-- intended order; it is not part of the enum, so add the column before the
-- listing index that uses it.
alter table public.chat_channels
  add column sort_order integer not null default 0;

create index chat_channels_listing_idx on public.chat_channels (status, kind, sort_order, name);

create trigger chat_channels_set_updated_at
  before update on public.chat_channels
  for each row execute function public.update_updated_at();

-- Access to private channels only.
create table public.chat_channel_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (channel_id, member_id)
);

create index chat_channel_members_member_idx
  on public.chat_channel_members (member_id, channel_id);

-- ── Messages ────────────────────────────────────────────────────────────────

create table public.chat_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.chat_messages (id) on delete set null,
  body text not null
    constraint chat_messages_body_length check (char_length(btrim(body)) between 1 and 4000),
  status public.chat_message_status not null default 'visible',
  is_pinned boolean not null default false,
  edited_at timestamptz,
  replies_count integer not null default 0 check (replies_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- A reply staying in its parent's channel is enforced by send_chat_message,
  -- which resolves the parent against the target channel; a check constraint
  -- cannot hold a subquery.
);

create index chat_messages_channel_idx
  on public.chat_messages (channel_id, created_at desc, id desc);
create index chat_messages_parent_idx
  on public.chat_messages (parent_id, created_at, id) where parent_id is not null;
create index chat_messages_author_idx
  on public.chat_messages (author_id, created_at desc);
create index chat_messages_pinned_idx
  on public.chat_messages (channel_id, created_at desc) where is_pinned;

-- Previous wording of an edited message, bounded so a chat's history cannot be
-- an archive. This is what answers a report filed before an edit.
create table public.chat_message_edits (
  id uuid primary key default extensions.uuid_generate_v4(),
  seq bigint generated always as identity,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  editor_id uuid references public.profiles (id) on delete set null,
  old_body text not null
    constraint chat_message_edits_body_length
    check (char_length(old_body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create unique index chat_message_edits_seq_idx on public.chat_message_edits (seq);
create index chat_message_edits_message_idx
  on public.chat_message_edits (message_id, seq desc);

create trigger chat_messages_set_updated_at
  before update on public.chat_messages
  for each row execute function public.update_updated_at();

-- ── Reactions ───────────────────────────────────────────────────────────────

create table public.chat_reactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  reaction_id uuid not null references public.reactions (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (actor_id, message_id, reaction_id)
);

create index chat_reactions_message_idx
  on public.chat_reactions (message_id, reaction_id);

-- ── The outbox ──────────────────────────────────────────────────────────────

create table public.event_outbox (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_type text not null
    constraint event_outbox_type_format
    check (event_type ~ '^[a-z0-9]+(\.[a-z0-9]+)*$' and char_length(event_type) between 3 and 60),
  aggregate_type text
    constraint event_outbox_aggregate_format
    check (aggregate_type is null or char_length(aggregate_type) between 2 and 60),
  aggregate_id uuid,
  -- Ids and metadata only, never bodies: the event is the fact that something
  -- happened, not a copy of what happened.
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  -- The logical event. Two rows with the same key are the same event twice.
  dedupe_key text,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  last_error text
    constraint event_outbox_error_length
    check (last_error is null or char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Non-partial so `on conflict (dedupe_key)` matches it: NULL dedupe keys are
-- already distinct in a plain unique index, so a partial predicate is not
-- needed and would break the conflict target.
create unique index event_outbox_dedupe_idx
  on public.event_outbox (dedupe_key);

create index event_outbox_ready_idx
  on public.event_outbox (status, next_attempt_at, created_at)
  where status = 'pending';
create index event_outbox_failed_idx
  on public.event_outbox (status, created_at desc)
  where status = 'failed';

create trigger event_outbox_set_updated_at
  before update on public.event_outbox
  for each row execute function public.update_updated_at();

-- ── Notifications ───────────────────────────────────────────────────────────

create table public.notifications (
  id uuid primary key default extensions.uuid_generate_v4(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- The logical event that produced this row, so a retried delivery cannot
  -- create a duplicate.
  dedupe_key text
);

create unique index notifications_dedupe_idx
  on public.notifications (dedupe_key);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- A jsonb map of notification_type -> boolean. Only keys that name a type are
  -- accepted, so the shape is closed.
  types jsonb not null default '{}'::jsonb
    check (jsonb_typeof(types) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.update_updated_at();

-- ── Chat reports reach the existing queue ──────────────────────────────────

alter table public.content_reports
  add column chat_message_id uuid,
  drop constraint content_reports_single_target,
  add constraint content_reports_single_target check (
    (post_id is not null)::integer
      + (comment_id is not null)::integer
      + (profile_id is not null)::integer
      + (chat_message_id is not null)::integer = 1
  ),
  add constraint content_reports_chat_message_fkey
    foreign key (chat_message_id) references public.chat_messages (id) on delete cascade;

create index content_reports_chat_idx
  on public.content_reports (chat_message_id) where chat_message_id is not null;

create unique index content_reports_one_open_per_chat_idx
  on public.content_reports (reporter_id, chat_message_id)
  where chat_message_id is not null and status in ('open', 'under_review');

-- ── Deny-by-default exposure ────────────────────────────────────────────────

alter table public.chat_channels enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_edits enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.event_outbox enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on table public.chat_channels from public, anon, authenticated;
revoke all on table public.chat_channel_members from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;
revoke all on table public.chat_message_edits from public, anon, authenticated;
revoke all on table public.chat_reactions from public, anon, authenticated;
revoke all on table public.event_outbox from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.notification_preferences from public, anon, authenticated;

grant all on table public.chat_channels to service_role;
grant all on table public.chat_channel_members to service_role;
grant all on table public.chat_messages to service_role;
grant all on table public.chat_message_edits to service_role;
grant all on table public.chat_reactions to service_role;
grant all on table public.event_outbox to service_role;
grant all on table public.notifications to service_role;
grant all on table public.notification_preferences to service_role;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- A channel is visible when it is active and its kind admits the caller:
-- public and announcements for everyone; clan channels for active clan members
-- (and those who may intervene in the clan); private channels for their members.
create or replace function private.chat_channel_is_visible_to_caller(p_channel_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_channel public.chat_channels;
  v_actor_id uuid := auth.uid();
begin
  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id;

  if v_channel.id is null or v_channel.status <> 'active' then
    return false;
  end if;

  if v_channel.kind in ('public', 'announcements') then
    return true;
  end if;

  if v_actor_id is null then
    return false;
  end if;

  if v_channel.kind = 'clan' then
    return exists (
      select 1
      from public.clan_members
      where clan_members.clan_id = v_channel.clan_id
        and clan_members.member_id = v_actor_id
        and clan_members.status = 'active'
    )
    or private.user_has_permission(v_actor_id, 'admin.manage_clans');
  end if;

  return exists (
    select 1
    from public.chat_channel_members
    where chat_channel_members.channel_id = p_channel_id
      and chat_channel_members.member_id = v_actor_id
  );
end;
$$;

create or replace function private.chat_message_is_visible_to_caller(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_messages
    where chat_messages.id = p_message_id
      and chat_messages.status = 'visible'
      and private.chat_channel_is_visible_to_caller(chat_messages.channel_id)
  );
$$;

create or replace function private.caller_moderates_chat()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.user_has_permission(auth.uid(), 'chat.moderate');
$$;

-- Counted from the messages themselves, like every other limit in this schema.
create or replace function private.enforce_chat_rate_limit(p_author_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.chat_messages
  where chat_messages.author_id = p_author_id
    and chat_messages.created_at > now() - interval '1 hour';

  if recent_count >= 120 then
    raise exception using
      errcode = '53400',
      message = 'chat rate limit reached, try again later';
  end if;
end;
$$;

-- The one writer of the outbox, called from inside the transaction that owns the
-- action. Duplicate logical events collapse onto the dedupe index.
create or replace function private.enqueue_event(
  p_event_type text,
  p_payload jsonb,
  p_aggregate_type text default null,
  p_aggregate_id uuid default null,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  insert into public.event_outbox (
    event_type, aggregate_type, aggregate_id, payload, dedupe_key
  )
  values (
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    coalesce(p_payload, '{}'::jsonb),
    p_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning event_outbox.id into v_event_id;

  return v_event_id;
end;
$$;

-- Builds and enqueues a notification event in one call, keeping the payload
-- to ids and a dedupe key.
create or replace function private.enqueue_notification(
  p_recipient_id uuid,
  p_type public.notification_type,
  p_actor_id uuid,
  p_dedupe_key text,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if p_recipient_id = p_actor_id then
    return null;
  end if;

  if p_recipient_id is null then
    return null;
  end if;

  v_payload := jsonb_build_object(
    'recipient_id', p_recipient_id,
    'type', p_type::text,
    'actor_id', p_actor_id,
    'dedupe_key', p_dedupe_key
  ) || coalesce(p_context, '{}'::jsonb);

  return private.enqueue_event(
    'notification',
    v_payload,
    'notification',
    null,
    p_dedupe_key
  );
end;
$$;

revoke all on function private.chat_channel_is_visible_to_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.chat_message_is_visible_to_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.caller_moderates_chat()
  from public, anon, authenticated;
revoke all on function private.enforce_chat_rate_limit(uuid)
  from public, anon, authenticated;
revoke all on function private.enqueue_event(text, jsonb, text, uuid, text)
  from public, anon, authenticated;
revoke all on function private.enqueue_notification(
  uuid, public.notification_type, uuid, text, jsonb
) from public, anon, authenticated;

-- ── Channel reads ──────────────────────────────────────────────────────────

create or replace function public.list_chat_channels()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  kind public.chat_channel_kind,
  clan_id uuid,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
begin
  return query
  select
    chat_channels.id,
    chat_channels.slug,
    chat_channels.name,
    chat_channels.description,
    chat_channels.kind,
    chat_channels.clan_id,
    chat_channels.sort_order
  from public.chat_channels
  where private.chat_channel_is_visible_to_caller(chat_channels.id)
  order by chat_channels.sort_order, chat_channels.name;
end;
$$;

create or replace function public.get_chat_channel(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  kind public.chat_channel_kind,
  status public.chat_channel_status,
  clan_id uuid,
  can_send boolean,
  can_announce boolean
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_channel public.chat_channels;
  v_actor_id uuid := auth.uid();
begin
  select * into v_channel from public.chat_channels where chat_channels.slug = p_slug;

  if v_channel.id is null or not private.chat_channel_is_visible_to_caller(v_channel.id) then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  return query
  select
    v_channel.id,
    v_channel.slug,
    v_channel.name,
    v_channel.description,
    v_channel.kind,
    v_channel.status,
    v_channel.clan_id,
    v_actor_id is not null and (
      v_channel.kind <> 'announcements'
      or private.user_has_permission(v_actor_id, 'chat.announce')
    ),
    v_actor_id is not null and private.user_has_permission(v_actor_id, 'chat.announce')
  ;
end;
$$;

-- ── Message reads ──────────────────────────────────────────────────────────

create or replace function public.list_chat_messages(
  p_channel_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50,
  p_pinned_only boolean default false
)
returns table (
  id uuid,
  parent_id uuid,
  author_id uuid,
  author_display_name text,
  body text,
  status public.chat_message_status,
  is_pinned boolean,
  replies_count integer,
  edited_at timestamptz,
  reaction_counts jsonb,
  caller_reacted jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_actor_id uuid := auth.uid();
  v_moderates boolean := private.caller_moderates_chat();
begin
  if not private.chat_channel_is_visible_to_caller(p_channel_id) then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  return query
  select
    messages.id,
    messages.parent_id,
    case
      when messages.status = 'deleted' then null
      else messages.author_id
    end,
    case
      when messages.status = 'deleted' then null
      else author.display_name
    end,
    case
      when messages.status = 'visible' or v_moderates then messages.body
      when messages.status = 'deleted' then null
      else null
    end,
    messages.status,
    messages.is_pinned,
    messages.replies_count,
    messages.edited_at,
    coalesce(
      (
        select jsonb_object_agg(react.key, counts.total)
        from (
          select chat_reactions.reaction_id, count(*)::integer as total
          from public.chat_reactions
          where chat_reactions.message_id = messages.id
          group by chat_reactions.reaction_id
        ) counts
        join public.reactions react on react.id = counts.reaction_id
      ),
      '{}'::jsonb
    ),
    coalesce(
      (
        select jsonb_object_agg(react.key, true)
        from public.chat_reactions
        join public.reactions react on react.id = chat_reactions.reaction_id
        where chat_reactions.message_id = messages.id
          and chat_reactions.actor_id = v_actor_id
      ),
      '{}'::jsonb
    ),
    messages.created_at
  from public.chat_messages messages
  join public.profiles author on author.id = messages.author_id
  where messages.channel_id = p_channel_id
    and (
      messages.status <> 'hidden'
      or v_moderates
    )
    and (not coalesce(p_pinned_only, false) or messages.is_pinned)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (messages.created_at, messages.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by messages.created_at desc, messages.id desc
  limit v_limit;
end;
$$;

create or replace function public.list_chat_message_edits(
  p_message_id uuid,
  p_limit integer default 20
)
returns table (
  edit_id uuid,
  old_body text,
  editor_display_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 50
as $$
declare
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_moderates boolean := private.caller_moderates_chat();
  v_is_author boolean;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  -- Edit history can hold wording the author has since removed, so it is for
  -- the author and for chat moderators only, exactly like content revisions.
  select exists (
    select 1
    from public.chat_messages
    where chat_messages.id = p_message_id
      and chat_messages.author_id = v_actor_id
  ) into v_is_author;

  if not (v_moderates or v_is_author) then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  return query
  select edits.id, edits.old_body, editor.display_name, edits.created_at
  from public.chat_message_edits edits
  left join public.profiles editor on editor.id = edits.editor_id
  where edits.message_id = p_message_id
  order by edits.seq desc
  limit v_limit;
end;
$$;

-- ── Message writes ─────────────────────────────────────────────────────────

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
begin
  v_actor_id := private.require_permission('chat.send');

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

  return query select v_message_id;
end;
$$;

-- Editing keeps the previous wording in `chat_message_edits`, so a report filed
-- before the edit can still be answered with what was actually reported.
create or replace function public.update_own_chat_message(
  p_message_id uuid,
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
  v_message public.chat_messages;
  v_clean_body text := btrim(coalesce(p_body, ''));
begin
  v_actor_id := private.require_permission('chat.send');

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id for update;

  if v_message.id is null or v_message.author_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  if v_message.status <> 'visible' then
    raise exception using errcode = '42501', message = 'message cannot be edited in its current state';
  end if;

  if char_length(v_clean_body) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'a message must contain between 1 and 4000 characters';
  end if;

  if v_clean_body is distinct from v_message.body then
    insert into public.chat_message_edits (message_id, editor_id, old_body)
    values (p_message_id, v_actor_id, v_message.body);

    update public.chat_messages
    set body = v_clean_body,
        edited_at = now()
    where chat_messages.id = p_message_id;
  end if;

  return query select v_message.id;
end;
$$;

-- Soft delete: the row and its evidence survive, the body goes blank in reads.
create or replace function public.delete_own_chat_message(p_message_id uuid)
returns table (message_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_message public.chat_messages;
begin
  v_actor_id := private.require_permission('chat.send');

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id for update;

  if v_message.id is null or v_message.author_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  if v_message.status = 'deleted' then
    raise exception using errcode = '22023', message = 'message is already deleted';
  end if;

  update public.chat_messages
  set status = 'deleted'
  where chat_messages.id = p_message_id;

  return query select v_message.id;
end;
$$;

-- ── Reactions ───────────────────────────────────────────────────────────────

create or replace function public.toggle_chat_reaction(
  p_message_id uuid,
  p_reaction_key text
)
returns table (reaction_key text, total integer, caller_reacted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_reaction public.reactions;
  v_message public.chat_messages;
  v_removed boolean := false;
begin
  v_actor_id := private.require_permission('chat.send');

  select * into v_reaction
  from public.reactions
  where reactions.key = p_reaction_key
    and reactions.is_active;

  if v_reaction.id is null then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id;

  if v_message.id is null or not private.chat_message_is_visible_to_caller(v_message.id) then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  -- Reacting is a direct interaction with the author.
  if private.users_are_blocked(v_actor_id, v_message.author_id) then
    raise exception using errcode = '42501', message = 'cannot react to this message';
  end if;

  delete from public.chat_reactions
  where chat_reactions.actor_id = v_actor_id
    and chat_reactions.message_id = p_message_id
    and chat_reactions.reaction_id = v_reaction.id;

  v_removed := found;

  if not v_removed then
    insert into public.chat_reactions (reaction_id, message_id, actor_id)
    values (v_reaction.id, p_message_id, v_actor_id);
  end if;

  return query
  select
    v_reaction.key,
    (
      select count(*)::integer
      from public.chat_reactions
      where chat_reactions.message_id = p_message_id
        and chat_reactions.reaction_id = v_reaction.id
    ),
    not v_removed;
end;
$$;

-- ── Reporting a chat message ────────────────────────────────────────────────

create or replace function public.report_chat_message(
  p_message_id uuid,
  p_reason public.report_reason,
  p_details text default null
)
returns table (report_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_message public.chat_messages;
  v_clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_new_report_id uuid;
begin
  v_actor_id := private.require_permission('report.create');

  if v_clean_details is not null and char_length(v_clean_details) > 1000 then
    raise exception using errcode = '22023', message = 'details must contain at most 1000 characters';
  end if;

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id;

  -- An invisible message is reported as missing, not as forbidden, so the id
  -- cannot be used to probe hidden channels.
  if v_message.id is null or not private.chat_message_is_visible_to_caller(v_message.id) then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  if v_message.author_id = v_actor_id then
    raise exception using errcode = '22023', message = 'cannot report your own message';
  end if;

  perform private.enforce_report_rate_limit(v_actor_id);

  insert into public.content_reports (reporter_id, chat_message_id, reason, details)
  values (v_actor_id, p_message_id, p_reason, v_clean_details)
  returning content_reports.id into v_new_report_id;

  return query select v_new_report_id;
end;
$$;

-- ── Chat moderation ─────────────────────────────────────────────────────────

create or replace function public.moderation_set_chat_message_status(
  p_message_id uuid,
  p_expected_status public.chat_message_status,
  p_status public.chat_message_status,
  p_reason text
)
returns table (message_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_message public.chat_messages;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('chat.moderate');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id for update;

  if v_message.id is null then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  if v_message.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'message changed since it was read';
  end if;

  if v_message.status = p_status then
    raise exception using errcode = '22023', message = 'message already has that status';
  end if;

  if p_status not in ('visible', 'hidden', 'deleted') then
    raise exception using errcode = '22023', message = 'invalid destination status';
  end if;

  -- A deleted message stays deleted; restoring it would resurrect content the
  -- moderator removed. Hiding is the reversible step.
  if v_message.status = 'deleted' and p_status <> 'deleted' then
    raise exception using errcode = '22023', message = 'a deleted message cannot be restored';
  end if;

  update public.chat_messages
  set status = p_status
  where chat_messages.id = p_message_id;

  perform private.write_audit_log(
    v_actor_id,
    'chat_message.' || p_status::text,
    'chat_message',
    v_message.id,
    v_clean_reason,
    jsonb_build_object('status', v_message.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_message.id;
end;
$$;

create or replace function public.moderation_toggle_chat_message_pin(
  p_message_id uuid,
  p_expected_pinned boolean,
  p_is_pinned boolean
)
returns table (message_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_message public.chat_messages;
begin
  v_actor_id := private.require_permission('chat.moderate');

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id for update;

  if v_message.id is null then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  if v_message.is_pinned is distinct from p_expected_pinned then
    raise exception using errcode = '40001', message = 'message changed since it was read';
  end if;

  if v_message.is_pinned is not distinct from p_is_pinned then
    raise exception using errcode = '22023', message = 'message already has that pin state';
  end if;

  update public.chat_messages
  set is_pinned = p_is_pinned
  where chat_messages.id = p_message_id;

  return query select v_message.id;
end;
$$;

-- ── Channel administration ──────────────────────────────────────────────────

create or replace function public.admin_create_chat_channel(
  p_slug text,
  p_name text,
  p_kind public.chat_channel_kind default 'public',
  p_description text default null,
  p_clan_id uuid default null,
  p_sort_order integer default 0
)
returns table (channel_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_slug text := lower(btrim(coalesce(p_slug, '')));
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_channel_id uuid;
begin
  v_actor_id := private.require_permission('chat.manage');

  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(v_clean_name) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 60 characters';
  end if;

  if coalesce(p_kind, 'public') = 'clan' and p_clan_id is null then
    raise exception using errcode = '22023', message = 'a clan channel needs a clan';
  end if;

  insert into public.chat_channels (
    slug, name, description, kind, clan_id, sort_order, created_by
  )
  values (
    v_clean_slug, v_clean_name, nullif(btrim(p_description), ''),
    coalesce(p_kind, 'public'), p_clan_id, coalesce(p_sort_order, 0), v_actor_id
  )
  returning chat_channels.id into v_channel_id;

  perform private.write_audit_log(
    v_actor_id,
    'chat_channel.create',
    'chat_channel',
    v_channel_id,
    null,
    null,
    jsonb_build_object('slug', v_clean_slug, 'kind', p_kind)
  );

  return query select v_channel_id;
end;
$$;

create or replace function public.admin_update_chat_channel(
  p_channel_id uuid,
  p_name text,
  p_description text,
  p_sort_order integer
)
returns table (channel_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_channel public.chat_channels;
  v_clean_name text := btrim(coalesce(p_name, ''));
begin
  v_actor_id := private.require_permission('chat.manage');

  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id for update;

  if v_channel.id is null then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  if char_length(v_clean_name) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 60 characters';
  end if;

  update public.chat_channels
  set name = v_clean_name,
      description = nullif(btrim(p_description), ''),
      sort_order = coalesce(p_sort_order, v_channel.sort_order)
  where chat_channels.id = v_channel.id;

  perform private.write_audit_log(
    v_actor_id,
    'chat_channel.update',
    'chat_channel',
    v_channel.id,
    null,
    jsonb_build_object('name', v_channel.name),
    jsonb_build_object('name', v_clean_name)
  );

  return query select v_channel.id;
end;
$$;

create or replace function public.admin_set_chat_channel_status(
  p_channel_id uuid,
  p_expected_status public.chat_channel_status,
  p_status public.chat_channel_status,
  p_reason text
)
returns table (channel_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_channel public.chat_channels;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('chat.manage');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id for update;

  if v_channel.id is null then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  if v_channel.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'channel changed since it was read';
  end if;

  if v_channel.status = p_status then
    raise exception using errcode = '22023', message = 'channel already has that status';
  end if;

  update public.chat_channels set status = p_status where chat_channels.id = v_channel.id;

  perform private.write_audit_log(
    v_actor_id,
    'chat_channel.status',
    'chat_channel',
    v_channel.id,
    v_clean_reason,
    jsonb_build_object('status', v_channel.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_channel.id;
end;
$$;

create or replace function public.admin_add_chat_channel_member(
  p_channel_id uuid,
  p_member_id uuid,
  p_remove boolean default false
)
returns table (channel_member_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_channel public.chat_channels;
  v_member_row_id uuid;
begin
  v_actor_id := private.require_permission('chat.manage');

  select * into v_channel from public.chat_channels where chat_channels.id = p_channel_id;

  if v_channel.id is null then
    raise exception using errcode = 'P0002', message = 'channel not found';
  end if;

  if v_channel.kind <> 'private' then
    raise exception using errcode = '22023', message = 'only private channels have a member list';
  end if;

  if coalesce(p_remove, false) then
    delete from public.chat_channel_members
    where chat_channel_members.channel_id = p_channel_id
      and chat_channel_members.member_id = p_member_id;
    return query select null::uuid;
    return;
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_member_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  insert into public.chat_channel_members (channel_id, member_id, added_by)
  values (p_channel_id, p_member_id, v_actor_id)
  on conflict (channel_id, member_id) do nothing
  returning chat_channel_members.id into v_member_row_id;

  if v_member_row_id is null then
    raise exception using errcode = '22023', message = 'member already has access';
  end if;

  return query select v_member_row_id;
end;
$$;

-- ── Announcements ───────────────────────────────────────────────────────────

-- Posts to an announcement channel and enqueues an announcement event, so the
-- fact is not lost even if the notification fan-out is offline.
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

  return query select v_message_id;
end;
$$;

-- ── Outbox consumption ──────────────────────────────────────────────────────

-- The consumer. Locks the event, refuses to process anything already delivered
-- or failed, materializes a notification when the event is one, then marks the
-- event delivered. The notification insert is idempotent on its own dedupe key,
-- so a crash between insert and acknowledge cannot duplicate it.
create or replace function public.outbox_consume(p_event_id uuid)
returns table (event_id uuid, status public.outbox_status, created_notification boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.event_outbox;
  v_created boolean := false;
  v_type text;
  v_recipient uuid;
  v_actor uuid;
  v_dedupe text;
begin
  if p_event_id is null then
    raise exception using errcode = '22023', message = 'event id is required';
  end if;

  select * into v_event from public.event_outbox where event_outbox.id = p_event_id for update;

  if v_event.id is null then
    raise exception using errcode = 'P0002', message = 'event not found';
  end if;

  -- Idempotent: an event that is no longer pending is an event already handled.
  if v_event.status <> 'pending' then
    return query select v_event.id, v_event.status, false;
    return;
  end if;

  if v_event.event_type = 'notification' then
    v_recipient := (v_event.payload ->> 'recipient_id')::uuid;
    v_type := v_event.payload ->> 'type';
    v_actor := nullif(v_event.payload ->> 'actor_id', '')::uuid;
    v_dedupe := v_event.payload ->> 'dedupe_key';

    if v_recipient is not null and v_type is not null then
      insert into public.notifications (recipient_id, type, actor_id, payload, dedupe_key)
      values (
        v_recipient,
        v_type::public.notification_type,
        v_actor,
        v_event.payload,
        v_dedupe
      )
      on conflict (dedupe_key) do nothing;

      v_created := found;
    end if;
  end if;

  update public.event_outbox
  set status = 'delivered',
      attempts = event_outbox.attempts + 1
  where event_outbox.id = v_event.id;

  return query select v_event.id, 'delivered'::public.outbox_status, v_created;
end;
$$;

-- The failure path: records the error, backs off, and gives up at the attempt
-- bound, at which point the event is inspectable and reprocessable by hand.
create or replace function public.outbox_fail(
  p_event_id uuid,
  p_error text
)
returns table (event_id uuid, status public.outbox_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.event_outbox;
  v_clean_error text := left(coalesce(p_error, ''), 2000);
  v_next_attempt timestamptz;
begin
  select * into v_event from public.event_outbox where event_outbox.id = p_event_id for update;

  if v_event.id is null then
    raise exception using errcode = 'P0002', message = 'event not found';
  end if;

  if v_event.status <> 'pending' then
    return query select v_event.id, v_event.status;
    return;
  end if;

  if v_event.attempts + 1 >= v_event.max_attempts then
    update public.event_outbox
    set status = 'failed',
        attempts = v_event.attempts + 1,
        last_error = v_clean_error
    where event_outbox.id = v_event.id;

    return query select v_event.id, 'failed'::public.outbox_status;
    return;
  end if;

  -- Exponential backoff: 1, 2, 4, 8... minutes.
  v_next_attempt := now() + (power(2, v_event.attempts) * interval '1 minute');

  update public.event_outbox
  set attempts = v_event.attempts + 1,
      next_attempt_at = v_next_attempt,
      last_error = v_clean_error
  where event_outbox.id = v_event.id;

  return query select v_event.id, 'pending'::public.outbox_status;
end;
$$;

-- Drains the ready notification events. Safe to run on a schedule or by a
-- worker; each event is consumed idempotently.
create or replace function public.process_pending_outbox(p_limit integer default 100)
returns table (processed integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_processed integer := 0;
  v_event_id uuid;
  v_status public.outbox_status;
  v_created boolean;
begin
  for v_event_id in
    select event_outbox.id
    from public.event_outbox
    where event_outbox.status = 'pending'
      and event_outbox.next_attempt_at <= now()
    order by event_outbox.created_at, event_outbox.id
    limit v_limit
    for update skip locked
  loop
    select outbox_consume.event_id, outbox_consume.status, outbox_consume.created_notification
      into v_event_id, v_status, v_created
    from public.outbox_consume(v_event_id);

    v_processed := v_processed + 1;
  end loop;

  return query select v_processed;
end;
$$;

-- ── Outbox administration ───────────────────────────────────────────────────

create or replace function public.outbox_list_ready(p_limit integer default 100)
returns table (
  event_id uuid,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb,
  attempts integer,
  next_attempt_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 500
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.require_permission('admin.manage_settings');

  return query
  select event_outbox.id, event_outbox.event_type, event_outbox.aggregate_type,
         event_outbox.aggregate_id, event_outbox.payload, event_outbox.attempts,
         event_outbox.next_attempt_at, event_outbox.created_at
  from public.event_outbox
  where event_outbox.status = 'pending'
  order by event_outbox.created_at, event_outbox.id
  limit v_limit;
end;
$$;

create or replace function public.outbox_list_failed(p_limit integer default 100)
returns table (
  event_id uuid,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb,
  attempts integer,
  last_error text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 500
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.require_permission('admin.manage_settings');

  return query
  select event_outbox.id, event_outbox.event_type, event_outbox.aggregate_type,
         event_outbox.aggregate_id, event_outbox.payload, event_outbox.attempts,
         event_outbox.last_error, event_outbox.created_at
  from public.event_outbox
  where event_outbox.status = 'failed'
  order by event_outbox.created_at desc, event_outbox.id desc
  limit v_limit;
end;
$$;

create or replace function public.outbox_reprocess(p_event_id uuid)
returns table (event_id uuid, status public.outbox_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.event_outbox;
begin
  perform private.require_permission('admin.manage_settings');

  select * into v_event from public.event_outbox where event_outbox.id = p_event_id for update;

  if v_event.id is null then
    raise exception using errcode = 'P0002', message = 'event not found';
  end if;

  if v_event.status <> 'failed' then
    raise exception using errcode = '22023', message = 'only a failed event can be reprocessed';
  end if;

  update public.event_outbox
  set status = 'pending',
      attempts = 0,
      next_attempt_at = now(),
      last_error = null
  where event_outbox.id = v_event.id;

  return query select v_event.id, 'pending'::public.outbox_status;
end;
$$;

-- ── Notification reads ──────────────────────────────────────────────────────

create or replace function public.list_own_notifications(
  p_unread_only boolean default false,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  notification_id uuid,
  type public.notification_type,
  actor_id uuid,
  actor_display_name text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  v_actor_id := private.require_active_actor();

  return query
  select
    notifications.id,
    notifications.type,
    notifications.actor_id,
    actor.display_name,
    notifications.payload,
    notifications.read_at,
    notifications.created_at
  from public.notifications
  left join public.profiles actor on actor.id = notifications.actor_id
  where notifications.recipient_id = v_actor_id
    and (not coalesce(p_unread_only, false) or notifications.read_at is null)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (notifications.created_at, notifications.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by notifications.created_at desc, notifications.id desc
  limit v_limit;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns table (notification_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_actor();

  update public.notifications
  set read_at = now()
  where notifications.id = p_notification_id
    and notifications.recipient_id = v_actor_id
    and notifications.read_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'notification not found';
  end if;

  return query select p_notification_id;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns table (updated integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_updated integer;
begin
  v_actor_id := private.require_active_actor();

  update public.notifications
  set read_at = now()
  where notifications.recipient_id = v_actor_id
    and notifications.read_at is null;

  get diagnostics v_updated = row_count;

  return query select v_updated;
end;
$$;

create or replace function public.get_notification_preferences()
returns table (types jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_actor();

  return query
  select notification_preferences.types
  from public.notification_preferences
  where notification_preferences.user_id = v_actor_id;
end;
$$;

create or replace function public.set_notification_preferences(p_types jsonb)
returns table (types jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_key text;
  v_value jsonb;
begin
  v_actor_id := private.require_active_actor();

  if p_types is null or jsonb_typeof(p_types) <> 'object' then
    raise exception using errcode = '22023', message = 'preferences must be an object';
  end if;

  -- The keys must name a notification type and the values must be booleans, so
  -- the shape is closed and cannot smuggle unknown keys.
  for v_key, v_value in select * from jsonb_each(p_types) loop
    if not exists (
      select 1 from unnest(enum_range(null::public.notification_type)) as t(name)
      where t.name::text = v_key
    ) then
      raise exception using errcode = '22023', message = 'unknown notification type';
    end if;

    if jsonb_typeof(v_value) <> 'boolean' then
      raise exception using errcode = '22023', message = 'preference values must be booleans';
    end if;
  end loop;

  insert into public.notification_preferences (user_id, types)
  values (v_actor_id, p_types)
  on conflict (user_id) do update
  set types = excluded.types;

  return query select p_types;
end;
$$;

-- ── The queue learns chat targets ──────────────────────────────────────────

-- Recreated from 0009 with chat messages as a fourth target. Everything a
-- moderator could read about a post, comment or profile report is unchanged.
drop function public.moderation_list_reports(
  public.report_status, timestamptz, uuid, integer
);
create or replace function public.moderation_list_reports(
  p_status public.report_status default 'open',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  reason public.report_reason,
  details text,
  status public.report_status,
  reporter_id uuid,
  reporter_display_name text,
  target_author_id uuid,
  target_author_display_name text,
  target_excerpt text,
  open_report_count integer,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if not private.caller_reviews_reports() then
    raise exception using errcode = '42501', message = 'cannot review reports';
  end if;

  return query
  select
    r.id,
    case
      when r.post_id is not null then 'post'
      when r.comment_id is not null then 'comment'
      when r.chat_message_id is not null then 'chat_message'
      else 'profile'
    end,
    coalesce(r.post_id, r.comment_id, r.chat_message_id, r.profile_id),
    r.reason,
    r.details,
    r.status,
    r.reporter_id,
    reporter.display_name,
    target_author.id,
    target_author.display_name,
    left(coalesce(p.title, c.body, cm.body, target_author.display_name), 160),
    (
      select count(*)::integer
      from public.content_reports peer
      where peer.status in ('open', 'under_review')
        and (
          (r.post_id is not null and peer.post_id = r.post_id)
          or (r.comment_id is not null and peer.comment_id = r.comment_id)
          or (r.chat_message_id is not null and peer.chat_message_id = r.chat_message_id)
          or (r.profile_id is not null and peer.profile_id = r.profile_id)
        )
    ),
    r.resolution,
    r.resolved_by,
    r.resolved_at,
    r.created_at
  from public.content_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.chat_messages cm on cm.id = r.chat_message_id
  left join public.profiles target_author
    on target_author.id = coalesce(p.author_id, c.author_id, cm.author_id, r.profile_id)
  where (p_status is null or r.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit v_limit;
end;
$$;

drop function public.moderation_get_report(uuid);
create or replace function public.moderation_get_report(p_report_id uuid)
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  reason public.report_reason,
  details text,
  status public.report_status,
  reporter_id uuid,
  reporter_display_name text,
  target_author_id uuid,
  target_author_display_name text,
  target_body text,
  target_status text,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
begin
  if not private.caller_reviews_reports() then
    raise exception using errcode = '42501', message = 'cannot review reports';
  end if;

  return query
  select
    r.id,
    case
      when r.post_id is not null then 'post'
      when r.comment_id is not null then 'comment'
      when r.chat_message_id is not null then 'chat_message'
      else 'profile'
    end,
    coalesce(r.post_id, r.comment_id, r.chat_message_id, r.profile_id),
    r.reason,
    r.details,
    r.status,
    r.reporter_id,
    reporter.display_name,
    target_author.id,
    target_author.display_name,
    coalesce(p.body, c.body, cm.body),
    coalesce(p.status::text, c.status::text, cm.status::text),
    r.resolution,
    r.resolved_by,
    r.resolved_at,
    r.created_at
  from public.content_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.chat_messages cm on cm.id = r.chat_message_id
  left join public.profiles target_author
    on target_author.id = coalesce(p.author_id, c.author_id, cm.author_id, r.profile_id)
  where r.id = p_report_id;
end;
$$;

-- ── The actions that notify, recreated to enqueue in the same transaction ───

-- Comment replies (0007). Behavior is unchanged; a reply to a post or to a
-- comment now also records a notification event in the same transaction.
drop function public.create_comment(uuid, text, uuid);
create or replace function public.create_comment(
  p_post_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns table (comment_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  post_row public.posts;
  parent_row public.comments;
  plaza_status public.plaza_status;
  clean_body text := btrim(coalesce(p_body, ''));
  new_depth smallint := 0;
  new_comment_id uuid;
begin
  actor_id := private.require_permission('comment.create');

  select * into post_row from public.posts where posts.id = p_post_id for update;

  if post_row.id is null or not private.post_is_visible_to_caller(post_row.id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  select plazas.status into plaza_status
  from public.plazas
  where plazas.id = post_row.plaza_id;

  if plaza_status <> 'active' or post_row.status <> 'published' then
    raise exception using errcode = '42501', message = 'post does not accept comments';
  end if;

  if p_parent_id is not null then
    select * into parent_row from public.comments where comments.id = p_parent_id for update;

    if parent_row.id is null or parent_row.post_id <> post_row.id then
      raise exception using errcode = 'P0002', message = 'parent comment not found';
    end if;

    if parent_row.status <> 'published' then
      raise exception using errcode = '42501', message = 'parent comment does not accept replies';
    end if;

    -- Preserved from 0010: a moderator can lock a comment's replies.
    if parent_row.replies_locked then
      raise exception using errcode = '42501', message = 'replies to this comment are locked';
    end if;

    new_depth := parent_row.depth + 1;

    if new_depth > 5 then
      raise exception using errcode = '42501', message = 'maximum reply depth reached';
    end if;
  end if;

  if char_length(clean_body) not between 1 and 10000 then
    raise exception using
      errcode = '22023',
      message = 'comment must contain between 1 and 10000 characters';
  end if;

  perform private.enforce_comment_rate_limit(actor_id);

  insert into public.comments (post_id, parent_id, author_id, body, depth)
  values (post_row.id, p_parent_id, actor_id, clean_body, new_depth)
  returning comments.id into new_comment_id;

  update public.posts
  set comments_count = posts.comments_count + 1
  where posts.id = post_row.id;

  if p_parent_id is not null then
    update public.comments
    set replies_count = comments.replies_count + 1
    where comments.id = p_parent_id;
  end if;

  -- Notification events, in this transaction, so a reply is never delivered
  -- without its record. A reply to a comment notifies both the post author and
  -- the comment's author.
  perform private.enqueue_notification(
    post_row.author_id,
    'post_reply',
    actor_id,
    'post_reply:' || new_comment_id,
    jsonb_build_object('post_id', post_row.id, 'comment_id', new_comment_id)
  );

  if p_parent_id is not null then
    perform private.enqueue_notification(
      parent_row.author_id,
      'comment_reply',
      actor_id,
      'comment_reply:' || new_comment_id,
      jsonb_build_object(
        'post_id', post_row.id,
        'comment_id', new_comment_id,
        'parent_comment_id', parent_row.id
      )
    );
  end if;

  return query select new_comment_id;
end;
$$;

-- Reactions on content (0008). Same behavior; a freshly added reaction also
-- records a notification event for the content's author.
drop function public.toggle_post_reaction(uuid, text);
create or replace function public.toggle_post_reaction(
  p_post_id uuid,
  p_reaction_key text
)
returns table (reaction_key text, total integer, caller_reacted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  reaction_row public.reactions;
  removed boolean := false;
  new_reaction_id uuid;
begin
  v_actor_id := private.require_permission('react.create');

  select * into reaction_row
  from public.reactions
  where reactions.key = p_reaction_key
    and reactions.is_active;

  if reaction_row.id is null then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  if not private.post_accepts_engagement(p_post_id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  perform private.enforce_engagement_rate_limit(v_actor_id);

  delete from public.content_reactions
  where content_reactions.actor_id = v_actor_id
    and content_reactions.post_id = p_post_id
    and content_reactions.reaction_id = reaction_row.id;

  removed := found;

  if not removed then
    insert into public.content_reactions (reaction_id, actor_id, post_id)
    values (reaction_row.id, v_actor_id, p_post_id)
    returning content_reactions.id into new_reaction_id;

    perform private.enqueue_notification(
      (select posts.author_id from public.posts where posts.id = p_post_id),
      'reaction',
      v_actor_id,
      'reaction:' || new_reaction_id,
      jsonb_build_object('post_id', p_post_id, 'reaction_key', reaction_row.key)
    );
  end if;

  return query
    select
      reaction_row.key,
      (
        select count(*)::integer
        from public.content_reactions
        where content_reactions.post_id = p_post_id
          and content_reactions.reaction_id = reaction_row.id
      ),
      not removed;
end;
$$;

drop function public.toggle_comment_reaction(uuid, text);
create or replace function public.toggle_comment_reaction(
  p_comment_id uuid,
  p_reaction_key text
)
returns table (reaction_key text, total integer, caller_reacted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  reaction_row public.reactions;
  removed boolean := false;
  new_reaction_id uuid;
begin
  v_actor_id := private.require_permission('react.create');

  select * into reaction_row
  from public.reactions
  where reactions.key = p_reaction_key
    and reactions.is_active;

  if reaction_row.id is null then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  if not private.comment_accepts_engagement(p_comment_id) then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  perform private.enforce_engagement_rate_limit(v_actor_id);

  delete from public.content_reactions
  where content_reactions.actor_id = v_actor_id
    and content_reactions.comment_id = p_comment_id
    and content_reactions.reaction_id = reaction_row.id;

  removed := found;

  if not removed then
    insert into public.content_reactions (reaction_id, actor_id, comment_id)
    values (reaction_row.id, v_actor_id, p_comment_id)
    returning content_reactions.id into new_reaction_id;

    perform private.enqueue_notification(
      (select comments.author_id from public.comments where comments.id = p_comment_id),
      'reaction',
      v_actor_id,
      'reaction:' || new_reaction_id,
      jsonb_build_object('comment_id', p_comment_id, 'reaction_key', reaction_row.key)
    );
  end if;

  return query
    select
      reaction_row.key,
      (
        select count(*)::integer
        from public.content_reactions
        where content_reactions.comment_id = p_comment_id
          and content_reactions.reaction_id = reaction_row.id
      ),
      not removed;
end;
$$;

-- Friend requests (0016). Same behavior; a request and its acceptance each
-- record a notification event.
drop function public.send_friend_request(uuid, text);
create or replace function public.send_friend_request(
  p_addressee_id uuid,
  p_note text default null
)
returns table (friendship_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_friendship_id uuid;
begin
  v_actor_id := private.require_active_actor();

  if v_actor_id = p_addressee_id then
    raise exception using errcode = '22023', message = 'cannot befriend yourself';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_addressee_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if private.users_are_blocked(v_actor_id, p_addressee_id) then
    raise exception using errcode = '42501', message = 'cannot send a request to this member';
  end if;

  if v_clean_note is not null and char_length(v_clean_note) > 500 then
    raise exception using errcode = '22023', message = 'note must not exceed 500 characters';
  end if;

  perform private.enforce_friend_request_rate_limit(v_actor_id);

  begin
    insert into public.friendships (requester_id, addressee_id)
    values (v_actor_id, p_addressee_id)
    returning friendships.id into v_friendship_id;
  exception when unique_violation then
    raise exception using errcode = '22023', message = 'a request already exists in one direction';
  end;

  perform private.enqueue_notification(
    p_addressee_id,
    'friend_request',
    v_actor_id,
    'friend_request:' || v_friendship_id,
    jsonb_build_object('friendship_id', v_friendship_id)
  );

  return query select v_friendship_id;
end;
$$;

drop function public.respond_friend_request(uuid, boolean);
create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns table (friendship_id uuid, status public.friendship_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_friendship public.friendships;
begin
  v_actor_id := private.require_active_actor();

  select * into v_friendship from public.friendships where friendships.id = p_friendship_id for update;

  if v_friendship.id is null or v_friendship.addressee_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;

  if v_friendship.status <> 'pending' then
    raise exception using errcode = '22023', message = 'this request is no longer open';
  end if;

  if not p_accept or private.users_are_blocked(v_actor_id, v_friendship.requester_id) then
    update public.friendships
    set status = 'rejected'
    where friendships.id = v_friendship.id;
    return query select v_friendship.id, 'rejected'::public.friendship_status;
    return;
  end if;

  update public.friendships
  set status = 'accepted'
  where friendships.id = v_friendship.id;

  perform private.enqueue_notification(
    v_friendship.requester_id,
    'friend_request',
    v_actor_id,
    'friend_accepted:' || v_friendship.id,
    jsonb_build_object('friendship_id', v_friendship.id)
  );

  return query select v_friendship.id, 'accepted'::public.friendship_status;
end;
$$;

-- Clan invitations (0016). Same behavior; an invitation records a notification
-- event for the invitee.
drop function public.invite_to_clan(uuid, uuid, text);
create or replace function public.invite_to_clan(
  p_clan_id uuid,
  p_member_id uuid,
  p_note text default null
)
returns table (membership_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_clan public.clans;
  v_clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_membership_id uuid;
begin
  v_actor_id := private.require_active_actor();

  select * into v_clan from public.clans where clans.id = p_clan_id for update;

  if v_clan.id is null or v_clan.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  if not private.clan_is_led_by_caller(v_clan.id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_member_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if private.users_are_blocked(v_actor_id, p_member_id) then
    raise exception using errcode = '42501', message = 'cannot invite this member';
  end if;

  if v_clean_note is not null and char_length(v_clean_note) > 500 then
    raise exception using errcode = '22023', message = 'note must not exceed 500 characters';
  end if;

  select * into v_membership
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = p_member_id
  for update;

  if v_membership.id is not null then
    if v_membership.status in ('active', 'pending', 'invited') then
      raise exception using errcode = '22023', message = 'member already belongs or is invited';
    end if;
  end if;

  -- `resolved_at` records the answer to an invitation, not its sending.
  insert into public.clan_members (clan_id, member_id, role, status, resolution_note, resolved_by, resolved_at)
  values (p_clan_id, p_member_id, 'member', 'invited', v_clean_note, v_actor_id, null)
  on conflict (clan_id, member_id) do update
  set status = 'invited',
      resolution_note = excluded.resolution_note,
      resolved_by = v_actor_id,
      resolved_at = null
  returning clan_members.id into v_membership_id;

  perform private.enqueue_notification(
    p_member_id,
    'clan_invite',
    v_actor_id,
    'clan_invite:' || v_membership_id,
    jsonb_build_object('clan_id', p_clan_id, 'clan_slug', v_clan.slug, 'membership_id', v_membership_id)
  );

  return query select v_membership_id;
end;
$$;

-- Warnings (0011). Same behavior; a warning also records a notification event
-- for the member it is addressed to.
drop function public.moderation_warn_user(uuid, text);
create or replace function public.moderation_warn_user(
  p_user_id uuid,
  p_reason text
)
returns table (warning_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_reason text;
  v_target_status text;
  v_new_warning_id uuid;
begin
  v_actor_id := private.require_permission('moderation.warn');

  v_clean_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_clean_reason is null or char_length(v_clean_reason) not between 3 and 1000 then
    raise exception using
      errcode = '22023',
      message = 'a warning must contain between 3 and 1000 characters';
  end if;

  if p_user_id = v_actor_id then
    raise exception using errcode = '22023', message = 'cannot warn yourself';
  end if;

  select profiles.status into v_target_status
  from public.profiles where profiles.id = p_user_id;

  if v_target_status is null then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;

  perform private.require_unprotected_target(v_actor_id, p_user_id);

  insert into public.user_warnings (user_id, actor_id, reason)
  values (p_user_id, v_actor_id, v_clean_reason)
  returning user_warnings.id into v_new_warning_id;

  perform private.write_audit_log(
    v_actor_id,
    'user.warned',
    'user',
    p_user_id,
    left(v_clean_reason, 500),
    null,
    null,
    jsonb_build_object('warning_id', v_new_warning_id)
  );

  perform private.enqueue_notification(
    p_user_id,
    'warning',
    v_actor_id,
    'warning:' || v_new_warning_id,
    jsonb_build_object('warning_id', v_new_warning_id)
  );

  return query select v_new_warning_id;
end;
$$;

-- ── The codex proposal source reader learns chat ───────────────────────────

-- Recreated from 0015: a chat source is now visible when its message is.
drop function private.codex_source_is_visible(public.codex_proposal_sources);
create or replace function private.codex_source_is_visible(p_source public.codex_proposal_sources)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_source.post_id is not null then
    return private.post_is_visible_to_caller(p_source.post_id);
  end if;

  if p_source.comment_id is not null then
    return exists (
      select 1
      from public.comments
      where comments.id = p_source.comment_id
        and private.post_is_visible_to_caller(comments.post_id)
    );
  end if;

  if p_source.chat_message_id is not null then
    return private.chat_message_is_visible_to_caller(p_source.chat_message_id);
  end if;

  return true;
end;
$$;

revoke all on function private.codex_source_is_visible(public.codex_proposal_sources)
  from public, anon, authenticated;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.list_chat_channels() from public, anon, authenticated;
revoke all on function public.get_chat_channel(text) from public, anon, authenticated;
revoke all on function public.list_chat_messages(uuid, timestamptz, uuid, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.list_chat_message_edits(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.send_chat_message(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_own_chat_message(uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_own_chat_message(uuid) from public, anon, authenticated;
revoke all on function public.toggle_chat_reaction(uuid, text) from public, anon, authenticated;
revoke all on function public.report_chat_message(uuid, public.report_reason, text)
  from public, anon, authenticated;
revoke all on function public.moderation_set_chat_message_status(
  uuid, public.chat_message_status, public.chat_message_status, text
) from public, anon, authenticated;
revoke all on function public.moderation_toggle_chat_message_pin(uuid, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_create_chat_channel(
  text, text, public.chat_channel_kind, text, uuid, integer
) from public, anon, authenticated;
revoke all on function public.admin_update_chat_channel(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.admin_set_chat_channel_status(
  uuid, public.chat_channel_status, public.chat_channel_status, text
) from public, anon, authenticated;
revoke all on function public.admin_add_chat_channel_member(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.post_chat_announcement(uuid, text)
  from public, anon, authenticated;
revoke all on function public.outbox_consume(uuid) from public, anon, authenticated;
revoke all on function public.outbox_fail(uuid, text) from public, anon, authenticated;
revoke all on function public.process_pending_outbox(integer) from public, anon, authenticated;
revoke all on function public.outbox_list_ready(integer) from public, anon, authenticated;
revoke all on function public.outbox_list_failed(integer) from public, anon, authenticated;
revoke all on function public.outbox_reprocess(uuid) from public, anon, authenticated;
revoke all on function public.list_own_notifications(boolean, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.mark_all_notifications_read() from public, anon, authenticated;
revoke all on function public.get_notification_preferences() from public, anon, authenticated;
revoke all on function public.set_notification_preferences(jsonb) from public, anon, authenticated;
revoke all on function public.moderation_list_reports(
  public.report_status, timestamptz, uuid, integer
) from public, anon, authenticated;
revoke all on function public.moderation_get_report(uuid) from public, anon, authenticated;
revoke all on function public.create_comment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.toggle_post_reaction(uuid, text) from public, anon, authenticated;
revoke all on function public.toggle_comment_reaction(uuid, text) from public, anon, authenticated;
revoke all on function public.send_friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.respond_friend_request(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.invite_to_clan(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.moderation_warn_user(uuid, text) from public, anon, authenticated;

-- Reading channels and messages is open to visitors for what is public; the
-- RPCs re-check channel visibility for the rest.
grant execute on function public.list_chat_channels() to anon, authenticated;
grant execute on function public.get_chat_channel(text) to anon, authenticated;
grant execute on function public.list_chat_messages(uuid, timestamptz, uuid, integer, boolean)
  to anon, authenticated;

-- Members talk, react, report, read their own notifications and preferences.
grant execute on function public.send_chat_message(uuid, text, uuid) to authenticated;
grant execute on function public.update_own_chat_message(uuid, text) to authenticated;
grant execute on function public.delete_own_chat_message(uuid) to authenticated;
grant execute on function public.toggle_chat_reaction(uuid, text) to authenticated;
grant execute on function public.report_chat_message(uuid, public.report_reason, text)
  to authenticated;
grant execute on function public.list_chat_message_edits(uuid, integer) to authenticated;
grant execute on function public.list_own_notifications(boolean, timestamptz, uuid, integer)
  to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.set_notification_preferences(jsonb) to authenticated;

-- Chat moderation, channel administration, announcements and the outbox are
-- permission-checked inside the RPCs.
grant execute on function public.moderation_set_chat_message_status(
  uuid, public.chat_message_status, public.chat_message_status, text
) to authenticated;
grant execute on function public.moderation_toggle_chat_message_pin(uuid, boolean, boolean)
  to authenticated;
grant execute on function public.admin_create_chat_channel(
  text, text, public.chat_channel_kind, text, uuid, integer
) to authenticated;
grant execute on function public.admin_update_chat_channel(uuid, text, text, integer)
  to authenticated;
grant execute on function public.admin_set_chat_channel_status(
  uuid, public.chat_channel_status, public.chat_channel_status, text
) to authenticated;
grant execute on function public.admin_add_chat_channel_member(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.post_chat_announcement(uuid, text) to authenticated;
grant execute on function public.outbox_consume(uuid) to authenticated;
grant execute on function public.outbox_fail(uuid, text) to authenticated;
grant execute on function public.process_pending_outbox(integer) to authenticated;
grant execute on function public.outbox_list_ready(integer) to authenticated;
grant execute on function public.outbox_list_failed(integer) to authenticated;
grant execute on function public.outbox_reprocess(uuid) to authenticated;

-- The recreated surfaces keep their original grants.
grant execute on function public.moderation_list_reports(
  public.report_status, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.moderation_get_report(uuid) to authenticated;
grant execute on function public.create_comment(uuid, text, uuid) to authenticated;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;
grant execute on function public.toggle_comment_reaction(uuid, text) to authenticated;
grant execute on function public.send_friend_request(uuid, text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.invite_to_clan(uuid, uuid, text) to authenticated;
grant execute on function public.moderation_warn_user(uuid, text) to authenticated;

-- ── Canonical channels ──────────────────────────────────────────────────────

insert into public.chat_channels (slug, name, description, kind, sort_order)
values
  ('welcome', 'Welcome', 'Say hello and get oriented.', 'public', 10),
  ('general', 'General', 'Everyday conversation.', 'public', 20),
  ('questions', 'Questions', 'Ask anything, answered without condescension.', 'public', 30),
  ('philosophy', 'Philosophy', 'The ideas that hold the culture together.', 'public', 40),
  ('library', 'Library', 'Around the Codex Libre.', 'public', 50),
  ('announcements', 'Announcements', 'Official notices from the Council.', 'announcements', 5),
  ('clans', 'Clans', 'Clan and house business.', 'public', 60),
  ('projects', 'Projects', 'Work being forged by the community.', 'public', 70),
  ('off-topic', 'Off-topic', 'Everything else.', 'public', 80);

-- The outbox drains itself on a schedule where pg_cron exists, exactly like the
-- retention job in 0014; the function is callable by hand anywhere.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'process-pending-outbox',
      '*/1 * * * *',
      $cron$select public.process_pending_outbox();$cron$
    );
  end if;
end;
$$;

comment on table public.event_outbox is
  'Transactional outbox: the side-effect record written in the same transaction as the action. Consumed idempotently by dedupe key; failed events are inspectable and reprocessable.';
comment on table public.notifications is
  'A notification for one recipient, materialized from an outbox event. The dedupe key makes delivery idempotent; payloads carry ids, never private bodies.';
comment on function public.outbox_consume(uuid) is
  'Deliver one outbox event idempotently: materialize the notification for notification events, then mark the event delivered. A delivered or failed event is a no-op.';
comment on function public.moderation_set_chat_message_status(
  uuid, public.chat_message_status, public.chat_message_status, text
) is
  'Hide, restore or delete a chat message. Compare-and-swap, audited; a deleted message stays deleted.';
comment on function public.update_own_chat_message(uuid, text) is
  'Edit a chat message. The previous wording is kept in chat_message_edits so a report filed before the edit can still be answered.';
