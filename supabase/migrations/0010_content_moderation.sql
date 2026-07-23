-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Content moderation transitions
--
-- Migration 0007 created every state a post or comment can hold and implemented
-- only the author's transitions. This file implements the moderator's, and adds
-- nothing to either enum: `hidden`, `quarantined` and `deleted_by_moderator`
-- have existed since 0007 precisely so this migration would not have to change
-- the type.
--
-- Three rules shape everything below.
--
-- 1. Hiding is a state change, not a delete. The row, its body, its counters and
--    its replies survive, so restoring is a state change too and the evidence
--    behind a report outlives the removal.
-- 2. `deleted_by_author` is terminal for a moderator. Undoing an author's own
--    removal would publish content its author withdrew; a moderator may delete
--    it further, never bring it back.
-- 3. Every transition is compare-and-swap and carries a reason, which is written
--    to the audit log. Two moderators on stale screens cannot overwrite each
--    other, and no removal is anonymous.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Comment moderation flags ───────────────────────────────────────────────

-- Posts already carry `is_pinned`, `is_highlighted` and `edit_locked` from
-- 0007. Comments carry none, so the two a moderator needs are added here.
alter table public.comments
  add column if not exists is_pinned boolean not null default false,
  add column if not exists replies_locked boolean not null default false;

create index if not exists comments_pinned_idx on public.comments (post_id, created_at)
  where is_pinned;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- Each destination state needs its own permission: hiding, quarantining,
-- deleting and restoring are different levels of authority over the same row.
-- Returns the actor so the callers do not have to resolve it twice.
create or replace function private.require_moderation_permission(p_status text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return case p_status
    when 'hidden' then private.require_permission('moderation.hide')
    when 'quarantined' then private.require_permission('moderation.quarantine')
    when 'deleted_by_moderator' then private.require_permission('moderation.delete')
    -- Everything else is a return to visibility, whatever the shade.
    else private.require_permission('moderation.restore')
  end;
end;
$$;

-- A post counts towards its Plaza while it is one of the visible states. This
-- mirrors `private.recalculate_content_counters`, which is the definition of
-- truth; the incremental updates below only have to agree with it.
create or replace function private.post_status_is_counted(p_status public.post_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('published', 'closed', 'archived');
$$;

-- A comment counts towards its post's thread only while it is published. Hiding
-- one takes it out of the thread, so it leaves the count with it.
create or replace function private.comment_status_is_counted(p_status public.comment_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status = 'published';
$$;

-- ── Post transitions ───────────────────────────────────────────────────────

create or replace function public.moderation_set_post_status(
  p_post_id uuid,
  p_expected_status public.post_status,
  p_status public.post_status,
  p_reason text
)
returns table (post_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_post public.posts;
  v_clean_reason text;
  v_was_counted boolean;
  v_is_counted boolean;
  v_published_at timestamptz;
begin
  v_actor_id := private.require_moderation_permission(p_status::text);
  v_clean_reason := private.validated_reason(p_reason);

  -- A moderator reads by id, not through the visibility filter: hidden and
  -- quarantined content is exactly what they are here to act on.
  select * into v_post from public.posts where posts.id = p_post_id for update;

  if v_post.id is null then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  if v_post.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'post status changed since it was read';
  end if;

  if v_post.status = p_status then
    raise exception using errcode = '22023', message = 'post already has that status';
  end if;

  -- Rule 2: an author's own removal is theirs. A moderator may delete it
  -- further, never restore what its author withdrew.
  if v_post.status = 'deleted_by_author' and p_status <> 'deleted_by_moderator' then
    raise exception using
      errcode = '22023',
      message = 'a post removed by its author can only be deleted further';
  end if;

  -- `draft` and `pending_review` are the author's workflow, not a moderation
  -- outcome. Sending a published post back to draft would hand a moderator an
  -- edit of someone else's content.
  if p_status in ('draft', 'pending_review') then
    raise exception using
      errcode = '22023',
      message = 'moderation cannot return a post to the author workflow';
  end if;

  v_was_counted := private.post_status_is_counted(v_post.status);
  v_is_counted := private.post_status_is_counted(p_status);

  -- The check constraint from 0007 requires a timestamp for every visible
  -- state. A post that was never published gets one when moderation makes it
  -- visible for the first time.
  v_published_at := case
    when p_status in ('published', 'closed', 'archived')
      then coalesce(v_post.published_at, now())
    else v_post.published_at
  end;

  update public.posts
  set
    status = p_status,
    published_at = v_published_at,
    removed_at = case
      when p_status in ('deleted_by_author', 'deleted_by_moderator') then now()
      else null
    end
  where posts.id = v_post.id;

  if v_was_counted and not v_is_counted then
    update public.plazas
    set posts_count = greatest(plazas.posts_count - 1, 0)
    where plazas.id = v_post.plaza_id;
  elsif v_is_counted and not v_was_counted then
    update public.plazas
    set posts_count = plazas.posts_count + 1
    where plazas.id = v_post.plaza_id;
  end if;

  perform private.write_audit_log(
    v_actor_id,
    'post.status',
    'post',
    v_post.id,
    v_clean_reason,
    jsonb_build_object('status', v_post.status),
    jsonb_build_object('status', p_status),
    jsonb_build_object('plaza_id', v_post.plaza_id, 'author_id', v_post.author_id)
  );

  return query select v_post.id;
end;
$$;

-- Pinning, highlighting and locking edits are presentation and permission, not
-- lifecycle, so they are one RPC that takes all three and cannot contradict
-- `status`. Passing null leaves a flag alone.
create or replace function public.moderation_set_post_flags(
  p_post_id uuid,
  p_reason text,
  p_is_pinned boolean default null,
  p_is_highlighted boolean default null,
  p_edit_locked boolean default null
)
returns table (post_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_post public.posts;
  v_clean_reason text;
  v_pinned boolean;
  v_highlighted boolean;
  v_locked boolean;
begin
  v_actor_id := private.require_permission('moderation.hide');
  v_clean_reason := private.validated_reason(p_reason);

  if p_is_pinned is null and p_is_highlighted is null and p_edit_locked is null then
    raise exception using errcode = '22023', message = 'no flag was given';
  end if;

  select * into v_post from public.posts where posts.id = p_post_id for update;

  if v_post.id is null then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  if v_post.status in ('deleted_by_author', 'deleted_by_moderator') then
    raise exception using errcode = '22023', message = 'a removed post carries no flags';
  end if;

  v_pinned := coalesce(p_is_pinned, v_post.is_pinned);
  v_highlighted := coalesce(p_is_highlighted, v_post.is_highlighted);
  v_locked := coalesce(p_edit_locked, v_post.edit_locked);

  if (v_pinned, v_highlighted, v_locked)
    is not distinct from (v_post.is_pinned, v_post.is_highlighted, v_post.edit_locked) then
    raise exception using errcode = '22023', message = 'the flags already have those values';
  end if;

  update public.posts
  set is_pinned = v_pinned, is_highlighted = v_highlighted, edit_locked = v_locked
  where posts.id = v_post.id;

  perform private.write_audit_log(
    v_actor_id,
    'post.flags',
    'post',
    v_post.id,
    v_clean_reason,
    jsonb_build_object(
      'is_pinned', v_post.is_pinned,
      'is_highlighted', v_post.is_highlighted,
      'edit_locked', v_post.edit_locked
    ),
    jsonb_build_object(
      'is_pinned', v_pinned,
      'is_highlighted', v_highlighted,
      'edit_locked', v_locked
    )
  );

  return query select v_post.id;
end;
$$;

create or replace function public.moderation_move_post(
  p_post_id uuid,
  p_plaza_id uuid,
  p_reason text
)
returns table (post_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_post public.posts;
  v_target public.plazas;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('moderation.hide');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_post from public.posts where posts.id = p_post_id for update;

  if v_post.id is null then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  if v_post.plaza_id = p_plaza_id then
    raise exception using errcode = '22023', message = 'the post is already in that Plaza';
  end if;

  if v_post.status in ('deleted_by_author', 'deleted_by_moderator') then
    raise exception using errcode = '22023', message = 'a removed post cannot be moved';
  end if;

  select * into v_target from public.plazas where plazas.id = p_plaza_id for update;

  if v_target.id is null then
    raise exception using errcode = 'P0002', message = 'plaza not found';
  end if;

  -- An archived Plaza accepts no new posts, and a move is a new post to it.
  if v_target.status <> 'active' then
    raise exception using errcode = '22023', message = 'that Plaza accepts no posts';
  end if;

  update public.posts set plaza_id = v_target.id where posts.id = v_post.id;

  if private.post_status_is_counted(v_post.status) then
    update public.plazas
    set posts_count = greatest(plazas.posts_count - 1, 0)
    where plazas.id = v_post.plaza_id;

    update public.plazas
    set posts_count = plazas.posts_count + 1
    where plazas.id = v_target.id;
  end if;

  perform private.write_audit_log(
    v_actor_id,
    'post.moved',
    'post',
    v_post.id,
    v_clean_reason,
    jsonb_build_object('plaza_id', v_post.plaza_id),
    jsonb_build_object('plaza_id', v_target.id),
    jsonb_build_object('author_id', v_post.author_id)
  );

  return query select v_post.id;
end;
$$;

-- ── Comment transitions ────────────────────────────────────────────────────

create or replace function public.moderation_set_comment_status(
  p_comment_id uuid,
  p_expected_status public.comment_status,
  p_status public.comment_status,
  p_reason text
)
returns table (comment_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_comment public.comments;
  v_clean_reason text;
  v_was_counted boolean;
  v_is_counted boolean;
  v_delta integer;
begin
  v_actor_id := private.require_moderation_permission(p_status::text);
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_comment from public.comments where comments.id = p_comment_id for update;

  if v_comment.id is null then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  if v_comment.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'comment status changed since it was read';
  end if;

  if v_comment.status = p_status then
    raise exception using errcode = '22023', message = 'comment already has that status';
  end if;

  if v_comment.status = 'deleted_by_author' and p_status <> 'deleted_by_moderator' then
    raise exception using
      errcode = '22023',
      message = 'a comment removed by its author can only be deleted further';
  end if;

  update public.comments
  set
    status = p_status,
    removed_at = case
      when p_status in ('deleted_by_author', 'deleted_by_moderator') then now()
      else null
    end
  where comments.id = v_comment.id;

  v_was_counted := private.comment_status_is_counted(v_comment.status);
  v_is_counted := private.comment_status_is_counted(p_status);
  v_delta := v_is_counted::integer - v_was_counted::integer;

  if v_delta <> 0 then
    update public.posts
    set comments_count = greatest(posts.comments_count + v_delta, 0)
    where posts.id = v_comment.post_id;

    -- A reply leaving or rejoining the thread moves its parent's counter with
    -- it. The comment keeps its own `replies_count` either way, so its
    -- surviving replies stay reachable.
    if v_comment.parent_id is not null then
      update public.comments
      set replies_count = greatest(comments.replies_count + v_delta, 0)
      where comments.id = v_comment.parent_id;
    end if;
  end if;

  perform private.write_audit_log(
    v_actor_id,
    'comment.status',
    'comment',
    v_comment.id,
    v_clean_reason,
    jsonb_build_object('status', v_comment.status),
    jsonb_build_object('status', p_status),
    jsonb_build_object('post_id', v_comment.post_id, 'author_id', v_comment.author_id)
  );

  return query select v_comment.id;
end;
$$;

create or replace function public.moderation_set_comment_flags(
  p_comment_id uuid,
  p_reason text,
  p_is_pinned boolean default null,
  p_replies_locked boolean default null
)
returns table (comment_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_comment public.comments;
  v_clean_reason text;
  v_pinned boolean;
  v_locked boolean;
begin
  v_actor_id := private.require_permission('moderation.hide');
  v_clean_reason := private.validated_reason(p_reason);

  if p_is_pinned is null and p_replies_locked is null then
    raise exception using errcode = '22023', message = 'no flag was given';
  end if;

  select * into v_comment from public.comments where comments.id = p_comment_id for update;

  if v_comment.id is null then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  if v_comment.status <> 'published' then
    raise exception using errcode = '22023', message = 'only a published comment carries flags';
  end if;

  v_pinned := coalesce(p_is_pinned, v_comment.is_pinned);
  v_locked := coalesce(p_replies_locked, v_comment.replies_locked);

  if (v_pinned, v_locked) is not distinct from (v_comment.is_pinned, v_comment.replies_locked) then
    raise exception using errcode = '22023', message = 'the flags already have those values';
  end if;

  update public.comments
  set is_pinned = v_pinned, replies_locked = v_locked
  where comments.id = v_comment.id;

  perform private.write_audit_log(
    v_actor_id,
    'comment.flags',
    'comment',
    v_comment.id,
    v_clean_reason,
    jsonb_build_object('is_pinned', v_comment.is_pinned, 'replies_locked', v_comment.replies_locked),
    jsonb_build_object('is_pinned', v_pinned, 'replies_locked', v_locked)
  );

  return query select v_comment.id;
end;
$$;

-- ── Replies obey a locked parent ───────────────────────────────────────────

-- Same signature as 0007's; the only change is the `replies_locked` check.
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

  return query select new_comment_id;
end;
$$;

-- ── Thread reads expose the new flags ──────────────────────────────────────

-- Ordering stays chronological on (created_at, id). A pinned comment is
-- reported, not hoisted: reordering would have to be carried in the keyset
-- cursor, and a thread whose order changes as pins move is worse than a marker
-- the reader can see. If pinned comments ever need to lead the thread, that is
-- a separate RPC, not a change to this cursor.
drop function public.list_post_comments(uuid, timestamptz, uuid, integer);

create or replace function public.list_post_comments(
  p_post_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  post_id uuid,
  parent_id uuid,
  author_id uuid,
  author_display_name text,
  body text,
  status public.comment_status,
  depth smallint,
  replies_count integer,
  likes_count integer,
  dislikes_count integer,
  caller_vote smallint,
  is_removed boolean,
  is_pinned boolean,
  replies_locked boolean,
  can_edit boolean,
  can_reply boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  page_size integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  caller_moderates boolean := private.caller_moderates_content();
begin
  if not private.post_is_visible_to_caller(p_post_id) then
    return;
  end if;

  return query
  select
    comments.id,
    comments.post_id,
    comments.parent_id,
    case
      when comments.status in ('deleted_by_author', 'deleted_by_moderator') then null
      else comments.author_id
    end,
    case
      when comments.status in ('deleted_by_author', 'deleted_by_moderator') then null
      else profiles.display_name
    end,
    case
      when comments.status in ('deleted_by_author', 'deleted_by_moderator', 'hidden', 'quarantined')
        then null
      else comments.body
    end,
    comments.status,
    comments.depth,
    comments.replies_count,
    comments.likes_count,
    comments.dislikes_count,
    coalesce(
      (
        select content_votes.value
        from public.content_votes
        where content_votes.comment_id = comments.id
          and content_votes.voter_id = auth.uid()
      ),
      0::smallint
    ),
    comments.status <> 'published',
    comments.is_pinned,
    comments.replies_locked,
    coalesce(
      comments.author_id = auth.uid()
      and comments.status = 'published'
      and private.user_has_permission(auth.uid(), 'comment.edit.own'),
      false
    ),
    -- Whether the reader may reply to this specific comment. The post's own
    -- state is checked by `create_comment`; this is the per-comment part.
    coalesce(
      comments.status = 'published'
      and not comments.replies_locked
      and comments.depth < 5
      and private.user_has_permission(auth.uid(), 'comment.create'),
      false
    ),
    comments.created_at,
    comments.updated_at
  from public.comments
  join public.profiles on profiles.id = comments.author_id
  where comments.post_id = p_post_id
    and (
      comments.status <> 'quarantined'
      or caller_moderates
      or comments.replies_count > 0
    )
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (comments.created_at, comments.id) > (p_cursor_created_at, p_cursor_id)
    )
  order by comments.created_at, comments.id
  limit page_size;
end;
$$;

-- ── Counter repair covers the thread counters ──────────────────────────────

-- 0008's version repaired Plaza post totals and vote totals but never
-- `comments_count` or `replies_count`, which until now only moved
-- incrementally. Moderation gives them more ways to drift, so the repair
-- function has to know their definition too.
create or replace function private.recalculate_content_counters()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  with post_totals as (
    select plazas.id as plaza_id, count(posts.id) as total
    from public.plazas
    left join public.posts
      on posts.plaza_id = plazas.id
     and posts.status in ('published', 'closed', 'archived')
    group by plazas.id
  )
  update public.plazas
  set posts_count = post_totals.total
  from post_totals
  where plazas.id = post_totals.plaza_id
    and plazas.posts_count is distinct from post_totals.total;

  with vote_totals as (
    select
      posts.id as post_id,
      count(*) filter (where content_votes.value = 1) as likes,
      count(*) filter (where content_votes.value = -1) as dislikes
    from public.posts
    left join public.content_votes on content_votes.post_id = posts.id
    group by posts.id
  )
  update public.posts
  set likes_count = vote_totals.likes,
      dislikes_count = vote_totals.dislikes
  from vote_totals
  where posts.id = vote_totals.post_id
    and (
      posts.likes_count is distinct from vote_totals.likes
      or posts.dislikes_count is distinct from vote_totals.dislikes
    );

  with vote_totals as (
    select
      comments.id as comment_id,
      count(*) filter (where content_votes.value = 1) as likes,
      count(*) filter (where content_votes.value = -1) as dislikes
    from public.comments
    left join public.content_votes on content_votes.comment_id = comments.id
    group by comments.id
  )
  update public.comments
  set likes_count = vote_totals.likes,
      dislikes_count = vote_totals.dislikes
  from vote_totals
  where comments.id = vote_totals.comment_id
    and (
      comments.likes_count is distinct from vote_totals.likes
      or comments.dislikes_count is distinct from vote_totals.dislikes
    );

  with comment_totals as (
    select posts.id as post_id, count(comments.id) as total
    from public.posts
    left join public.comments
      on comments.post_id = posts.id
     and comments.status = 'published'
    group by posts.id
  )
  update public.posts
  set comments_count = comment_totals.total
  from comment_totals
  where posts.id = comment_totals.post_id
    and posts.comments_count is distinct from comment_totals.total;

  with reply_totals as (
    select parents.id as comment_id, count(replies.id) as total
    from public.comments parents
    left join public.comments replies
      on replies.parent_id = parents.id
     and replies.status = 'published'
    group by parents.id
  )
  update public.comments
  set replies_count = reply_totals.total
  from reply_totals
  where comments.id = reply_totals.comment_id
    and comments.replies_count is distinct from reply_totals.total;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function private.require_moderation_permission(text)
  from public, anon, authenticated;
revoke all on function private.post_status_is_counted(public.post_status)
  from public, anon, authenticated;
revoke all on function private.comment_status_is_counted(public.comment_status)
  from public, anon, authenticated;
revoke all on function private.recalculate_content_counters()
  from public, anon, authenticated;

revoke all on function public.moderation_set_post_status(
  uuid, public.post_status, public.post_status, text
) from public, anon, authenticated;
revoke all on function public.moderation_set_post_flags(uuid, text, boolean, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.moderation_move_post(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.moderation_set_comment_status(
  uuid, public.comment_status, public.comment_status, text
) from public, anon, authenticated;
revoke all on function public.moderation_set_comment_flags(uuid, text, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.create_comment(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.list_post_comments(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;

-- Every moderation RPC re-checks its own permission; the grant only says an
-- account is needed to reach one. Reading a thread stays open to anonymous
-- visitors, as it was before this migration.
grant execute on function public.moderation_set_post_status(
  uuid, public.post_status, public.post_status, text
) to authenticated;
grant execute on function public.moderation_set_post_flags(uuid, text, boolean, boolean, boolean)
  to authenticated;
grant execute on function public.moderation_move_post(uuid, uuid, text) to authenticated;
grant execute on function public.moderation_set_comment_status(
  uuid, public.comment_status, public.comment_status, text
) to authenticated;
grant execute on function public.moderation_set_comment_flags(uuid, text, boolean, boolean)
  to authenticated;
grant execute on function public.create_comment(uuid, text, uuid) to authenticated;
grant execute on function public.list_post_comments(uuid, timestamptz, uuid, integer)
  to anon, authenticated;

comment on function public.moderation_set_post_status(
  uuid, public.post_status, public.post_status, text
) is
  'Move a post between moderation states. Compare-and-swap, reason required, audited. A post removed by its author can only be deleted further, never restored.';
comment on function public.moderation_set_comment_status(
  uuid, public.comment_status, public.comment_status, text
) is
  'Move a comment between moderation states. Compare-and-swap, reason required, audited. Adjusts the thread counters in the same transaction.';
comment on function public.moderation_move_post(uuid, uuid, text) is
  'Move a post to another active Plaza, adjusting both post counts. Audited.';
