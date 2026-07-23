-- Phase 2, block 2: votes, reactions, bookmarks and tags.
--
-- Contract notes:
--
-- * `reactions` is the admin-configured catalog and `content_reactions` holds
--   the instances, matching the naming already used in `docs/DATABASE_DESIGN.md`.
-- * Votes and reactions both target either a post or a comment. One nullable
--   foreign key per target plus an "exactly one" check keeps referential
--   integrity that a generic (content_type, content_id) pair cannot provide.
-- * A vote is single-valued per actor and target. Casting, changing and
--   removing it are the same idempotent RPC, so a duplicate vote is impossible
--   by construction rather than by a uniqueness error surfaced to the caller.
-- * Counters stay denormalized for reads and are written in the same
--   transaction as their source row. They are never authorization evidence.
-- * The block-1 read RPCs are dropped and recreated because their result
--   columns grow; PostgreSQL cannot change OUT parameters in place.

-- ── Counter columns ────────────────────────────────────────────────────────

alter table public.posts
  add column likes_count integer not null default 0 check (likes_count >= 0),
  add column dislikes_count integer not null default 0 check (dislikes_count >= 0);

alter table public.comments
  add column likes_count integer not null default 0 check (likes_count >= 0),
  add column dislikes_count integer not null default 0 check (dislikes_count >= 0);

-- ── Votes ──────────────────────────────────────────────────────────────────

create table public.content_votes (
  id uuid primary key default extensions.uuid_generate_v4(),
  voter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_votes_single_target check (
    (post_id is not null)::integer + (comment_id is not null)::integer = 1
  )
);

create unique index content_votes_post_voter_idx
  on public.content_votes (voter_id, post_id)
  where post_id is not null;
create unique index content_votes_comment_voter_idx
  on public.content_votes (voter_id, comment_id)
  where comment_id is not null;

-- ── Reaction catalog and instances ─────────────────────────────────────────

create table public.reactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  key text not null unique
    constraint reactions_key_format
    check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) between 2 and 32),
  label text not null
    constraint reactions_label_length check (char_length(btrim(label)) between 2 and 40),
  emoji text not null
    constraint reactions_emoji_length check (char_length(emoji) between 1 and 8),
  is_active boolean not null default true,
  affects_reputation boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reactions_active_idx on public.reactions (is_active, sort_order);

create table public.content_reactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  reaction_id uuid not null references public.reactions (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint content_reactions_single_target check (
    (post_id is not null)::integer + (comment_id is not null)::integer = 1
  )
);

create unique index content_reactions_post_actor_idx
  on public.content_reactions (actor_id, post_id, reaction_id)
  where post_id is not null;
create unique index content_reactions_comment_actor_idx
  on public.content_reactions (actor_id, comment_id, reaction_id)
  where comment_id is not null;
create index content_reactions_post_idx
  on public.content_reactions (post_id, reaction_id)
  where post_id is not null;
create index content_reactions_comment_idx
  on public.content_reactions (comment_id, reaction_id)
  where comment_id is not null;

-- ── Bookmarks ──────────────────────────────────────────────────────────────

create table public.bookmarks (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index bookmarks_user_recent_idx on public.bookmarks (user_id, created_at desc);

-- ── Tags ───────────────────────────────────────────────────────────────────

create table public.tags (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint tags_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 32),
  label text not null
    constraint tags_label_length check (char_length(btrim(label)) between 2 and 40),
  created_at timestamptz not null default now()
);

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create index post_tags_tag_idx on public.post_tags (tag_id, post_id);

create trigger content_votes_set_updated_at
  before update on public.content_votes
  for each row execute function public.update_updated_at();

create trigger reactions_set_updated_at
  before update on public.reactions
  for each row execute function public.update_updated_at();

-- ── Deny-by-default exposure ───────────────────────────────────────────────

alter table public.content_votes enable row level security;
alter table public.reactions enable row level security;
alter table public.content_reactions enable row level security;
alter table public.bookmarks enable row level security;
alter table public.tags enable row level security;
alter table public.post_tags enable row level security;

revoke all on table public.content_votes from public, anon, authenticated;
revoke all on table public.reactions from public, anon, authenticated;
revoke all on table public.content_reactions from public, anon, authenticated;
revoke all on table public.bookmarks from public, anon, authenticated;
revoke all on table public.tags from public, anon, authenticated;
revoke all on table public.post_tags from public, anon, authenticated;

grant all on table public.content_votes to service_role;
grant all on table public.reactions to service_role;
grant all on table public.content_reactions to service_role;
grant all on table public.bookmarks to service_role;
grant all on table public.tags to service_role;
grant all on table public.post_tags to service_role;

-- ── Shared guards ──────────────────────────────────────────────────────────

-- Engagement on removed content is refused. Removal is a status transition, so
-- these check the status rather than the row's existence.
create or replace function private.post_accepts_engagement(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts
    where posts.id = p_post_id
      and posts.status in ('published', 'closed')
      and private.post_is_visible_to_caller(posts.id)
  );
$$;

create or replace function private.comment_accepts_engagement(p_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comments
    where comments.id = p_comment_id
      and comments.status = 'published'
      and private.post_is_visible_to_caller(comments.post_id)
  );
$$;

create or replace function private.enforce_engagement_rate_limit(p_actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select
    (
      select count(*)
      from public.content_votes
      where content_votes.voter_id = p_actor_id
        and content_votes.updated_at > now() - interval '1 hour'
    )
    + (
      select count(*)
      from public.content_reactions
      where content_reactions.actor_id = p_actor_id
        and content_reactions.created_at > now() - interval '1 hour'
    )
  into recent_count;

  if recent_count >= 120 then
    raise exception using
      errcode = '53400',
      message = 'engagement rate limit reached, try again later';
  end if;
end;
$$;

revoke all on function private.post_accepts_engagement(uuid)
  from public, anon, authenticated;
revoke all on function private.comment_accepts_engagement(uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_engagement_rate_limit(uuid)
  from public, anon, authenticated;

-- ── Vote writes ────────────────────────────────────────────────────────────

-- `p_value` of 1 or -1 casts or changes the vote; 0 removes it. The same call
-- is therefore safe to repeat and cannot produce a duplicate.
create or replace function public.set_post_vote(
  p_post_id uuid,
  p_value smallint
)
returns table (likes_count integer, dislikes_count integer, caller_vote smallint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  previous_value smallint;
  like_delta integer := 0;
  dislike_delta integer := 0;
begin
  actor_id := private.require_permission('react.create');

  if p_value is null or p_value not in (-1, 0, 1) then
    raise exception using errcode = '22023', message = 'vote must be -1, 0 or 1';
  end if;

  if not private.post_accepts_engagement(p_post_id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  perform private.enforce_engagement_rate_limit(actor_id);

  -- Lock the counter row first so concurrent votes on the same post serialize.
  perform 1 from public.posts where posts.id = p_post_id for update;

  select content_votes.value into previous_value
  from public.content_votes
  where content_votes.voter_id = actor_id
    and content_votes.post_id = p_post_id
  for update;

  if coalesce(previous_value, 0::smallint) = p_value then
    return query
      select posts.likes_count, posts.dislikes_count, coalesce(previous_value, 0::smallint)
      from public.posts
      where posts.id = p_post_id;
    return;
  end if;

  if previous_value = 1 then
    like_delta := like_delta - 1;
  elsif previous_value = -1 then
    dislike_delta := dislike_delta - 1;
  end if;

  if p_value = 1 then
    like_delta := like_delta + 1;
  elsif p_value = -1 then
    dislike_delta := dislike_delta + 1;
  end if;

  if p_value = 0 then
    delete from public.content_votes
    where content_votes.voter_id = actor_id
      and content_votes.post_id = p_post_id;
  elsif previous_value is null then
    insert into public.content_votes (voter_id, post_id, value)
    values (actor_id, p_post_id, p_value);
  else
    update public.content_votes
    set value = p_value
    where content_votes.voter_id = actor_id
      and content_votes.post_id = p_post_id;
  end if;

  update public.posts
  set likes_count = greatest(posts.likes_count + like_delta, 0),
      dislikes_count = greatest(posts.dislikes_count + dislike_delta, 0)
  where posts.id = p_post_id;

  return query
    select posts.likes_count, posts.dislikes_count, p_value
    from public.posts
    where posts.id = p_post_id;
end;
$$;

create or replace function public.set_comment_vote(
  p_comment_id uuid,
  p_value smallint
)
returns table (likes_count integer, dislikes_count integer, caller_vote smallint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  previous_value smallint;
  like_delta integer := 0;
  dislike_delta integer := 0;
begin
  actor_id := private.require_permission('react.create');

  if p_value is null or p_value not in (-1, 0, 1) then
    raise exception using errcode = '22023', message = 'vote must be -1, 0 or 1';
  end if;

  if not private.comment_accepts_engagement(p_comment_id) then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  perform private.enforce_engagement_rate_limit(actor_id);

  perform 1 from public.comments where comments.id = p_comment_id for update;

  select content_votes.value into previous_value
  from public.content_votes
  where content_votes.voter_id = actor_id
    and content_votes.comment_id = p_comment_id
  for update;

  if coalesce(previous_value, 0::smallint) = p_value then
    return query
      select comments.likes_count, comments.dislikes_count, coalesce(previous_value, 0::smallint)
      from public.comments
      where comments.id = p_comment_id;
    return;
  end if;

  if previous_value = 1 then
    like_delta := like_delta - 1;
  elsif previous_value = -1 then
    dislike_delta := dislike_delta - 1;
  end if;

  if p_value = 1 then
    like_delta := like_delta + 1;
  elsif p_value = -1 then
    dislike_delta := dislike_delta + 1;
  end if;

  if p_value = 0 then
    delete from public.content_votes
    where content_votes.voter_id = actor_id
      and content_votes.comment_id = p_comment_id;
  elsif previous_value is null then
    insert into public.content_votes (voter_id, comment_id, value)
    values (actor_id, p_comment_id, p_value);
  else
    update public.content_votes
    set value = p_value
    where content_votes.voter_id = actor_id
      and content_votes.comment_id = p_comment_id;
  end if;

  update public.comments
  set likes_count = greatest(comments.likes_count + like_delta, 0),
      dislikes_count = greatest(comments.dislikes_count + dislike_delta, 0)
  where comments.id = p_comment_id;

  return query
    select comments.likes_count, comments.dislikes_count, p_value
    from public.comments
    where comments.id = p_comment_id;
end;
$$;

-- ── Reaction writes ────────────────────────────────────────────────────────

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
    values (reaction_row.id, v_actor_id, p_post_id);
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
    values (reaction_row.id, v_actor_id, p_comment_id);
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

create or replace function public.list_reaction_types()
returns table (key text, label text, emoji text, sort_order integer)
language sql
stable
security definer
set search_path = ''
rows 50
as $$
  select reactions.key, reactions.label, reactions.emoji, reactions.sort_order
  from public.reactions
  where reactions.is_active
  order by reactions.sort_order, reactions.label;
$$;

-- ── Bookmark writes ────────────────────────────────────────────────────────

create or replace function public.toggle_bookmark(p_post_id uuid)
returns table (bookmarked boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  removed boolean;
begin
  actor_id := private.require_permission('bookmark.create');

  if not private.post_is_visible_to_caller(p_post_id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  delete from public.bookmarks
  where bookmarks.user_id = actor_id
    and bookmarks.post_id = p_post_id;

  removed := found;

  if not removed then
    insert into public.bookmarks (user_id, post_id)
    values (actor_id, p_post_id);
  end if;

  return query select not removed;
end;
$$;

create or replace function public.list_own_bookmarks(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  post_id uuid,
  plaza_slug text,
  title text,
  author_display_name text,
  bookmarked_at timestamptz,
  bookmark_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
rows 50
as $$
declare
  actor_id uuid;
  page_size integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  actor_id := private.require_active_actor();

  return query
  select
    posts.id,
    plazas.slug,
    posts.title,
    profiles.display_name,
    bookmarks.created_at,
    bookmarks.id
  from public.bookmarks
  join public.posts on posts.id = bookmarks.post_id
  join public.plazas on plazas.id = posts.plaza_id
  join public.profiles on profiles.id = posts.author_id
  where bookmarks.user_id = actor_id
    and private.post_is_visible_to_caller(posts.id)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (bookmarks.created_at, bookmarks.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by bookmarks.created_at desc, bookmarks.id desc
  limit page_size;
end;
$$;

-- ── Tag writes ─────────────────────────────────────────────────────────────

-- Tags are attached by the post's author in one call that replaces the whole
-- set. Unknown slugs are created, so the vocabulary grows from real use instead
-- of requiring an admin screen before the feature is usable.
create or replace function public.set_own_post_tags(
  p_post_id uuid,
  p_tag_slugs text[]
)
returns table (tag_slug text, tag_label text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  post_row public.posts;
  clean_slugs text[];
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

  select coalesce(array_agg(distinct lower(btrim(candidate))), '{}'::text[])
  into clean_slugs
  from unnest(coalesce(p_tag_slugs, '{}'::text[])) as candidate
  where nullif(btrim(candidate), '') is not null;

  if coalesce(array_length(clean_slugs, 1), 0) > 5 then
    raise exception using errcode = '22023', message = 'a post accepts at most 5 tags';
  end if;

  if exists (
    select 1
    from unnest(clean_slugs) as candidate
    where candidate !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or char_length(candidate) not between 2 and 32
  ) then
    raise exception using
      errcode = '22023',
      message = 'each tag must be a lowercase hyphenated identifier of 2 to 32 characters';
  end if;

  insert into public.tags (slug, label)
  select candidate, candidate
  from unnest(clean_slugs) as candidate
  on conflict (slug) do nothing;

  delete from public.post_tags
  where post_tags.post_id = post_row.id
    and post_tags.tag_id not in (
      select tags.id from public.tags where tags.slug = any (clean_slugs)
    );

  insert into public.post_tags (post_id, tag_id)
  select post_row.id, tags.id
  from public.tags
  where tags.slug = any (clean_slugs)
  on conflict do nothing;

  return query
  select tags.slug, tags.label
  from public.post_tags
  join public.tags on tags.id = post_tags.tag_id
  where post_tags.post_id = post_row.id
  order by tags.slug;
end;
$$;

-- ── Reaction catalog administration ────────────────────────────────────────

create or replace function public.admin_upsert_reaction_type(
  p_key text,
  p_label text,
  p_emoji text,
  p_affects_reputation boolean default false,
  p_sort_order integer default 0
)
returns table (reaction_key text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  clean_key text := lower(btrim(coalesce(p_key, '')));
  clean_label text := btrim(coalesce(p_label, ''));
  clean_emoji text := btrim(coalesce(p_emoji, ''));
  existing public.reactions;
begin
  actor_id := private.require_permission('admin.manage_settings');

  if clean_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_key) not between 2 and 32 then
    raise exception using errcode = '22023', message = 'key must be a lowercase hyphenated identifier';
  end if;

  if char_length(clean_label) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'label must contain between 2 and 40 characters';
  end if;

  if char_length(clean_emoji) not between 1 and 8 then
    raise exception using errcode = '22023', message = 'emoji must contain between 1 and 8 characters';
  end if;

  select * into existing from public.reactions where reactions.key = clean_key for update;

  insert into public.reactions (key, label, emoji, affects_reputation, sort_order)
  values (
    clean_key,
    clean_label,
    clean_emoji,
    coalesce(p_affects_reputation, false),
    coalesce(p_sort_order, 0)
  )
  on conflict (key) do update
  set label = excluded.label,
      emoji = excluded.emoji,
      affects_reputation = excluded.affects_reputation,
      sort_order = excluded.sort_order;

  perform private.write_audit_log(
    actor_id,
    case when existing.id is null then 'reaction_type.create' else 'reaction_type.update' end,
    'reaction_type',
    null,
    null,
    case
      when existing.id is null then null
      else jsonb_build_object(
        'key', existing.key,
        'label', existing.label,
        'emoji', existing.emoji,
        'affects_reputation', existing.affects_reputation
      )
    end,
    jsonb_build_object(
      'key', clean_key,
      'label', clean_label,
      'emoji', clean_emoji,
      'affects_reputation', coalesce(p_affects_reputation, false)
    )
  );

  return query select clean_key;
end;
$$;

create or replace function public.admin_set_reaction_type_active(
  p_key text,
  p_expected_active boolean,
  p_is_active boolean,
  p_reason text
)
returns table (reaction_key text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  reaction_row public.reactions;
  clean_reason text;
begin
  actor_id := private.require_permission('admin.manage_settings');
  clean_reason := private.validated_reason(p_reason);

  select * into reaction_row from public.reactions where reactions.key = p_key for update;

  if reaction_row.id is null then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  if reaction_row.is_active is distinct from p_expected_active then
    raise exception using
      errcode = '40001',
      message = 'reaction type changed since it was read';
  end if;

  if reaction_row.is_active is not distinct from p_is_active then
    raise exception using errcode = '22023', message = 'reaction type already has that state';
  end if;

  update public.reactions
  set is_active = p_is_active
  where reactions.id = reaction_row.id;

  perform private.write_audit_log(
    actor_id,
    'reaction_type.active',
    'reaction_type',
    null,
    clean_reason,
    jsonb_build_object('key', reaction_row.key, 'is_active', reaction_row.is_active),
    jsonb_build_object('key', reaction_row.key, 'is_active', p_is_active)
  );

  return query select reaction_row.key;
end;
$$;

-- ── Counter recalculation ──────────────────────────────────────────────────

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
end;
$$;

revoke all on function private.recalculate_content_counters()
  from public, anon, authenticated;

-- ── Read RPCs extended with engagement ─────────────────────────────────────

drop function public.list_posts(uuid, timestamptz, uuid, integer);
drop function public.get_post(uuid);
drop function public.list_post_comments(uuid, timestamptz, uuid, integer);

-- `p_order` accepts 'recent' or 'popular'. Popularity is the stored vote score,
-- so the cursor carries the score alongside (created_at, id) and the keyset
-- stays stable.
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

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.list_posts(uuid, text, text, integer, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_post(uuid) from public, anon, authenticated;
revoke all on function public.list_post_comments(uuid, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.list_reaction_types() from public, anon, authenticated;
revoke all on function public.set_post_vote(uuid, smallint) from public, anon, authenticated;
revoke all on function public.set_comment_vote(uuid, smallint) from public, anon, authenticated;
revoke all on function public.toggle_post_reaction(uuid, text) from public, anon, authenticated;
revoke all on function public.toggle_comment_reaction(uuid, text) from public, anon, authenticated;
revoke all on function public.toggle_bookmark(uuid) from public, anon, authenticated;
revoke all on function public.list_own_bookmarks(timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.set_own_post_tags(uuid, text[]) from public, anon, authenticated;
revoke all on function public.admin_upsert_reaction_type(text, text, text, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.admin_set_reaction_type_active(text, boolean, boolean, text)
  from public, anon, authenticated;

grant execute on function public.list_posts(uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated;
grant execute on function public.get_post(uuid) to anon, authenticated;
grant execute on function public.list_post_comments(uuid, timestamptz, uuid, integer)
  to anon, authenticated;
grant execute on function public.list_reaction_types() to anon, authenticated;

grant execute on function public.set_post_vote(uuid, smallint) to authenticated;
grant execute on function public.set_comment_vote(uuid, smallint) to authenticated;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;
grant execute on function public.toggle_comment_reaction(uuid, text) to authenticated;
grant execute on function public.toggle_bookmark(uuid) to authenticated;
grant execute on function public.list_own_bookmarks(timestamptz, uuid, integer) to authenticated;
grant execute on function public.set_own_post_tags(uuid, text[]) to authenticated;
grant execute on function public.admin_upsert_reaction_type(text, text, text, boolean, integer)
  to authenticated;
grant execute on function public.admin_set_reaction_type_active(text, boolean, boolean, text)
  to authenticated;

-- ── Default reaction catalog ───────────────────────────────────────────────

insert into public.reactions (key, label, emoji, affects_reputation, sort_order)
values
  ('this-is-the-way', 'This is the Way', '🛡️', true, 10),
  ('well-forged', 'Well forged', '🔨', true, 20),
  ('teaches', 'Teaches something', '📖', true, 30),
  ('honors', 'Honors the creed', '🔥', false, 40),
  ('laughs', 'Laughs', '😄', false, 50);
