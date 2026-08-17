-- list_posts_by_author: paginated posts by author_id (for member profile pages).
-- Reuses the same row shape as list_posts so the UI can render with PostSummary.
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

revoke all on function public.list_posts_by_author(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_posts_by_author(uuid, timestamptz, uuid, integer) to authenticated, anon;

-- count_author_posts: cheap count for profile header.
create or replace function public.count_author_posts(p_author_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_total integer;
begin
  if p_author_id is null then
    return 0;
  end if;

  if not private.profile_is_visible_to_caller(p_author_id) then
    return 0;
  end if;

  select count(*)::integer
    into v_total
  from public.posts
  where posts.author_id = p_author_id
    and posts.status in ('published'::public.post_status, 'closed'::public.post_status, 'archived'::public.post_status)
    and posts.removed_at is null
    and (
      v_actor_id is null
      or v_actor_id = p_author_id
      or not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_actor_id and b.blocked_id = p_author_id)
           or (b.blocker_id = p_author_id and b.blocked_id = v_actor_id)
      )
    );

  return coalesce(v_total, 0);
end;
$$;

revoke all on function public.count_author_posts(uuid) from public, anon;
grant execute on function public.count_author_posts(uuid) to authenticated, anon;