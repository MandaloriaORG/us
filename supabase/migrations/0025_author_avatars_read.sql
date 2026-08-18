-- 0025: author avatars on read RPCs.
-- The read endpoints (posts, comments, chat messages, clan members)
-- never returned the author avatar, so the UI could only show a
-- fallback initial. This surfaces avatar_path on every read RPC so
-- callers can resolve a short-lived signed storage URL (same pattern
-- as the clan/detail routes). Applies on top of the owning migrations.

-- Signature changes cannot use CREATE OR REPLACE (42P13), so each
-- function is dropped then recreated. The grants are restored after.


-- list_posts
drop function if exists public.list_posts(uuid, text, text, integer, timestamp with time zone, uuid, integer) cascade;

create or replace function public.list_posts(
  p_plaza_id uuid default null,
  p_order text default 'recent',
  p_tag_slug text default null,
  p_cursor_score integer default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  plaza_id uuid,
  plaza_slug text,
  plaza_name text,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  title text,
  excerpt text,
  status public.post_status,
  is_pinned boolean,
  is_highlighted boolean,
  comments_count integer,
  likes_count integer,
  dislikes_count integer,
  score integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 50
as $$
declare
  page_size integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  order_mode text := coalesce(p_order, 'recent');
begin
  if order_mode not in ('recent', 'popular') then
    raise exception using errcode = '22023', message = 'order must be recent or popular';
  end if;

  return query
  select
    posts.id,
    posts.plaza_id,
    plazas.slug,
    plazas.name,
    posts.author_id,
    profiles.display_name,
    profiles.avatar_path,
    posts.title,
    left(posts.body, 280),
    posts.status,
    posts.is_pinned,
    posts.is_highlighted,
    posts.comments_count,
    posts.likes_count,
    posts.dislikes_count,
    posts.likes_count - posts.dislikes_count,
    posts.created_at
  from public.posts
  join public.plazas on plazas.id = posts.plaza_id
  join public.profiles on profiles.id = posts.author_id
  where (p_plaza_id is null or posts.plaza_id = p_plaza_id)
    and posts.status in ('published', 'closed', 'archived')
    and private.plaza_is_visible_to_caller(posts.plaza_id)
    and (
      p_tag_slug is null
      or exists (
        select 1
        from public.post_tags
        join public.tags on tags.id = post_tags.tag_id
        where post_tags.post_id = posts.id
          and tags.slug = p_tag_slug
      )
    )
    and (
      case
        when p_cursor_created_at is null or p_cursor_id is null then true
        when order_mode = 'popular' then
          (posts.likes_count - posts.dislikes_count, posts.created_at, posts.id)
            < (coalesce(p_cursor_score, 0), p_cursor_created_at, p_cursor_id)
        else (posts.created_at, posts.id) < (p_cursor_created_at, p_cursor_id)
      end
    )
  order by
    case when order_mode = 'popular' then posts.likes_count - posts.dislikes_count end desc nulls last,
    posts.created_at desc,
    posts.id desc
  limit page_size;
end;
$$;

grant execute on function public.list_posts(uuid, text, text, integer, timestamp with time zone, uuid, integer) to anon, authenticated;

-- get_post
drop function if exists public.get_post(uuid) cascade;

create or replace function public.get_post(p_post_id uuid)
returns table (
  id uuid,
  plaza_id uuid,
  plaza_slug text,
  plaza_name text,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  title text,
  body text,
  status public.post_status,
  is_pinned boolean,
  is_highlighted boolean,
  edit_locked boolean,
  comments_count integer,
  likes_count integer,
  dislikes_count integer,
  caller_vote smallint,
  caller_bookmarked boolean,
  tag_slugs text[],
  accepts_comments boolean,
  can_edit boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
rows 1000
as $$
  select
    posts.id,
    posts.plaza_id,
    plazas.slug,
    plazas.name,
    posts.author_id,
    profiles.display_name,
    profiles.avatar_path,
    posts.title,
    case
      when posts.status in ('deleted_by_author', 'deleted_by_moderator') then null
      else posts.body
    end,
    posts.status,
    posts.is_pinned,
    posts.is_highlighted,
    posts.edit_locked,
    posts.comments_count,
    posts.likes_count,
    posts.dislikes_count,
    coalesce(
      (
        select content_votes.value
        from public.content_votes
        where content_votes.post_id = posts.id
          and content_votes.voter_id = auth.uid()
      ),
      0::smallint
    ),
    exists (
      select 1
      from public.bookmarks
      where bookmarks.post_id = posts.id
        and bookmarks.user_id = auth.uid()
    ),
    coalesce(
      (
        select array_agg(tags.slug order by tags.slug)
        from public.post_tags
        join public.tags on tags.id = post_tags.tag_id
        where post_tags.post_id = posts.id
      ),
      '{}'::text[]
    ),
    posts.status = 'published' and plazas.status = 'active',
    coalesce(
      posts.author_id = auth.uid()
      and not posts.edit_locked
      and posts.status in ('draft', 'pending_review', 'published')
      and private.user_has_permission(auth.uid(), 'post.edit.own'),
      false
    ),
    posts.created_at,
    posts.updated_at
  from public.posts
  join public.plazas on plazas.id = posts.plaza_id
  join public.profiles on profiles.id = posts.author_id
  where posts.id = p_post_id
    and private.post_is_visible_to_caller(posts.id);
$$;

grant execute on function public.get_post(uuid) to anon, authenticated;

-- list_post_comments
drop function if exists public.list_post_comments(uuid, timestamp with time zone, uuid, integer) cascade;

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
  author_avatar_path text,
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
      when comments.status in ('deleted_by_author', 'deleted_by_moderator') then null
      else profiles.avatar_path
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

grant execute on function public.list_post_comments(uuid, timestamp with time zone, uuid, integer) to anon, authenticated;

-- list_chat_messages
drop function if exists public.list_chat_messages(uuid, timestamptz, uuid, integer, boolean) cascade;

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
  author_avatar_path text,
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
      when messages.status = 'deleted' then null
      else author.avatar_path
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

grant execute on function public.list_chat_messages(uuid, timestamptz, uuid, integer, boolean) to anon, authenticated;

-- list_clan_members
drop function if exists public.list_clan_members(uuid, integer) cascade;

create or replace function public.list_clan_members(
  p_clan_id uuid,
  p_limit integer default 50
)
returns table (
  member_id uuid,
  display_name text,
  avatar_path text,
  role public.clan_member_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if not private.clan_is_visible_to_caller(p_clan_id) then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  return query
  select
    clan_members.member_id,
    profiles.display_name,
    profiles.avatar_path,
    clan_members.role,
    clan_members.joined_at
  from public.clan_members
  join public.profiles on profiles.id = clan_members.member_id
  where clan_members.clan_id = p_clan_id
    and clan_members.status = 'active'
  order by
    case clan_members.role when 'leader' then 0 when 'officer' then 1 else 2 end,
    clan_members.joined_at,
    clan_members.id
  limit v_limit;
end;
$$;

grant execute on function public.list_clan_members(uuid, integer) to anon, authenticated;

-- list_posts_by_author
drop function if exists public.list_posts_by_author(uuid, timestamptz, uuid, integer) cascade;

create or replace function public.list_posts_by_author(
  p_author_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  plaza_id uuid,
  plaza_slug text,
  plaza_name text,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  title text,
  excerpt text,
  status public.post_status,
  is_pinned boolean,
  is_highlighted boolean,
  comments_count integer,
  likes_count integer,
  dislikes_count integer,
  score integer,
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
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if p_author_id is null then
    raise exception using errcode = '22023', message = 'author_id is required';
  end if;

  -- Profile visibility guard (mirrors list_friends semantics).
  if not private.profile_is_visible_to_caller(p_author_id) then
    return;
  end if;

  return query
  select
    posts.id,
    posts.plaza_id,
    plazas.slug,
    plazas.name,
    posts.author_id,
    profiles.display_name,
    profiles.avatar_path,
    posts.title,
    left(posts.body, 280) as excerpt,
    posts.status,
    posts.is_pinned,
    posts.is_highlighted,
    posts.comments_count,
    posts.likes_count,
    posts.dislikes_count,
    posts.likes_count - posts.dislikes_count as score,
    posts.created_at
  from public.posts
  join public.plazas on plazas.id = posts.plaza_id
  join public.profiles on profiles.id = posts.author_id
  where posts.author_id = p_author_id
    and posts.status in ('published'::public.post_status, 'closed'::public.post_status, 'archived'::public.post_status)
    and posts.removed_at is null
    and private.plaza_is_visible_to_caller(posts.plaza_id)
    and (
      v_actor_id is null
      or v_actor_id = p_author_id
      or not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_actor_id and b.blocked_id = p_author_id)
           or (b.blocker_id = p_author_id and b.blocked_id = v_actor_id)
      )
    )
    and (
      p_cursor_created_at is null
      or (posts.created_at, posts.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by posts.created_at desc, posts.id desc
  limit v_limit;
end;
$$;

grant execute on function public.list_posts_by_author(uuid, timestamptz, uuid, integer) to authenticated, anon;
