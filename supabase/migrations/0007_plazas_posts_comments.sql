-- Phase 2, block 1: Plazas, posts and comments.
--
-- Contract notes:
--
-- * Canonical domain language wins over `docs/DATABASE_DESIGN.md`, which still
--   lists a generic `spaces` table. The seeded permission `admin.manage_plazas`
--   from migration 0000 already names the concept, so the table is `plazas`.
-- * Reads are exposed only through minimized SECURITY DEFINER RPCs, following
--   the member and audit-log precedent. The tables themselves stay unreachable
--   from the Data API: RLS is enabled with no policy and no role grant, so both
--   `anon` and `authenticated` are denied by default.
-- * Removal is a soft state transition. Rows survive so replies keep their
--   context and moderation stays reversible; the read RPCs blank the body of
--   removed content instead of dropping the row.
-- * `is_pinned`, `is_highlighted` and `edit_locked` are flags, not lifecycle
--   states. They are orthogonal to `status` and never contradict it.
-- * Vote, reaction, bookmark and tag contracts arrive in the next block, so the
--   `popular` ordering mode is deliberately absent here.

-- ── Enums ──────────────────────────────────────────────────────────────────

create type public.plaza_visibility as enum ('public', 'members', 'private');

create type public.plaza_status as enum ('active', 'archived');

create type public.post_status as enum (
  'draft',
  'pending_review',
  'published',
  'closed',
  'hidden',
  'quarantined',
  'deleted_by_author',
  'deleted_by_moderator',
  'archived'
);

create type public.comment_status as enum (
  'published',
  'hidden',
  'quarantined',
  'deleted_by_author',
  'deleted_by_moderator'
);

-- ── Tables ─────────────────────────────────────────────────────────────────

create table public.plazas (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint plazas_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  name text not null
    constraint plazas_name_length check (char_length(btrim(name)) between 2 and 80),
  description text
    constraint plazas_description_length check (description is null or char_length(description) <= 500),
  rules text
    constraint plazas_rules_length check (rules is null or char_length(rules) <= 4000),
  visibility public.plaza_visibility not null default 'public',
  status public.plaza_status not null default 'active',
  sort_order integer not null default 0,
  -- When set, only actors holding this permission may post in the plaza.
  required_post_permission text references public.permissions (name)
    on update cascade on delete restrict,
  posts_count integer not null default 0 check (posts_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plazas_listing_idx on public.plazas (status, sort_order, name);

create table public.posts (
  id uuid primary key default extensions.uuid_generate_v4(),
  plaza_id uuid not null references public.plazas (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null
    constraint posts_title_length check (char_length(btrim(title)) between 3 and 300),
  body text not null
    constraint posts_body_length check (char_length(btrim(body)) between 1 and 40000),
  status public.post_status not null default 'published',
  is_pinned boolean not null default false,
  is_highlighted boolean not null default false,
  edit_locked boolean not null default false,
  comments_count integer not null default 0 check (comments_count >= 0),
  published_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Removed posts keep whatever `published_at` they had, so a removed draft
  -- stays representable.
  constraint posts_published_at_matches_status check (
    case
      when status in ('draft', 'pending_review') then published_at is null
      when status in ('published', 'closed', 'archived') then published_at is not null
      else true
    end
  ),
  constraint posts_removed_at_matches_status check (
    (status in ('deleted_by_author', 'deleted_by_moderator')) = (removed_at is not null)
  )
);

create index posts_plaza_recent_idx
  on public.posts (plaza_id, is_pinned desc, created_at desc, id desc);
create index posts_feed_recent_idx on public.posts (created_at desc, id desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_highlighted_idx on public.posts (is_highlighted, created_at desc)
  where is_highlighted;

create table public.comments (
  id uuid primary key default extensions.uuid_generate_v4(),
  post_id uuid not null references public.posts (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    constraint comments_body_length check (char_length(btrim(body)) between 1 and 10000),
  status public.comment_status not null default 'published',
  depth smallint not null default 0 check (depth between 0 and 5),
  replies_count integer not null default 0 check (replies_count >= 0),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_removed_at_matches_status check (
    (status in ('deleted_by_author', 'deleted_by_moderator')) = (removed_at is not null)
  )
);

create index comments_post_thread_idx on public.comments (post_id, created_at, id);
create index comments_parent_idx on public.comments (parent_id, created_at, id);
create index comments_author_idx on public.comments (author_id, created_at desc);

create trigger plazas_set_updated_at
  before update on public.plazas
  for each row execute function public.update_updated_at();

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.update_updated_at();

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.update_updated_at();

-- ── Deny-by-default exposure ───────────────────────────────────────────────

alter table public.plazas enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;

revoke all on table public.plazas from public, anon, authenticated;
revoke all on table public.posts from public, anon, authenticated;
revoke all on table public.comments from public, anon, authenticated;

grant all on table public.plazas to service_role;
grant all on table public.posts to service_role;
grant all on table public.comments to service_role;

-- ── Visibility helpers ─────────────────────────────────────────────────────

create or replace function private.plaza_is_visible_to_caller(p_plaza_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plaza_visibility public.plaza_visibility;
  actor_id uuid := auth.uid();
begin
  select plazas.visibility into plaza_visibility
  from public.plazas
  where plazas.id = p_plaza_id;

  if plaza_visibility is null then
    return false;
  end if;

  if plaza_visibility = 'public' then
    return true;
  end if;

  if actor_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = actor_id
      and profiles.status = 'active'
  ) then
    return false;
  end if;

  if plaza_visibility = 'members' then
    return true;
  end if;

  return private.user_has_permission(actor_id, 'admin.manage_plazas');
end;
$$;

-- True when the caller may see content that is hidden or quarantined.
create or replace function private.caller_moderates_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.user_has_permission(auth.uid(), 'moderation.hide');
$$;

create or replace function private.post_is_visible_to_caller(p_post_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  post_row public.posts;
begin
  select * into post_row from public.posts where posts.id = p_post_id;

  if post_row.id is null then
    return false;
  end if;

  if not private.plaza_is_visible_to_caller(post_row.plaza_id) then
    return false;
  end if;

  if post_row.status in ('published', 'closed', 'archived') then
    return true;
  end if;

  -- Removed content stays addressable so replies keep their context; the read
  -- RPCs blank its body.
  if post_row.status in ('deleted_by_author', 'deleted_by_moderator') then
    return true;
  end if;

  if post_row.author_id = auth.uid() then
    return true;
  end if;

  return private.caller_moderates_content();
end;
$$;

revoke all on function private.plaza_is_visible_to_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.caller_moderates_content()
  from public, anon, authenticated;
revoke all on function private.post_is_visible_to_caller(uuid)
  from public, anon, authenticated;

-- ── Rate limits ────────────────────────────────────────────────────────────

-- Counted against the source tables rather than a separate hit log, so a
-- rejected attempt leaves no row and an accepted one is never double counted.
-- Already accepted requests are unaffected when a limit changes.
create or replace function private.enforce_post_rate_limit(p_author_id uuid)
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
  from public.posts
  where posts.author_id = p_author_id
    and posts.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception using
      errcode = '53400',
      message = 'post rate limit reached, try again later';
  end if;
end;
$$;

create or replace function private.enforce_comment_rate_limit(p_author_id uuid)
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
  from public.comments
  where comments.author_id = p_author_id
    and comments.created_at > now() - interval '1 hour';

  if recent_count >= 30 then
    raise exception using
      errcode = '53400',
      message = 'comment rate limit reached, try again later';
  end if;
end;
$$;

revoke all on function private.enforce_post_rate_limit(uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_comment_rate_limit(uuid)
  from public, anon, authenticated;

-- ── Counter recalculation ──────────────────────────────────────────────────

-- Counters are maintained inside the mutating RPCs, in the same transaction as
-- their source rows. This function exists to repair drift; it is never the
-- authority for a decision.
create or replace function private.recalculate_content_counters()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.recalculate_content_counters()
  from public, anon, authenticated;

-- ── Plaza reads ────────────────────────────────────────────────────────────

create or replace function public.list_plazas()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  visibility public.plaza_visibility,
  status public.plaza_status,
  sort_order integer,
  posts_count integer
)
language sql
stable
security definer
set search_path = ''
rows 100
as $$
  select
    plazas.id,
    plazas.slug,
    plazas.name,
    plazas.description,
    plazas.visibility,
    plazas.status,
    plazas.sort_order,
    plazas.posts_count
  from public.plazas
  where private.plaza_is_visible_to_caller(plazas.id)
  order by plazas.sort_order, plazas.name;
$$;

create or replace function public.get_plaza(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  rules text,
  visibility public.plaza_visibility,
  status public.plaza_status,
  posts_count integer,
  can_post boolean
)
language sql
stable
security definer
set search_path = ''
rows 1000
as $$
  select
    plazas.id,
    plazas.slug,
    plazas.name,
    plazas.description,
    plazas.rules,
    plazas.visibility,
    plazas.status,
    plazas.posts_count,
    plazas.status = 'active'
      and auth.uid() is not null
      and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.status = 'active'
      )
      and private.user_has_permission(auth.uid(), 'post.create')
      and (
        plazas.required_post_permission is null
        or private.user_has_permission(auth.uid(), plazas.required_post_permission)
      ) as can_post
  from public.plazas
  where plazas.slug = p_slug
    and private.plaza_is_visible_to_caller(plazas.id);
$$;

-- ── Post reads ─────────────────────────────────────────────────────────────

-- Keyset pagination over (created_at, id). `p_plaza_id` null lists the main
-- feed. Ordering is strictly recency: pinning is a flag on the row, and a
-- pinned-first listing must be a separate bounded query so it cannot corrupt
-- the cursor window.
create or replace function public.list_posts(
  p_plaza_id uuid default null,
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
  title text,
  excerpt text,
  status public.post_status,
  is_pinned boolean,
  is_highlighted boolean,
  comments_count integer,
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
begin
  return query
  select
    posts.id,
    posts.plaza_id,
    plazas.slug,
    plazas.name,
    posts.author_id,
    profiles.display_name,
    posts.title,
    case
      when posts.status in ('deleted_by_author', 'deleted_by_moderator') then null
      else left(posts.body, 280)
    end,
    posts.status,
    posts.is_pinned,
    posts.is_highlighted,
    posts.comments_count,
    posts.created_at
  from public.posts
  join public.plazas on plazas.id = posts.plaza_id
  join public.profiles on profiles.id = posts.author_id
  where (p_plaza_id is null or posts.plaza_id = p_plaza_id)
    and posts.status in ('published', 'closed', 'archived')
    and private.plaza_is_visible_to_caller(posts.plaza_id)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (posts.created_at, posts.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by posts.created_at desc, posts.id desc
  limit page_size;
end;
$$;

create or replace function public.get_post(p_post_id uuid)
returns table (
  id uuid,
  plaza_id uuid,
  plaza_slug text,
  plaza_name text,
  author_id uuid,
  author_display_name text,
  title text,
  body text,
  status public.post_status,
  is_pinned boolean,
  is_highlighted boolean,
  edit_locked boolean,
  comments_count integer,
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
    posts.status = 'published' and plazas.status = 'active' as accepts_comments,
    coalesce(
      posts.author_id = auth.uid()
      and not posts.edit_locked
      and posts.status in ('draft', 'pending_review', 'published')
      and private.user_has_permission(auth.uid(), 'post.edit.own'),
      false
    ) as can_edit,
    posts.created_at,
    posts.updated_at
  from public.posts
  join public.plazas on plazas.id = posts.plaza_id
  join public.profiles on profiles.id = posts.author_id
  where posts.id = p_post_id
    and private.post_is_visible_to_caller(posts.id);
$$;

-- ── Comment reads ──────────────────────────────────────────────────────────

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
  is_removed boolean,
  can_edit boolean,
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
    comments.status <> 'published' as is_removed,
    coalesce(
      comments.author_id = auth.uid()
      and comments.status = 'published'
      and private.user_has_permission(auth.uid(), 'comment.edit.own'),
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

-- ── Post writes ────────────────────────────────────────────────────────────

create or replace function public.create_post(
  p_plaza_id uuid,
  p_title text,
  p_body text,
  p_publish boolean default true
)
returns table (post_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  plaza_row public.plazas;
  clean_title text := btrim(coalesce(p_title, ''));
  clean_body text := btrim(coalesce(p_body, ''));
  new_status public.post_status;
  new_post_id uuid;
begin
  actor_id := private.require_permission('post.create');

  select * into plaza_row
  from public.plazas
  where plazas.id = p_plaza_id
  for update;

  if plaza_row.id is null or not private.plaza_is_visible_to_caller(plaza_row.id) then
    raise exception using errcode = 'P0002', message = 'plaza not found';
  end if;

  if plaza_row.status <> 'active' then
    raise exception using errcode = '42501', message = 'plaza is archived';
  end if;

  if plaza_row.required_post_permission is not null
     and not private.user_has_permission(actor_id, plaza_row.required_post_permission) then
    raise exception using errcode = '42501', message = 'permission denied';
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

  perform private.enforce_post_rate_limit(actor_id);

  new_status := case when coalesce(p_publish, true) then 'published' else 'draft' end;

  insert into public.posts (plaza_id, author_id, title, body, status, published_at)
  values (
    plaza_row.id,
    actor_id,
    clean_title,
    clean_body,
    new_status,
    case when new_status = 'published' then now() else null end
  )
  returning posts.id into new_post_id;

  if new_status = 'published' then
    update public.plazas
    set posts_count = plazas.posts_count + 1
    where plazas.id = plaza_row.id;
  end if;

  return query select new_post_id;
end;
$$;

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

  update public.posts
  set title = clean_title,
      body = clean_body
  where posts.id = post_row.id;

  return query select post_row.id;
end;
$$;

create or replace function public.delete_own_post(p_post_id uuid)
returns table (post_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  post_row public.posts;
begin
  actor_id := private.require_permission('post.delete.own');

  select * into post_row from public.posts where posts.id = p_post_id for update;

  if post_row.id is null or not private.post_is_visible_to_caller(post_row.id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  if post_row.author_id <> actor_id then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if post_row.status in ('deleted_by_author', 'deleted_by_moderator') then
    raise exception using errcode = '42501', message = 'post is already removed';
  end if;

  update public.posts
  set status = 'deleted_by_author',
      removed_at = now()
  where posts.id = post_row.id;

  if post_row.status in ('published', 'closed', 'archived') then
    update public.plazas
    set posts_count = greatest(plazas.posts_count - 1, 0)
    where plazas.id = post_row.plaza_id;
  end if;

  return query select post_row.id;
end;
$$;

-- ── Comment writes ─────────────────────────────────────────────────────────

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

  update public.comments
  set body = clean_body
  where comments.id = comment_row.id;

  return query select comment_row.id;
end;
$$;

create or replace function public.delete_own_comment(p_comment_id uuid)
returns table (comment_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  comment_row public.comments;
begin
  actor_id := private.require_permission('comment.delete.own');

  select * into comment_row from public.comments where comments.id = p_comment_id for update;

  if comment_row.id is null or not private.post_is_visible_to_caller(comment_row.post_id) then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  if comment_row.author_id <> actor_id then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if comment_row.status in ('deleted_by_author', 'deleted_by_moderator') then
    raise exception using errcode = '42501', message = 'comment is already removed';
  end if;

  update public.comments
  set status = 'deleted_by_author',
      removed_at = now()
  where comments.id = comment_row.id;

  update public.posts
  set comments_count = greatest(posts.comments_count - 1, 0)
  where posts.id = comment_row.post_id;

  -- The reply itself is gone from the visible thread, so its parent's counter
  -- drops with it. The removed comment keeps its own `replies_count` so its
  -- surviving replies stay reachable.
  if comment_row.parent_id is not null then
    update public.comments
    set replies_count = greatest(comments.replies_count - 1, 0)
    where comments.id = comment_row.parent_id;
  end if;

  return query select comment_row.id;
end;
$$;

-- ── Plaza administration ───────────────────────────────────────────────────

create or replace function public.admin_create_plaza(
  p_slug text,
  p_name text,
  p_description text default null,
  p_visibility public.plaza_visibility default 'public',
  p_sort_order integer default 0
)
returns table (plaza_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  new_plaza_id uuid;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(coalesce(p_name, ''));
begin
  actor_id := private.require_permission('admin.manage_plazas');

  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  insert into public.plazas (slug, name, description, visibility, sort_order)
  values (clean_slug, clean_name, nullif(btrim(p_description), ''), p_visibility, coalesce(p_sort_order, 0))
  returning plazas.id into new_plaza_id;

  perform private.write_audit_log(
    actor_id,
    'plaza.create',
    'plaza',
    new_plaza_id,
    null,
    null,
    jsonb_build_object('slug', clean_slug, 'name', clean_name, 'visibility', p_visibility)
  );

  return query select new_plaza_id;
end;
$$;

create or replace function public.admin_update_plaza(
  p_plaza_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_rules text,
  p_visibility public.plaza_visibility,
  p_sort_order integer
)
returns table (plaza_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  plaza_row public.plazas;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(coalesce(p_name, ''));
begin
  actor_id := private.require_permission('admin.manage_plazas');

  select * into plaza_row from public.plazas where plazas.id = p_plaza_id for update;

  if plaza_row.id is null then
    raise exception using errcode = 'P0002', message = 'plaza not found';
  end if;

  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  update public.plazas
  set slug = clean_slug,
      name = clean_name,
      description = nullif(btrim(p_description), ''),
      rules = nullif(btrim(p_rules), ''),
      visibility = p_visibility,
      sort_order = coalesce(p_sort_order, plaza_row.sort_order)
  where plazas.id = plaza_row.id;

  perform private.write_audit_log(
    actor_id,
    'plaza.update',
    'plaza',
    plaza_row.id,
    null,
    jsonb_build_object(
      'slug', plaza_row.slug,
      'name', plaza_row.name,
      'visibility', plaza_row.visibility,
      'sort_order', plaza_row.sort_order
    ),
    jsonb_build_object(
      'slug', clean_slug,
      'name', clean_name,
      'visibility', p_visibility,
      'sort_order', coalesce(p_sort_order, plaza_row.sort_order)
    )
  );

  return query select plaza_row.id;
end;
$$;

create or replace function public.admin_set_plaza_status(
  p_plaza_id uuid,
  p_expected_status public.plaza_status,
  p_status public.plaza_status,
  p_reason text
)
returns table (plaza_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  plaza_row public.plazas;
  clean_reason text;
begin
  actor_id := private.require_permission('admin.manage_plazas');
  clean_reason := private.validated_reason(p_reason);

  select * into plaza_row from public.plazas where plazas.id = p_plaza_id for update;

  if plaza_row.id is null then
    raise exception using errcode = 'P0002', message = 'plaza not found';
  end if;

  if plaza_row.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'plaza status changed since it was read';
  end if;

  if plaza_row.status = p_status then
    raise exception using errcode = '22023', message = 'plaza already has that status';
  end if;

  update public.plazas
  set status = p_status
  where plazas.id = plaza_row.id;

  perform private.write_audit_log(
    actor_id,
    'plaza.status',
    'plaza',
    plaza_row.id,
    clean_reason,
    jsonb_build_object('status', plaza_row.status),
    jsonb_build_object('status', p_status)
  );

  return query select plaza_row.id;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.list_plazas() from public, anon, authenticated;
revoke all on function public.get_plaza(text) from public, anon, authenticated;
revoke all on function public.list_posts(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_post(uuid) from public, anon, authenticated;
revoke all on function public.list_post_comments(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.create_post(uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.update_own_post(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.delete_own_post(uuid) from public, anon, authenticated;
revoke all on function public.create_comment(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_own_comment(uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_own_comment(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_plaza(
  text, text, text, public.plaza_visibility, integer
) from public, anon, authenticated;
revoke all on function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer
) from public, anon, authenticated;
revoke all on function public.admin_set_plaza_status(
  uuid, public.plaza_status, public.plaza_status, text
) from public, anon, authenticated;

-- Anonymous visitors read public plazas and their published content only; every
-- other RPC requires an authenticated, active actor.
grant execute on function public.list_plazas() to anon, authenticated;
grant execute on function public.get_plaza(text) to anon, authenticated;
grant execute on function public.list_posts(uuid, timestamptz, uuid, integer)
  to anon, authenticated;
grant execute on function public.get_post(uuid) to anon, authenticated;
grant execute on function public.list_post_comments(uuid, timestamptz, uuid, integer)
  to anon, authenticated;

grant execute on function public.create_post(uuid, text, text, boolean) to authenticated;
grant execute on function public.update_own_post(uuid, text, text) to authenticated;
grant execute on function public.delete_own_post(uuid) to authenticated;
grant execute on function public.create_comment(uuid, text, uuid) to authenticated;
grant execute on function public.update_own_comment(uuid, text) to authenticated;
grant execute on function public.delete_own_comment(uuid) to authenticated;
grant execute on function public.admin_create_plaza(
  text, text, text, public.plaza_visibility, integer
) to authenticated;
grant execute on function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer
) to authenticated;
grant execute on function public.admin_set_plaza_status(
  uuid, public.plaza_status, public.plaza_status, text
) to authenticated;

-- ── Canonical plazas ───────────────────────────────────────────────────────

insert into public.plazas (slug, name, description, visibility, sort_order, required_post_permission)
values
  ('central-plaza', 'Central Plaza', 'General gathering point for the community.', 'public', 10, null),
  ('initiates-questions', 'Initiate''s Questions', 'Questions from new members, answered without condescension.', 'public', 20, null),
  ('mandalorian-philosophy', 'Mandalorian Philosophy', 'Discussion of the ideas that hold the culture together.', 'public', 30, null),
  ('the-way', 'The Way', 'Practice, discipline, and how the creed is lived.', 'public', 40, null),
  ('debates-and-discussion', 'Debates and Discussion', 'Structured disagreement in good faith.', 'public', 50, null),
  ('lore-and-culture', 'Lore and Culture', 'History, language, symbols, and traditions.', 'public', 60, null),
  ('creative-forge', 'Creative Forge', 'Work made by the community: craft, art, writing, and design.', 'public', 70, null),
  ('council-announcements', 'Council Announcements', 'Official decisions and notices from the Council.', 'public', 5, 'admin.manage_plazas'),
  ('tavern', 'Tavern', 'Off-topic conversation and daily life.', 'public', 80, null);
