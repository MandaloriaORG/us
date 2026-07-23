-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Warnings and moderator notes
--
-- The two records a moderator keeps about a person, which are opposites and
-- must never be confused:
--
--   * A **warning** is addressed to the member. They are meant to read it, and
--     they can acknowledge it. It is the lightest action in the ladder that
--     already runs suspend → ban, and it is audited like the rest.
--   * A **note** is addressed to other moderators. The subject can never read
--     it, and it is not an action taken against them. It exists so the Council
--     does not have to rebuild context from the audit log every time.
--
-- Neither table is reachable from the Data API: RLS is on with no policies and
-- no grants, and every path is a SECURITY DEFINER RPC.
--
-- There is no separate moderation-history table. `council_list_audit_logs`
-- already filters by target, and every action here writes an audit row, so the
-- history is the audit log filtered to one person. A second store would be a
-- second truth.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tables ─────────────────────────────────────────────────────────────────

create table public.user_warnings (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The moderator who issued it. Kept as `set null` rather than cascade: the
  -- warning is a record about the member and must survive the moderator's
  -- account being removed.
  actor_id uuid references public.profiles (id) on delete set null,
  reason text not null
    constraint user_warnings_reason_length
    check (char_length(btrim(reason)) between 3 and 1000),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_warnings_not_self check (user_id is distinct from actor_id)
);

create index user_warnings_user_idx on public.user_warnings (user_id, created_at desc, id desc);
create index user_warnings_unacknowledged_idx on public.user_warnings (user_id)
  where acknowledged_at is null;

create table public.moderator_notes (
  id uuid primary key default extensions.uuid_generate_v4(),
  subject_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  body text not null
    constraint moderator_notes_body_length
    check (char_length(btrim(body)) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moderator_notes_subject_idx
  on public.moderator_notes (subject_id, created_at desc, id desc);

create trigger moderator_notes_set_updated_at
  before update on public.moderator_notes
  for each row execute function public.update_updated_at();

alter table public.user_warnings enable row level security;
alter table public.moderator_notes enable row level security;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- A member who can administer protected roles may only be acted on by someone
-- who can do the same. Migration 0001 inlines this rule in three places; it is
-- extracted here so this file and later ones share one copy.
create or replace function private.require_unprotected_target(
  p_actor_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.user_has_permission(p_user_id, 'admin.manage_protected_roles')
    and not private.user_has_permission(p_actor_id, 'admin.manage_protected_roles') then
    raise exception using
      errcode = '42501',
      message = 'permission denied for protected user';
  end if;
end;
$$;

-- ── Warnings ───────────────────────────────────────────────────────────────

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

  -- The warned member is meant to read this, so the ceiling is higher than the
  -- 500 characters an audit reason allows and it is validated here.
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

  -- The reason is the warning's own text and already lives on the row. The
  -- audit entry records that a warning was issued, not a second copy of it.
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

  return query select v_new_warning_id;
end;
$$;

-- A member reads their own warnings and nobody else's. There is no cursor: a
-- member with enough warnings to need one has a different problem.
create or replace function public.list_own_warnings()
returns table (
  warning_id uuid,
  reason text,
  acknowledged_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    user_warnings.id,
    user_warnings.reason,
    user_warnings.acknowledged_at,
    user_warnings.created_at
  from public.user_warnings
  where user_warnings.user_id = v_actor_id
  order by user_warnings.created_at desc, user_warnings.id desc
  limit 100;
end;
$$;

-- Acknowledging is the member saying they read it. It is deliberately not
-- reversible and deliberately not something a moderator can do for them.
create or replace function public.acknowledge_warning(p_warning_id uuid)
returns table (warning_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_warning public.user_warnings;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into v_warning
  from public.user_warnings
  where user_warnings.id = p_warning_id
  for update;

  -- A warning belonging to someone else is reported as missing, not as
  -- forbidden: otherwise the id becomes a probe for other people's warnings.
  if v_warning.id is null or v_warning.user_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'warning not found';
  end if;

  if v_warning.acknowledged_at is not null then
    raise exception using errcode = '22023', message = 'warning already acknowledged';
  end if;

  update public.user_warnings
  set acknowledged_at = now()
  where user_warnings.id = v_warning.id;

  return query select v_warning.id;
end;
$$;

-- ── Moderator notes ────────────────────────────────────────────────────────

create or replace function public.council_add_user_note(
  p_user_id uuid,
  p_body text
)
returns table (note_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_body text;
  v_exists boolean;
  v_new_note_id uuid;
begin
  v_actor_id := private.require_permission('admin.view_users');

  v_clean_body := nullif(
    btrim(regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')),
    ''
  );

  if v_clean_body is null or char_length(v_clean_body) not between 3 and 2000 then
    raise exception using
      errcode = '22023',
      message = 'a note must contain between 3 and 2000 characters';
  end if;

  select true into v_exists from public.profiles where profiles.id = p_user_id;

  if v_exists is null then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;

  insert into public.moderator_notes (subject_id, actor_id, body)
  values (p_user_id, v_actor_id, v_clean_body)
  returning moderator_notes.id into v_new_note_id;

  -- The body stays on the note. Copying it into the audit log would put an
  -- internal note into a record the subject's own Council entry surfaces.
  perform private.write_audit_log(
    v_actor_id,
    'user.note_added',
    'user',
    p_user_id,
    null,
    null,
    null,
    jsonb_build_object('note_id', v_new_note_id)
  );

  return query select v_new_note_id;
end;
$$;

create or replace function public.council_list_user_notes(
  p_user_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  note_id uuid,
  body text,
  actor_id uuid,
  actor_display_name text,
  created_at timestamptz,
  updated_at timestamptz
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
  perform private.require_permission('admin.view_users');

  return query
  select
    moderator_notes.id,
    moderator_notes.body,
    moderator_notes.actor_id,
    actor.display_name,
    moderator_notes.created_at,
    moderator_notes.updated_at
  from public.moderator_notes
  left join public.profiles actor on actor.id = moderator_notes.actor_id
  where moderator_notes.subject_id = p_user_id
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (moderator_notes.created_at, moderator_notes.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by moderator_notes.created_at desc, moderator_notes.id desc
  limit v_limit;
end;
$$;

-- Only the moderator who wrote a note may remove it. A note is one person's
-- reading of a situation, so nobody else gets to erase or rewrite it.
create or replace function public.council_delete_user_note(p_note_id uuid)
returns table (note_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_note public.moderator_notes;
begin
  v_actor_id := private.require_permission('admin.view_users');

  select * into v_note
  from public.moderator_notes
  where moderator_notes.id = p_note_id
  for update;

  if v_note.id is null then
    raise exception using errcode = 'P0002', message = 'note not found';
  end if;

  if v_note.actor_id is distinct from v_actor_id then
    raise exception using errcode = '42501', message = 'only the author may remove a note';
  end if;

  delete from public.moderator_notes where moderator_notes.id = v_note.id;

  perform private.write_audit_log(
    v_actor_id,
    'user.note_removed',
    'user',
    v_note.subject_id,
    null,
    null,
    null,
    jsonb_build_object('note_id', v_note.id)
  );

  return query select v_note.id;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function private.require_unprotected_target(uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.moderation_warn_user(uuid, text)
  from public, anon, authenticated;
revoke all on function public.list_own_warnings() from public, anon, authenticated;
revoke all on function public.acknowledge_warning(uuid) from public, anon, authenticated;
revoke all on function public.council_add_user_note(uuid, text)
  from public, anon, authenticated;
revoke all on function public.council_list_user_notes(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.council_delete_user_note(uuid)
  from public, anon, authenticated;

-- Every one of these requires an account, and each RPC re-checks its own
-- permission. Nothing here is reachable anonymously.
grant execute on function public.moderation_warn_user(uuid, text) to authenticated;
grant execute on function public.list_own_warnings() to authenticated;
grant execute on function public.acknowledge_warning(uuid) to authenticated;
grant execute on function public.council_add_user_note(uuid, text) to authenticated;
grant execute on function public.council_list_user_notes(uuid, timestamptz, uuid, integer)
  to authenticated;
grant execute on function public.council_delete_user_note(uuid) to authenticated;

comment on table public.user_warnings is
  'Warnings addressed to a member. The member reads and acknowledges their own; nobody else reads them outside the Council RPCs.';
comment on table public.moderator_notes is
  'Internal Council notes about a member. The subject can never read them, and they are not an action taken against the subject.';
comment on function public.moderation_warn_user(uuid, text) is
  'Issue a warning to a member. Requires moderation.warn, refuses self and protected targets, and is audited.';
