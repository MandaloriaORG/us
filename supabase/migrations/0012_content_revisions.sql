-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Edit history
--
-- Until now an edit overwrote the body and the previous wording was gone. That
-- makes "View edit history" impossible and, worse, makes a report unanswerable:
-- a member can report a post, its author can rewrite it, and the moderator
-- opens evidence that no longer says what was reported.
--
-- A revision is a snapshot of what the content said **before** an edit. It is
-- written inside the same transaction as the edit, from inside the edit RPCs
-- themselves, so it cannot be skipped by any caller.
--
-- Two rules shape the table.
--
-- 1. **Bounded.** An edit loop would otherwise grow this table without limit,
--    so each item keeps at most the 50 most recent revisions and the oldest
--    fall away. Edit history is context, not an archive.
-- 2. **Limited access.** The author reads their own history and a moderator
--    reads any, and nobody else — a revision can hold wording its author has
--    since removed, which is exactly what should not be public.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Table ──────────────────────────────────────────────────────────────────

create table public.content_revisions (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- Order comes from a sequence, never from the clock. Several edits inside one
  -- transaction share the same `now()`, and a v4 uuid carries no order, so
  -- ordering on `(created_at, id)` would shuffle them — and the trim below
  -- would then drop whichever revisions happened to sort low. `created_at`
  -- stays for display only.
  seq bigint generated always as identity,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  -- Who wrote the version being replaced. `set null` rather than cascade: the
  -- revision is evidence about the content, not about the account.
  editor_id uuid references public.profiles (id) on delete set null,
  -- Only a post has a title. A comment revision leaves it null.
  title text
    constraint content_revisions_title_length
    check (title is null or char_length(title) between 1 and 300),
  body text not null
    constraint content_revisions_body_length
    check (char_length(body) between 1 and 40000),
  created_at timestamptz not null default now(),
  constraint content_revisions_single_target check (
    (post_id is not null)::integer + (comment_id is not null)::integer = 1
  ),
  -- A title belongs to a post revision and only to a post revision.
  constraint content_revisions_title_belongs_to_post check (
    title is null or post_id is not null
  )
);

create unique index content_revisions_seq_idx on public.content_revisions (seq);
create index content_revisions_post_idx
  on public.content_revisions (post_id, seq desc)
  where post_id is not null;
create index content_revisions_comment_idx
  on public.content_revisions (comment_id, seq desc)
  where comment_id is not null;

alter table public.content_revisions enable row level security;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- Keeps the newest `p_keep` revisions of one item and drops the rest. Called
-- right after a snapshot is written, so the bound holds at all times rather
-- than needing a scheduled job.
create or replace function private.trim_content_revisions(
  p_post_id uuid,
  p_comment_id uuid,
  p_keep integer default 50
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.content_revisions
  where content_revisions.id in (
    select revision.id
    from public.content_revisions revision
    where revision.post_id is not distinct from p_post_id
      and revision.comment_id is not distinct from p_comment_id
    order by revision.seq desc
    offset greatest(p_keep, 1)
  );
end;
$$;

create or replace function private.snapshot_post(p_post_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.content_revisions (post_id, editor_id, title, body)
  select posts.id, posts.author_id, posts.title, posts.body
  from public.posts
  where posts.id = p_post_id;

  perform private.trim_content_revisions(p_post_id, null);
end;
$$;

create or replace function private.snapshot_comment(p_comment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.content_revisions (comment_id, editor_id, body)
  select comments.id, comments.author_id, comments.body
  from public.comments
  where comments.id = p_comment_id;

  perform private.trim_content_revisions(null, p_comment_id);
end;
$$;

-- ── Edits now leave a record ───────────────────────────────────────────────

-- Same signature as 0007's; the only change is the snapshot before the update.
create or replace function public.update_own_post(
  p_post_id uuid,
  p_title text,
  p_body text
)
returns table (post_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  post_row public.posts;
  clean_title text := btrim(coalesce(p_title, ''));
  clean_body text := btrim(coalesce(p_body, ''));
begin
  actor_id := private.require_permission('post.edit.own');

  select * into post_row from public.posts where posts.id = p_post_id for update;

  if post_row.id is null or not private.post_is_visible_to_caller(post_row.id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  if post_row.author_id <> actor_id then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if post_row.edit_locked then
    raise exception using errcode = '42501', message = 'post editing is locked';
  end if;

  if post_row.status not in ('draft', 'pending_review', 'published') then
    raise exception using errcode = '42501', message = 'post cannot be edited in its current state';
  end if;

  if char_length(clean_title) not between 3 and 300 then
    raise exception using
      errcode = '22023',
      message = 'title must contain between 3 and 300 characters';
  end if;

  if char_length(clean_body) not between 1 and 40000 then
    raise exception using
      errcode = '22023',
      message = 'body must contain between 1 and 40000 characters';
  end if;

  -- An edit that changes nothing leaves no revision: a history of identical
  -- entries is noise, and it would let a member push real history past the
  -- bound by saving the same text fifty times.
  if (clean_title, clean_body) is distinct from (post_row.title, post_row.body) then
    perform private.snapshot_post(post_row.id);

    update public.posts
    set title = clean_title,
        body = clean_body
    where posts.id = post_row.id;
  end if;

  return query select post_row.id;
end;
$$;

create or replace function public.update_own_comment(
  p_comment_id uuid,
  p_body text
)
returns table (comment_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  comment_row public.comments;
  clean_body text := btrim(coalesce(p_body, ''));
begin
  actor_id := private.require_permission('comment.edit.own');

  select * into comment_row from public.comments where comments.id = p_comment_id for update;

  if comment_row.id is null or not private.post_is_visible_to_caller(comment_row.post_id) then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  if comment_row.author_id <> actor_id then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if comment_row.status <> 'published' then
    raise exception using errcode = '42501', message = 'comment cannot be edited in its current state';
  end if;

  if char_length(clean_body) not between 1 and 10000 then
    raise exception using
      errcode = '22023',
      message = 'comment must contain between 1 and 10000 characters';
  end if;

  if clean_body is distinct from comment_row.body then
    perform private.snapshot_comment(comment_row.id);

    update public.comments
    set body = clean_body
    where comments.id = comment_row.id;
  end if;

  return query select comment_row.id;
end;
$$;

-- ── Reading the history ────────────────────────────────────────────────────

-- Exactly one target, matching the reporting and voting RPCs. Whoever asks must
-- be the author of the item or hold `moderation.hide`; anyone else is told the
-- item does not exist, so the id cannot be used to probe for edits on content
-- the caller cannot reach.
create or replace function public.list_content_revisions(
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_limit integer default 25
)
returns table (
  revision_id uuid,
  editor_id uuid,
  editor_display_name text,
  title text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_actor_id uuid := auth.uid();
  v_author_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_moderates boolean;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if (p_post_id is not null)::integer + (p_comment_id is not null)::integer <> 1 then
    raise exception using errcode = '22023', message = 'name exactly one target';
  end if;

  v_moderates := private.user_has_permission(v_actor_id, 'moderation.hide');

  if p_post_id is not null then
    select posts.author_id into v_author_id
    from public.posts
    where posts.id = p_post_id
      and (v_moderates or private.post_is_visible_to_caller(posts.id));
  else
    select comments.author_id into v_author_id
    from public.comments
    where comments.id = p_comment_id
      and (v_moderates or private.post_is_visible_to_caller(comments.post_id));
  end if;

  if v_author_id is null then
    raise exception using errcode = 'P0002', message = 'content not found';
  end if;

  if not v_moderates and v_author_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'content not found';
  end if;

  return query
  select
    revision.id,
    revision.editor_id,
    editor.display_name,
    revision.title,
    revision.body,
    revision.created_at
  from public.content_revisions revision
  left join public.profiles editor on editor.id = revision.editor_id
  where revision.post_id is not distinct from p_post_id
    and revision.comment_id is not distinct from p_comment_id
  order by revision.seq desc
  limit v_limit;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function private.trim_content_revisions(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function private.snapshot_post(uuid) from public, anon, authenticated;
revoke all on function private.snapshot_comment(uuid) from public, anon, authenticated;

revoke all on function public.update_own_post(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.update_own_comment(uuid, text)
  from public, anon, authenticated;
revoke all on function public.list_content_revisions(uuid, uuid, integer)
  from public, anon, authenticated;

-- Reading edit history requires an account, and the RPC then requires being the
-- author or a moderator. Nothing here is reachable anonymously.
grant execute on function public.update_own_post(uuid, text, text) to authenticated;
grant execute on function public.update_own_comment(uuid, text) to authenticated;
grant execute on function public.list_content_revisions(uuid, uuid, integer) to authenticated;

comment on table public.content_revisions is
  'Snapshots of what a post or comment said before each edit. Bounded to the 50 most recent per item. Readable only by the author or a moderator.';
comment on function public.list_content_revisions(uuid, uuid, integer) is
  'Edit history for one post or one comment. Requires being its author or holding moderation.hide; anyone else is told it does not exist.';
