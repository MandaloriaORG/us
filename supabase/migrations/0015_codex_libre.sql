-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — Codex Libre
--
-- The free library of Mandaloria: reviewed, versioned knowledge distilled from
-- conversation. Three ideas shape the contract.
--
-- 1. **The article is the source of truth; versions are its ledger.** A version
--    is a snapshot taken *before* a state change, tagged with the version number
--    the article advances to, and bounded to the 50 most recent per article
--    exactly like content revisions in 0012. Restoring a version snapshots the
--    state being reverted first, so the revert is itself part of history.
-- 2. **Reading is public, writing is a permission.** Anyone reads published and
--    locked articles. Drafts, unpublished and archived articles are visible only
--    to an Archivist holding `codex.edit` (or `admin.manage_codex`). The tables
--    are RLS-enabled with no policies and no grants, unreachable from the Data
--    API; every path is a SECURITY DEFINER RPC.
-- 3. **A proposal never leaks a source.** Sources are re-validated for visibility
--    at read time, for the proposer too. A source that is no longer visible to
--    the caller is reported as existing but restricted — never as content.
--
-- Attribution is a status, not a feeling: `public`, `anonymous`, or `withdrawn`,
-- and withdrawal keeps the internal audit history. Ranks, badges and reputation
-- never derive from recognition without their own explicit rule.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Permissions ─────────────────────────────────────────────────────────────

insert into public.permissions (name, description)
values
  ('codex.propose', 'Propose a conversation for distillation into the Codex'),
  ('codex.edit', 'Create and edit Codex articles, categories and suggestions'),
  ('codex.publish', 'Publish, unpublish, archive, lock and restore Codex articles')
on conflict (name) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name in ('codex.edit', 'codex.publish')
where roles.name = 'Archivist'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name = 'codex.propose'
where roles.name = 'User'
on conflict (role_id, permission_id) do nothing;

-- The Administrator role was seeded with the permissions that existed in 0000;
-- anything added since must be granted explicitly.
insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name in ('codex.propose', 'codex.edit', 'codex.publish')
where roles.name = 'Administrator'
on conflict (role_id, permission_id) do nothing;

-- ── Enums ──────────────────────────────────────────────────────────────────

-- `locked` is published but protected from editing: it stays public. The other
-- non-draft statuses keep whatever `published_at` they had, so a previously
-- published article stays representable after unpublishing or archiving.
create type public.codex_article_status as enum (
  'draft',
  'published',
  'unpublished',
  'archived',
  'locked'
);

create type public.codex_suggestion_status as enum (
  'open',
  'accepted',
  'rejected',
  'merged'
);

create type public.codex_proposal_status as enum (
  'proposed',
  'classified',
  'drafting',
  'reviewed',
  'published',
  'rejected',
  'withdrawn',
  'reopened',
  'replaced'
);

create type public.codex_attribution as enum (
  'public',
  'anonymous',
  'withdrawn'
);

create type public.codex_contribution_status as enum (
  'proposed',
  'confirmed',
  'rejected',
  'withdrawn'
);

create type public.codex_contribution_type as enum (
  'question',
  'explanation',
  'evidence',
  'synthesis',
  'review',
  'edit'
);

create type public.codex_source_type as enum (
  'post',
  'comment',
  'chat_message',
  'external'
);

-- ── Categories ──────────────────────────────────────────────────────────────

create table public.codex_categories (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint codex_categories_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  name text not null
    constraint codex_categories_name_length check (char_length(btrim(name)) between 2 and 80),
  description text
    constraint codex_categories_description_length
    check (description is null or char_length(description) <= 500),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index codex_categories_listing_idx
  on public.codex_categories (status, sort_order, name);

create trigger codex_categories_set_updated_at
  before update on public.codex_categories
  for each row execute function public.update_updated_at();

-- ── Articles ────────────────────────────────────────────────────────────────

create table public.codex_articles (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint codex_articles_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  title text not null
    constraint codex_articles_title_length check (char_length(btrim(title)) between 3 and 300),
  body text not null
    constraint codex_articles_body_length check (char_length(btrim(body)) between 1 and 100000),
  excerpt text
    constraint codex_articles_excerpt_length
    check (excerpt is null or char_length(excerpt) between 3 and 500),
  category_id uuid not null references public.codex_categories (id) on delete restrict,
  -- The member who created the article. Who changed what later is the ledger's
  -- story; `author_id` names the article's origin.
  author_id uuid not null references public.profiles (id) on delete cascade,
  status public.codex_article_status not null default 'draft',
  published_at timestamptz,
  -- Version counter, advanced by every publish and by every edit of a published
  -- or locked article. The ledger rows carry the version they represent.
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codex_articles_published_at_matches_status check (
    case
      when status = 'draft' then published_at is null
      when status in ('published', 'locked') then published_at is not null
      else true
    end
  )
);

create index codex_articles_listing_idx
  on public.codex_articles (category_id, status, created_at desc, id desc);
create index codex_articles_author_idx on public.codex_articles (author_id, created_at desc);

create trigger codex_articles_set_updated_at
  before update on public.codex_articles
  for each row execute function public.update_updated_at();

-- ── The version ledger ──────────────────────────────────────────────────────

create table public.codex_versions (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- Order comes from a sequence, never from the clock; several changes inside
  -- one transaction share the same `now()`. Same reasoning as 0012.
  seq bigint generated always as identity,
  article_id uuid not null references public.codex_articles (id) on delete cascade,
  editor_id uuid references public.profiles (id) on delete set null,
  version integer not null check (version >= 1),
  title text not null
    constraint codex_versions_title_length check (char_length(title) between 3 and 300),
  body text not null
    constraint codex_versions_body_length check (char_length(body) between 1 and 100000),
  change_summary text
    constraint codex_versions_summary_length
    check (change_summary is null or char_length(change_summary) between 3 and 500),
  created_at timestamptz not null default now()
);

create unique index codex_versions_seq_idx on public.codex_versions (seq);
create index codex_versions_article_idx
  on public.codex_versions (article_id, seq desc);

-- ── Suggestions ─────────────────────────────────────────────────────────────

create table public.codex_suggestions (
  id uuid primary key default extensions.uuid_generate_v4(),
  article_id uuid not null references public.codex_articles (id) on delete cascade,
  suggester_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    constraint codex_suggestions_body_length
    check (char_length(btrim(body)) between 10 and 2000),
  status public.codex_suggestion_status not null default 'open',
  review_note text
    constraint codex_suggestions_note_length
    check (review_note is null or char_length(review_note) between 3 and 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codex_suggestions_review_matches_status check (
    (status in ('accepted', 'rejected', 'merged')) = (reviewed_at is not null)
  )
);

create index codex_suggestions_queue_idx
  on public.codex_suggestions (status, created_at desc, id desc);
create index codex_suggestions_article_idx on public.codex_suggestions (article_id, created_at desc);
create index codex_suggestions_suggester_idx on public.codex_suggestions (suggester_id, created_at desc);

-- One open suggestion per member per article; filing again after a review is
-- allowed because the article may have changed.
create unique index codex_suggestions_one_open_per_article_idx
  on public.codex_suggestions (suggester_id, article_id)
  where status = 'open';

create trigger codex_suggestions_set_updated_at
  before update on public.codex_suggestions
  for each row execute function public.update_updated_at();

-- ── Proposals ───────────────────────────────────────────────────────────────

create table public.codex_proposals (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  -- The Archivist currently responsible for it, if any.
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.codex_proposal_status not null default 'proposed',
  reason text not null
    constraint codex_proposals_reason_length
    check (char_length(btrim(reason)) between 20 and 2000),
  -- Optional working title for the article being distilled.
  working_title text
    constraint codex_proposals_title_length
    check (working_title is null or char_length(btrim(working_title)) between 3 and 300),
  -- Linked once a reviewed version is published. The article is never the
  -- proposal: it is what the proposal produced.
  article_id uuid references public.codex_articles (id) on delete set null,
  -- When a published proposal is replaced, which proposal supersedes it.
  replaced_by uuid references public.codex_proposals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codex_proposals_no_self_replace check (replaced_by is distinct from id)
);

create index codex_proposals_queue_idx
  on public.codex_proposals (status, created_at desc, id desc);
create index codex_proposals_proposer_idx
  on public.codex_proposals (proposer_id, created_at desc, id desc);
create index codex_proposals_assignee_idx
  on public.codex_proposals (assignee_id, created_at desc) where assignee_id is not null;

create trigger codex_proposals_set_updated_at
  before update on public.codex_proposals
  for each row execute function public.update_updated_at();

-- Allowed sources. Exactly one target, keyed by type; `chat_message_id` is a
-- plain uuid here because the messages table arrives with Holochat in 0017,
-- which adds the foreign key. A source's content is re-checked for visibility
-- every time it is read, so nothing hidden leaks through a proposal.
create table public.codex_proposal_sources (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_id uuid not null references public.codex_proposals (id) on delete cascade,
  source_type public.codex_source_type not null,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  chat_message_id uuid,
  external_url text,
  -- The fragment, thread or conceptual range used, without duplicating private
  -- content. Optional.
  note text
    constraint codex_proposal_sources_note_length
    check (note is null or char_length(note) <= 500),
  added_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint codex_proposal_sources_single_target check (
    (post_id is not null)::integer
      + (comment_id is not null)::integer
      + (chat_message_id is not null)::integer
      + (external_url is not null)::integer = 1
  ),
  constraint codex_proposal_sources_target_matches_type check (
    (source_type = 'post' and post_id is not null and comment_id is null
       and chat_message_id is null and external_url is null)
    or (source_type = 'comment' and comment_id is not null and post_id is null
       and chat_message_id is null and external_url is null)
    or (source_type = 'chat_message' and chat_message_id is not null
       and post_id is null and comment_id is null and external_url is null)
    or (source_type = 'external' and external_url is not null
       and post_id is null and comment_id is null and chat_message_id is null)
  ),
  constraint codex_proposal_sources_url_format check (
    external_url is null
    or (
      external_url ~ '^https?://[^[:space:]]+$'
      and char_length(external_url) <= 2048
      and external_url !~ '[\x00-\x1F\x7F]'
    )
  )
);

create index codex_proposal_sources_proposal_idx
  on public.codex_proposal_sources (proposal_id);
create index codex_proposal_sources_post_idx
  on public.codex_proposal_sources (post_id) where post_id is not null;
create index codex_proposal_sources_comment_idx
  on public.codex_proposal_sources (comment_id) where comment_id is not null;
create index codex_proposal_sources_chat_idx
  on public.codex_proposal_sources (chat_message_id) where chat_message_id is not null;

-- Recognized contributors. Recognition does not grant reputation, rank, role or
-- badge: each system applies its own explicit rules.
create table public.codex_proposal_contributors (
  id uuid primary key default extensions.uuid_generate_v4(),
  proposal_id uuid not null references public.codex_proposals (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  contribution_type public.codex_contribution_type not null,
  attribution public.codex_attribution not null default 'public',
  status public.codex_contribution_status not null default 'proposed',
  evidence_ref text
    constraint codex_proposal_contributors_evidence_length
    check (evidence_ref is null or char_length(evidence_ref) <= 500),
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (proposal_id, member_id),
  constraint codex_proposal_contributors_confirm_matches_status check (
    (status in ('confirmed', 'rejected')) = (confirmed_at is not null)
  )
);

create index codex_proposal_contributors_member_idx
  on public.codex_proposal_contributors (member_id, created_at desc);

-- ── Bookmarks ───────────────────────────────────────────────────────────────

-- A separate table from 0008's `bookmarks`, which is post-scoped and cannot be
-- widened without breaking its `post_id not null` contract.
create table public.codex_bookmarks (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  article_id uuid not null references public.codex_articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create index codex_bookmarks_user_recent_idx
  on public.codex_bookmarks (user_id, created_at desc);

-- ── Deny-by-default exposure ────────────────────────────────────────────────

alter table public.codex_categories enable row level security;
alter table public.codex_articles enable row level security;
alter table public.codex_versions enable row level security;
alter table public.codex_suggestions enable row level security;
alter table public.codex_proposals enable row level security;
alter table public.codex_proposal_sources enable row level security;
alter table public.codex_proposal_contributors enable row level security;
alter table public.codex_bookmarks enable row level security;

revoke all on table public.codex_categories from public, anon, authenticated;
revoke all on table public.codex_articles from public, anon, authenticated;
revoke all on table public.codex_versions from public, anon, authenticated;
revoke all on table public.codex_suggestions from public, anon, authenticated;
revoke all on table public.codex_proposals from public, anon, authenticated;
revoke all on table public.codex_proposal_sources from public, anon, authenticated;
revoke all on table public.codex_proposal_contributors from public, anon, authenticated;
revoke all on table public.codex_bookmarks from public, anon, authenticated;

grant all on table public.codex_categories to service_role;
grant all on table public.codex_articles to service_role;
grant all on table public.codex_versions to service_role;
grant all on table public.codex_suggestions to service_role;
grant all on table public.codex_proposals to service_role;
grant all on table public.codex_proposal_sources to service_role;
grant all on table public.codex_proposal_contributors to service_role;
grant all on table public.codex_bookmarks to service_role;

-- ── Internal helpers ───────────────────────────────────────────────────────

create or replace function private.codex_article_is_visible_to_caller(p_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.codex_articles
    where codex_articles.id = p_article_id
      and (
        codex_articles.status in ('published', 'locked')
        or (
          auth.uid() is not null
          and private.user_has_permission(auth.uid(), 'codex.edit')
        )
      )
  );
$$;

-- True when the caller may work on drafts and unpublished material.
create or replace function private.caller_edits_codex()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.user_has_permission(auth.uid(), 'codex.edit');
$$;

-- A source is safe to expose only when its content is visible to the caller.
-- Chat sources are resolved once Holochat exists; until then none can exist.
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

  -- Chat sources arrive with Holochat in 0017, which recreates this function
  -- with the real visibility check. Until then none can exist, so none is
  -- visible.
  if p_source.chat_message_id is not null then
    return false;
  end if;

  -- External URLs are public by construction.
  return true;
end;
$$;

-- The article ledger. Snapshots the current content before a change and tags it
-- with the version number the article will advance to.
create or replace function private.snapshot_codex_article(
  p_article_id uuid,
  p_editor_id uuid,
  p_summary text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_article public.codex_articles;
  v_new_version integer;
begin
  select * into v_article from public.codex_articles where codex_articles.id = p_article_id;

  if v_article.id is null then
    return;
  end if;

  v_new_version := v_article.version + 1;

  insert into public.codex_versions (
    article_id, editor_id, version, title, body, change_summary
  )
  values (
    v_article.id,
    p_editor_id,
    v_new_version,
    v_article.title,
    v_article.body,
    p_summary
  );

  update public.codex_articles
  set version = v_new_version
  where codex_articles.id = v_article.id;

  perform private.trim_codex_versions(v_article.id, 50);
end;
$$;

-- Keeps the newest `p_keep` ledger rows of one article and drops the rest.
create or replace function private.trim_codex_versions(
  p_article_id uuid,
  p_keep integer default 50
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.codex_versions
  where codex_versions.id in (
    select version.id
    from public.codex_versions version
    where version.article_id = p_article_id
    order by version.seq desc
    offset greatest(p_keep, 1)
  );
end;
$$;

create or replace function private.enforce_codex_suggestion_rate_limit(p_actor_id uuid)
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
  from public.codex_suggestions
  where codex_suggestions.suggester_id = p_actor_id
    and codex_suggestions.created_at > now() - interval '1 hour';

  if recent_count >= 20 then
    raise exception using
      errcode = '53400',
      message = 'suggestion rate limit reached, try again later';
  end if;
end;
$$;

create or replace function private.enforce_codex_proposal_rate_limit(p_actor_id uuid)
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
  from public.codex_proposals
  where codex_proposals.proposer_id = p_actor_id
    and codex_proposals.created_at > now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception using
      errcode = '53400',
      message = 'proposal rate limit reached, try again later';
  end if;
end;
$$;

-- Fallback slug for articles created without an explicit one. Accents are
-- dropped: the Archivist can always supply the exact slug instead.
create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(
    regexp_replace(coalesce(p_text, ''), '[^a-zA-Z0-9]+', '-', 'g'),
    '^-+|-+$', '', 'g'
  ));
$$;

-- Whether a proposal is still open to edits and to a member's withdrawal.
create or replace function private.codex_proposal_is_open(p_status public.codex_proposal_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('proposed', 'classified', 'drafting', 'reviewed', 'reopened');
$$;

-- Resolves a source's target content to a friendly label, never its body, for
-- the proposal page.
create or replace function private.codex_source_label(p_source public.codex_proposal_sources)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_source.post_id is not null then
      (select left(posts.title, 120) from public.posts where posts.id = p_source.post_id)
    when p_source.comment_id is not null then
      'comment'
    when p_source.chat_message_id is not null then
      'chat message'
    else p_source.external_url
  end;
$$;

revoke all on function private.codex_article_is_visible_to_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.caller_edits_codex()
  from public, anon, authenticated;
revoke all on function private.codex_source_is_visible(public.codex_proposal_sources)
  from public, anon, authenticated;
revoke all on function private.slugify(text) from public, anon, authenticated;
revoke all on function private.snapshot_codex_article(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.trim_codex_versions(uuid, integer)
  from public, anon, authenticated;
revoke all on function private.enforce_codex_suggestion_rate_limit(uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_codex_proposal_rate_limit(uuid)
  from public, anon, authenticated;
revoke all on function private.codex_proposal_is_open(public.codex_proposal_status)
  from public, anon, authenticated;
revoke all on function private.codex_source_label(public.codex_proposal_sources)
  from public, anon, authenticated;

-- ── Public reads ───────────────────────────────────────────────────────────

create or replace function public.list_codex_categories()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
rows 100
as $$
  select
    codex_categories.id,
    codex_categories.slug,
    codex_categories.name,
    codex_categories.description,
    codex_categories.sort_order
  from public.codex_categories
  where codex_categories.status = 'active'
  order by codex_categories.sort_order, codex_categories.name;
$$;

create or replace function public.list_codex_articles(
  p_category_slug text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  category_slug text,
  category_name text,
  author_id uuid,
  author_display_name text,
  version integer,
  published_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 50
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  return query
  select
    codex_articles.id,
    codex_articles.slug,
    codex_articles.title,
    coalesce(codex_articles.excerpt, left(codex_articles.body, 280)),
    codex_categories.slug,
    codex_categories.name,
    codex_articles.author_id,
    profiles.display_name,
    codex_articles.version,
    codex_articles.published_at,
    codex_articles.created_at
  from public.codex_articles
  join public.codex_categories on codex_categories.id = codex_articles.category_id
  join public.profiles on profiles.id = codex_articles.author_id
  where codex_articles.status in ('published', 'locked')
    and (p_category_slug is null or codex_categories.slug = p_category_slug)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (codex_articles.published_at, codex_articles.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by codex_articles.published_at desc, codex_articles.id desc
  limit v_limit;
end;
$$;

create or replace function public.get_codex_article(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  body text,
  excerpt text,
  category_slug text,
  category_name text,
  author_id uuid,
  author_display_name text,
  status public.codex_article_status,
  version integer,
  published_at timestamptz,
  updated_at timestamptz,
  caller_bookmarked boolean,
  can_edit boolean,
  can_publish boolean,
  suggestion_count integer
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_article public.codex_articles;
  v_actor_id uuid := auth.uid();
begin
  if p_slug is null or p_slug = '' then
    raise exception using errcode = '22023', message = 'slug is required';
  end if;

  select * into v_article from public.codex_articles where codex_articles.slug = p_slug;

  if v_article.id is null or not private.codex_article_is_visible_to_caller(v_article.id) then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  return query
  select
    v_article.id,
    v_article.slug,
    v_article.title,
    v_article.body,
    v_article.excerpt,
    codex_categories.slug,
    codex_categories.name,
    v_article.author_id,
    profiles.display_name,
    v_article.status,
    v_article.version,
    v_article.published_at,
    v_article.updated_at,
    exists (
      select 1
      from public.codex_bookmarks
      where codex_bookmarks.user_id = v_actor_id
        and codex_bookmarks.article_id = v_article.id
    ),
    v_article.status in ('draft', 'published', 'unpublished', 'archived')
      and v_actor_id is not null
      and private.user_has_permission(v_actor_id, 'codex.edit'),
    v_actor_id is not null
      and private.user_has_permission(v_actor_id, 'codex.publish'),
    (
      select count(*)::integer
      from public.codex_suggestions
      where codex_suggestions.article_id = v_article.id
        and codex_suggestions.status = 'open'
    )
  from public.codex_categories
  join public.profiles on profiles.id = v_article.author_id
  where codex_categories.id = v_article.category_id;
end;
$$;

create or replace function public.list_codex_versions(
  p_article_id uuid,
  p_limit integer default 25
)
returns table (
  version_id uuid,
  seq bigint,
  version integer,
  title text,
  body text,
  change_summary text,
  editor_id uuid,
  editor_display_name text,
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
  if not private.caller_edits_codex() then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  return query
  select
    codex_versions.id,
    codex_versions.seq,
    codex_versions.version,
    codex_versions.title,
    codex_versions.body,
    codex_versions.change_summary,
    codex_versions.editor_id,
    profiles.display_name,
    codex_versions.created_at
  from public.codex_versions
  left join public.profiles on profiles.id = codex_versions.editor_id
  where codex_versions.article_id = p_article_id
  order by codex_versions.seq desc
  limit v_limit;
end;
$$;

create or replace function public.list_own_codex_bookmarks(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  article_id uuid,
  slug text,
  title text,
  category_slug text,
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
  v_actor_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  v_actor_id := private.require_active_actor();

  return query
  select
    codex_articles.id,
    codex_articles.slug,
    codex_articles.title,
    codex_categories.slug,
    profiles.display_name,
    codex_bookmarks.created_at,
    codex_bookmarks.id
  from public.codex_bookmarks
  join public.codex_articles on codex_articles.id = codex_bookmarks.article_id
  join public.codex_categories on codex_categories.id = codex_articles.category_id
  join public.profiles on profiles.id = codex_articles.author_id
  where codex_bookmarks.user_id = v_actor_id
    and codex_articles.status in ('published', 'locked')
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (codex_bookmarks.created_at, codex_bookmarks.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by codex_bookmarks.created_at desc, codex_bookmarks.id desc
  limit v_limit;
end;
$$;

-- ── Suggestion reads ────────────────────────────────────────────────────────

create or replace function public.list_own_codex_suggestions(
  p_article_id uuid default null,
  p_limit integer default 25
)
returns table (
  suggestion_id uuid,
  article_id uuid,
  article_slug text,
  article_title text,
  body text,
  status public.codex_suggestion_status,
  review_note text,
  reviewed_at timestamptz,
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
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  v_actor_id := private.require_active_actor();

  return query
  select
    suggestions.id,
    suggestions.article_id,
    codex_articles.slug,
    codex_articles.title,
    suggestions.body,
    suggestions.status,
    suggestions.review_note,
    suggestions.reviewed_at,
    suggestions.created_at
  from public.codex_suggestions
  join public.codex_articles on codex_articles.id = suggestions.article_id
  where suggestions.suggester_id = v_actor_id
    and (p_article_id is null or suggestions.article_id = p_article_id)
  order by suggestions.created_at desc, suggestions.id desc
  limit v_limit;
end;
$$;

create or replace function public.moderation_list_codex_suggestions(
  p_status public.codex_suggestion_status default 'open',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  suggestion_id uuid,
  article_id uuid,
  article_slug text,
  article_title text,
  suggester_id uuid,
  suggester_display_name text,
  body text,
  status public.codex_suggestion_status,
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
  if not private.caller_edits_codex() then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  return query
  select
    suggestions.id,
    suggestions.article_id,
    codex_articles.slug,
    codex_articles.title,
    suggestions.suggester_id,
    suggester.display_name,
    suggestions.body,
    suggestions.status,
    suggestions.created_at
  from public.codex_suggestions
  join public.codex_articles on codex_articles.id = suggestions.article_id
  join public.profiles suggester on suggester.id = suggestions.suggester_id
  where (p_status is null or suggestions.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (suggestions.created_at, suggestions.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by suggestions.created_at desc, suggestions.id desc
  limit v_limit;
end;
$$;

-- ── Proposal reads ──────────────────────────────────────────────────────────

-- Returns the proposal to its proposer and to every Archivist. Sources are
-- resolved through `private.codex_source_is_visible`: a source the caller can
-- no longer open is reported as restricted, never as content, and its link is
-- dropped from the returned rows.
create or replace function public.get_codex_proposal(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.codex_proposal_status,
  reason text,
  working_title text,
  proposer_id uuid,
  proposer_display_name text,
  assignee_id uuid,
  assignee_display_name text,
  article_id uuid,
  article_slug text,
  replaced_by uuid,
  source_count integer,
  contributor_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_proposal public.codex_proposals;
  v_actor_id uuid := auth.uid();
begin
  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not (private.caller_edits_codex() or v_proposal.proposer_id = v_actor_id) then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  return query
  select
    v_proposal.id,
    v_proposal.status,
    v_proposal.reason,
    v_proposal.working_title,
    v_proposal.proposer_id,
    proposer.display_name,
    v_proposal.assignee_id,
    assignee.display_name,
    v_proposal.article_id,
    article.slug,
    v_proposal.replaced_by,
    (
      select count(*)::integer
      from public.codex_proposal_sources
      where codex_proposal_sources.proposal_id = v_proposal.id
        and private.codex_source_is_visible(codex_proposal_sources)
    ),
    (
      select count(*)::integer
      from public.codex_proposal_contributors
      where codex_proposal_contributors.proposal_id = v_proposal.id
        and codex_proposal_contributors.status = 'confirmed'
    ),
    v_proposal.created_at,
    v_proposal.updated_at,
    v_actor_id is not null and private.caller_edits_codex()
  from public.profiles proposer
  left join public.profiles assignee on assignee.id = v_proposal.assignee_id
  left join public.codex_articles article on article.id = v_proposal.article_id
  where proposer.id = v_proposal.proposer_id;
end;
$$;

create or replace function public.list_codex_proposal_sources(
  p_proposal_id uuid,
  p_limit integer default 50
)
returns table (
  source_id uuid,
  source_type public.codex_source_type,
  is_visible boolean,
  label text,
  note text,
  added_by uuid,
  added_by_display_name text,
  added_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_proposal public.codex_proposals;
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not (private.caller_edits_codex() or v_proposal.proposer_id = v_actor_id) then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  return query
  select
    sources.id,
    sources.source_type,
    private.codex_source_is_visible(sources),
    -- The label is computed only for visible sources; restricted ones stay
    -- blank so nothing about their content leaks.
    case when private.codex_source_is_visible(sources)
      then private.codex_source_label(sources) else null end,
    sources.note,
    sources.added_by,
    adder.display_name,
    sources.created_at
  from public.codex_proposal_sources sources
  join public.profiles adder on adder.id = sources.added_by
  where sources.proposal_id = p_proposal_id
  order by sources.created_at, sources.id
  limit v_limit;
end;
$$;

create or replace function public.list_codex_proposal_contributors(
  p_proposal_id uuid,
  p_limit integer default 50
)
returns table (
  contributor_id uuid,
  member_id uuid,
  member_display_name text,
  contribution_type public.codex_contribution_type,
  attribution public.codex_attribution,
  status public.codex_contribution_status,
  evidence_ref text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_proposal public.codex_proposals;
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_reader_privileged boolean;
begin
  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not (private.caller_edits_codex() or v_proposal.proposer_id = v_actor_id) then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  -- A contributor who withdrew is never named publicly; only an Archivist sees
  -- the withdrawal, as the audit of a recognised person. Anonymous attribution
  -- is rendered by the app from the status, which this RPC reports faithfully.
  return query
  select
    contributors.id,
    contributors.member_id,
    case
      when contributors.attribution = 'withdrawn' or contributors.status = 'withdrawn'
        then null
      else member.display_name
    end,
    contributors.contribution_type,
    contributors.attribution,
    contributors.status,
    contributors.evidence_ref,
    contributors.confirmed_by,
    contributors.confirmed_at,
    contributors.created_at
  from public.codex_proposal_contributors contributors
  join public.profiles member on member.id = contributors.member_id
  where contributors.proposal_id = p_proposal_id
  order by contributors.created_at, contributors.id
  limit v_limit;
end;
$$;

create or replace function public.list_own_codex_proposals(
  p_status public.codex_proposal_status default null,
  p_limit integer default 25
)
returns table (
  proposal_id uuid,
  status public.codex_proposal_status,
  reason text,
  working_title text,
  article_id uuid,
  article_slug text,
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
  v_actor_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  v_actor_id := private.require_active_actor();

  return query
  select
    proposals.id,
    proposals.status,
    proposals.reason,
    proposals.working_title,
    proposals.article_id,
    article.slug,
    proposals.created_at,
    proposals.updated_at
  from public.codex_proposals proposals
  left join public.codex_articles article on article.id = proposals.article_id
  where proposals.proposer_id = v_actor_id
    and (p_status is null or proposals.status = p_status)
  order by proposals.created_at desc, proposals.id desc
  limit v_limit;
end;
$$;

create or replace function public.moderation_list_codex_proposals(
  p_status public.codex_proposal_status default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  proposal_id uuid,
  status public.codex_proposal_status,
  reason text,
  proposer_id uuid,
  proposer_display_name text,
  assignee_id uuid,
  assignee_display_name text,
  source_count integer,
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
  if not private.caller_edits_codex() then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  return query
  select
    proposals.id,
    proposals.status,
    proposals.reason,
    proposals.proposer_id,
    proposer.display_name,
    proposals.assignee_id,
    assignee.display_name,
    (
      select count(*)::integer
      from public.codex_proposal_sources
      where codex_proposal_sources.proposal_id = proposals.id
    ),
    proposals.created_at
  from public.codex_proposals proposals
  join public.profiles proposer on proposer.id = proposals.proposer_id
  left join public.profiles assignee on assignee.id = proposals.assignee_id
  where (p_status is null or proposals.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (proposals.created_at, proposals.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by proposals.created_at desc, proposals.id desc
  limit v_limit;
end;
$$;

-- ── Article writes ──────────────────────────────────────────────────────────

create or replace function public.create_codex_article(
  p_category_slug text,
  p_title text,
  p_body text,
  p_excerpt text default null,
  p_slug text default null
)
returns table (article_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_category public.codex_categories;
  v_clean_title text := btrim(coalesce(p_title, ''));
  v_clean_body text := btrim(coalesce(p_body, ''));
  v_clean_excerpt text := nullif(btrim(coalesce(p_excerpt, '')), '');
  v_clean_slug text;
  v_article_id uuid;
begin
  v_actor_id := private.require_permission('codex.edit');

  select * into v_category
  from public.codex_categories
  where codex_categories.slug = p_category_slug
    and codex_categories.status = 'active';

  if v_category.id is null then
    raise exception using errcode = 'P0002', message = 'category not found';
  end if;

  if char_length(v_clean_title) not between 3 and 300 then
    raise exception using errcode = '22023', message = 'title must contain between 3 and 300 characters';
  end if;

  if char_length(v_clean_body) not between 1 and 100000 then
    raise exception using errcode = '22023', message = 'body must contain between 1 and 100000 characters';
  end if;

  if v_clean_excerpt is not null and char_length(v_clean_excerpt) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'excerpt must contain between 3 and 500 characters';
  end if;

  v_clean_slug := lower(btrim(coalesce(p_slug, '')));
  if v_clean_slug = '' then
    v_clean_slug := private.slugify(v_clean_title);
  end if;

  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_clean_slug) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  insert into public.codex_articles (
    slug, title, body, excerpt, category_id, author_id, status
  )
  values (
    v_clean_slug, v_clean_title, v_clean_body, v_clean_excerpt,
    v_category.id, v_actor_id, 'draft'
  )
  returning codex_articles.id into v_article_id;

  return query select v_article_id;
end;
$$;

create or replace function public.update_codex_article(
  p_article_id uuid,
  p_title text,
  p_body text,
  p_excerpt text default null,
  p_change_summary text default null
)
returns table (article_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_article public.codex_articles;
  v_clean_title text := btrim(coalesce(p_title, ''));
  v_clean_body text := btrim(coalesce(p_body, ''));
  v_clean_excerpt text := nullif(btrim(coalesce(p_excerpt, '')), '');
  v_clean_summary text := nullif(btrim(coalesce(p_change_summary, '')), '');
begin
  v_actor_id := private.require_permission('codex.edit');

  select * into v_article from public.codex_articles where codex_articles.id = p_article_id for update;

  if v_article.id is null then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  if v_article.status = 'locked' then
    raise exception using errcode = '42501', message = 'article is locked';
  end if;

  if char_length(v_clean_title) not between 3 and 300 then
    raise exception using errcode = '22023', message = 'title must contain between 3 and 300 characters';
  end if;

  if char_length(v_clean_body) not between 1 and 100000 then
    raise exception using errcode = '22023', message = 'body must contain between 1 and 100000 characters';
  end if;

  if v_clean_excerpt is not null and char_length(v_clean_excerpt) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'excerpt must contain between 3 and 500 characters';
  end if;

  -- Editing a published or locked article is a content change, so the old
  -- wording goes to the ledger first and the version advances. Editing a draft
  -- changes nothing that the public has seen, so it is plain editing.
  if (v_clean_title, v_clean_body, v_clean_excerpt)
     is distinct from (v_article.title, v_article.body, v_article.excerpt) then
    if v_article.status in ('published', 'locked') then
      perform private.snapshot_codex_article(
        v_article.id,
        v_actor_id,
        coalesce(v_clean_summary, 'Edit')
      );
    end if;

    update public.codex_articles
    set title = v_clean_title,
        body = v_clean_body,
        excerpt = v_clean_excerpt
    where codex_articles.id = v_article.id;
  end if;

  return query select v_article.id;
end;
$$;

create or replace function public.publish_codex_article(
  p_article_id uuid,
  p_expected_status public.codex_article_status default 'draft',
  p_change_summary text default null
)
returns table (article_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_article public.codex_articles;
  v_clean_summary text := nullif(btrim(coalesce(p_change_summary, '')), '');
begin
  v_actor_id := private.require_permission('codex.publish');

  select * into v_article from public.codex_articles where codex_articles.id = p_article_id for update;

  if v_article.id is null then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  if v_article.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'article changed since it was read';
  end if;

  if v_article.status in ('published', 'locked') then
    raise exception using errcode = '22023', message = 'article is already published';
  end if;

  perform private.snapshot_codex_article(v_article.id, v_actor_id, coalesce(v_clean_summary, 'Publish'));

  update public.codex_articles
  set status = 'published',
      published_at = coalesce(v_article.published_at, now())
  where codex_articles.id = v_article.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex.published',
    'codex_article',
    v_article.id,
    null,
    jsonb_build_object('status', v_article.status, 'version', v_article.version),
    jsonb_build_object('status', 'published', 'version', v_article.version + 1)
  );

  return query select v_article.id;
end;
$$;

-- One compare-and-swap RPC for every status that takes an article out of the
-- public list or puts it back: unpublish, archive, lock and restore.
create or replace function public.set_codex_article_status(
  p_article_id uuid,
  p_expected_status public.codex_article_status,
  p_status public.codex_article_status,
  p_reason text default null
)
returns table (article_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_article public.codex_articles;
  v_clean_reason text;
  v_audit_action text;
begin
  v_actor_id := private.require_permission('codex.publish');

  if p_status not in ('unpublished', 'archived', 'locked', 'published') then
    raise exception using errcode = '22023', message = 'invalid destination status';
  end if;

  -- Removing an article from the public list, or restoring one, is a decision
  -- that must survive the Archivist who made it, so it carries a reason.
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_article from public.codex_articles where codex_articles.id = p_article_id for update;

  if v_article.id is null then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  if v_article.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'article changed since it was read';
  end if;

  if v_article.status = p_status then
    raise exception using errcode = '22023', message = 'article already has that status';
  end if;

  -- Restoring means publishing again; locking keeps it published but read-only.
  update public.codex_articles
  set status = p_status,
      published_at = case
        when p_status = 'published' then coalesce(v_article.published_at, now())
        else v_article.published_at
      end
  where codex_articles.id = v_article.id;

  v_audit_action := case p_status
    when 'unpublished' then 'codex.unpublished'
    when 'archived' then 'codex.archived'
    when 'locked' then 'codex.locked'
    else 'codex.published'
  end;

  perform private.write_audit_log(
    v_actor_id,
    v_audit_action,
    'codex_article',
    v_article.id,
    v_clean_reason,
    jsonb_build_object('status', v_article.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_article.id;
end;
$$;

create or replace function public.restore_codex_version(
  p_article_id uuid,
  p_version integer,
  p_reason text
)
returns table (article_id uuid, version integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_article public.codex_articles;
  v_clean_reason text;
  v_ledger public.codex_versions;
begin
  v_actor_id := private.require_permission('codex.publish');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_article from public.codex_articles where codex_articles.id = p_article_id for update;

  if v_article.id is null then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  if v_article.status = 'locked' then
    raise exception using errcode = '42501', message = 'article is locked';
  end if;

  -- The version being restored must actually be in the ledger and must not be
  -- the current state (the current state is only in the article).
  select * into v_ledger
  from public.codex_versions
  where codex_versions.article_id = p_article_id
    and codex_versions.version = p_version
  order by codex_versions.seq desc
  limit 1;

  if v_ledger.id is null then
    raise exception using errcode = 'P0002', message = 'version not found';
  end if;

  -- Record what is being reverted before overwriting it.
  perform private.snapshot_codex_article(
    v_article.id,
    v_actor_id,
    left('Restored from version ' || p_version, 100)
  );

  update public.codex_articles
  set title = v_ledger.title,
      body = v_ledger.body
  where codex_articles.id = v_article.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex.version_restored',
    'codex_article',
    v_article.id,
    v_clean_reason,
    jsonb_build_object('version', v_article.version),
    jsonb_build_object('version', p_version)
  );

  return query select v_article.id, v_article.version + 1;
end;
$$;

-- ── Category administration ─────────────────────────────────────────────────

create or replace function public.admin_upsert_codex_category(
  p_slug text,
  p_name text,
  p_description text default null,
  p_sort_order integer default 0
)
returns table (category_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_slug text := lower(btrim(coalesce(p_slug, '')));
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_existing public.codex_categories;
begin
  v_actor_id := private.require_permission('codex.edit');

  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(v_clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  select * into v_existing from public.codex_categories where codex_categories.slug = v_clean_slug for update;

  insert into public.codex_categories (slug, name, description, sort_order)
  values (v_clean_slug, v_clean_name, nullif(btrim(p_description), ''), coalesce(p_sort_order, 0))
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order;

  perform private.write_audit_log(
    v_actor_id,
    case when v_existing.id is null then 'codex_category.create' else 'codex_category.update' end,
    'codex_category',
    coalesce(v_existing.id, (select id from public.codex_categories where slug = v_clean_slug)),
    null,
    case
      when v_existing.id is null then null
      else jsonb_build_object('name', v_existing.name, 'sort_order', v_existing.sort_order)
    end,
    jsonb_build_object('slug', v_clean_slug, 'name', v_clean_name)
  );

  return query select v_clean_slug;
end;
$$;

create or replace function public.admin_set_codex_category_status(
  p_slug text,
  p_expected_status text,
  p_status text,
  p_reason text
)
returns table (category_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_category public.codex_categories;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('codex.edit');
  v_clean_reason := private.validated_reason(p_reason);

  if p_status not in ('active', 'archived') then
    raise exception using errcode = '22023', message = 'status must be active or archived';
  end if;

  select * into v_category from public.codex_categories where codex_categories.slug = p_slug for update;

  if v_category.id is null then
    raise exception using errcode = 'P0002', message = 'category not found';
  end if;

  if v_category.status is distinct from p_expected_status then
    raise exception using errcode = '40001', message = 'category changed since it was read';
  end if;

  if v_category.status = p_status then
    raise exception using errcode = '22023', message = 'category already has that status';
  end if;

  update public.codex_categories
  set status = p_status
  where codex_categories.id = v_category.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex_category.status',
    'codex_category',
    v_category.id,
    v_clean_reason,
    jsonb_build_object('status', v_category.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_category.slug;
end;
$$;

-- ── Suggestions ─────────────────────────────────────────────────────────────

create or replace function public.create_codex_suggestion(
  p_article_id uuid,
  p_body text
)
returns table (suggestion_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_body text := btrim(coalesce(p_body, ''));
  v_suggestion_id uuid;
begin
  v_actor_id := private.require_permission('codex.suggest');

  if char_length(v_clean_body) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'a suggestion must contain between 10 and 2000 characters';
  end if;

  -- Suggestions target published articles; an unpublished one is not open to
  -- correction.
  if not exists (
    select 1
    from public.codex_articles
    where codex_articles.id = p_article_id
      and codex_articles.status in ('published', 'locked')
  ) then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  perform private.enforce_codex_suggestion_rate_limit(v_actor_id);

  insert into public.codex_suggestions (article_id, suggester_id, body)
  values (p_article_id, v_actor_id, v_clean_body)
  returning codex_suggestions.id into v_suggestion_id;

  return query select v_suggestion_id;
end;
$$;

create or replace function public.review_codex_suggestion(
  p_suggestion_id uuid,
  p_expected_status public.codex_suggestion_status,
  p_status public.codex_suggestion_status,
  p_review_note text
)
returns table (suggestion_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_suggestion public.codex_suggestions;
  v_clean_note text;
begin
  v_actor_id := private.require_permission('codex.edit');

  if p_status not in ('accepted', 'rejected', 'merged') then
    raise exception using errcode = '22023', message = 'a suggestion can be accepted, rejected or merged';
  end if;

  select * into v_suggestion from public.codex_suggestions where codex_suggestions.id = p_suggestion_id for update;

  if v_suggestion.id is null then
    raise exception using errcode = 'P0002', message = 'suggestion not found';
  end if;

  if v_suggestion.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'suggestion changed since it was read';
  end if;

  -- Accepted and merged are the two ways a suggestion leaves the queue; an
  -- accepted suggestion can still be merged once it is applied, but rejected
  -- and merged are terminal, and an accepted one changes only by merging.
  if v_suggestion.status in ('rejected', 'merged') then
    raise exception using errcode = '22023', message = 'suggestion is already decided';
  end if;

  if v_suggestion.status = 'accepted' and p_status <> 'merged' then
    raise exception using errcode = '22023', message = 'suggestion is already decided';
  end if;

  if p_status = 'merged' and v_suggestion.status not in ('open', 'accepted') then
    raise exception using errcode = '22023', message = 'only an open or accepted suggestion can be merged';
  end if;

  v_clean_note := private.validated_reason(p_review_note);

  update public.codex_suggestions
  set status = p_status,
      review_note = v_clean_note,
      reviewed_by = v_actor_id,
      reviewed_at = now()
  where codex_suggestions.id = v_suggestion.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex_suggestion.' || p_status::text,
    'codex_suggestion',
    v_suggestion.id,
    v_clean_note,
    jsonb_build_object('status', v_suggestion.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_suggestion.id;
end;
$$;

-- ── Proposals ───────────────────────────────────────────────────────────────

create or replace function public.create_codex_proposal(
  p_reason text,
  p_working_title text default null,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_external_url text default null
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
  v_clean_url text := nullif(btrim(coalesce(p_external_url, '')), '');
  v_proposal_id uuid;
begin
  v_actor_id := private.require_permission('codex.propose');

  if char_length(v_clean_reason) not between 20 and 2000 then
    raise exception using errcode = '22023', message = 'a reason must contain between 20 and 2000 characters';
  end if;

  if v_clean_title is not null and char_length(v_clean_title) not between 3 and 300 then
    raise exception using errcode = '22023', message = 'a working title must contain between 3 and 300 characters';
  end if;

  -- At least one source, validated against the caller's own visibility so a
  -- proposal cannot be built on content the proposer cannot reach.
  if (p_post_id is not null)::integer + (p_comment_id is not null)::integer
     + (v_clean_url is not null)::integer <> 1 then
    raise exception using errcode = '22023', message = 'provide exactly one initial source';
  end if;

  if p_post_id is not null then
    if not private.post_is_visible_to_caller(p_post_id) then
      raise exception using errcode = 'P0002', message = 'source not found';
    end if;
  elsif p_comment_id is not null then
    if not exists (
      select 1
      from public.comments
      where comments.id = p_comment_id
        and comments.status = 'published'
        and private.post_is_visible_to_caller(comments.post_id)
    ) then
      raise exception using errcode = 'P0002', message = 'source not found';
    end if;
  else
    if v_clean_url !~ '^https?://[^[:space:]]+$' or char_length(v_clean_url) > 2048 then
      raise exception using errcode = '22023', message = 'invalid external url';
    end if;
  end if;

  perform private.enforce_codex_proposal_rate_limit(v_actor_id);

  insert into public.codex_proposals (proposer_id, reason, working_title)
  values (v_actor_id, v_clean_reason, v_clean_title)
  returning codex_proposals.id into v_proposal_id;

  insert into public.codex_proposal_sources (
    proposal_id, source_type, post_id, comment_id, external_url, added_by
  )
  values (
    v_proposal_id,
    case
      when p_post_id is not null then 'post'::public.codex_source_type
      when p_comment_id is not null then 'comment'::public.codex_source_type
      else 'external'::public.codex_source_type
    end,
    p_post_id,
    p_comment_id,
    v_clean_url,
    v_actor_id
  );

  return query select v_proposal_id;
end;
$$;

-- Chat sources are added by a re-created overload in 0017 once the messages
-- table exists. This one handles the rest and re-validates visibility.
create or replace function public.add_codex_proposal_source(
  p_proposal_id uuid,
  p_source_type public.codex_source_type,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_external_url text default null,
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
  v_clean_url text := nullif(btrim(coalesce(p_external_url, '')), '');
  v_clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_source_id uuid;
begin
  v_actor_id := private.require_active_actor();

  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id for update;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  -- Only the proposer or an Archivist adds sources, and only while the proposal
  -- is still open.
  if not (v_proposal.proposer_id = v_actor_id or private.caller_edits_codex()) then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not private.codex_proposal_is_open(v_proposal.status) then
    raise exception using errcode = '22023', message = 'proposal is not open to new sources';
  end if;

  if p_source_type not in ('post', 'comment', 'external') then
    raise exception using errcode = '22023', message = 'chat message sources arrive with Holochat';
  end if;

  if v_clean_note is not null and char_length(v_clean_note) > 500 then
    raise exception using errcode = '22023', message = 'note must not exceed 500 characters';
  end if;

  if p_source_type = 'post' then
    if p_post_id is null or not private.post_is_visible_to_caller(p_post_id) then
      raise exception using errcode = 'P0002', message = 'source not found';
    end if;
    insert into public.codex_proposal_sources (proposal_id, source_type, post_id, note, added_by)
    values (p_proposal_id, 'post', p_post_id, v_clean_note, v_actor_id)
    returning id into v_source_id;
  elsif p_source_type = 'comment' then
    if p_comment_id is null or not exists (
      select 1
      from public.comments
      where comments.id = p_comment_id
        and comments.status = 'published'
        and private.post_is_visible_to_caller(comments.post_id)
    ) then
      raise exception using errcode = 'P0002', message = 'source not found';
    end if;
    insert into public.codex_proposal_sources (proposal_id, source_type, comment_id, note, added_by)
    values (p_proposal_id, 'comment', p_comment_id, v_clean_note, v_actor_id)
    returning id into v_source_id;
  else
    if v_clean_url is null or v_clean_url !~ '^https?://[^[:space:]]+$' or char_length(v_clean_url) > 2048 then
      raise exception using errcode = '22023', message = 'invalid external url';
    end if;
    insert into public.codex_proposal_sources (proposal_id, source_type, external_url, note, added_by)
    values (p_proposal_id, 'external', v_clean_url, v_clean_note, v_actor_id)
    returning id into v_source_id;
  end if;

  return query select v_source_id;
end;
$$;

create or replace function public.remove_codex_proposal_source(
  p_proposal_id uuid,
  p_source_id uuid
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
    raise exception using errcode = '22023', message = 'proposal is not open to source changes';
  end if;

  delete from public.codex_proposal_sources
  where codex_proposal_sources.id = p_source_id
    and codex_proposal_sources.proposal_id = p_proposal_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'source not found';
  end if;

  return query select p_source_id;
end;
$$;

-- Contributor management. The proposer and the Archivist both work the same
-- table; the Archivist confirms.
create or replace function public.upsert_codex_proposal_contributor(
  p_proposal_id uuid,
  p_member_id uuid,
  p_contribution_type public.codex_contribution_type,
  p_attribution public.codex_attribution default 'public',
  p_evidence_ref text default null
)
returns table (contributor_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_proposal public.codex_proposals;
  v_clean_evidence text := nullif(btrim(coalesce(p_evidence_ref, '')), '');
  v_contributor_id uuid;
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
    raise exception using errcode = '22023', message = 'proposal is not open to contributor changes';
  end if;

  if v_clean_evidence is not null and char_length(v_clean_evidence) > 500 then
    raise exception using errcode = '22023', message = 'evidence reference must not exceed 500 characters';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_member_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  insert into public.codex_proposal_contributors (
    proposal_id, member_id, contribution_type, attribution, evidence_ref, status
  )
  values (
    p_proposal_id, p_member_id, p_contribution_type, p_attribution, v_clean_evidence, 'proposed'
  )
  on conflict (proposal_id, member_id) do update
  set contribution_type = excluded.contribution_type,
      attribution = excluded.attribution,
      evidence_ref = excluded.evidence_ref
  returning codex_proposal_contributors.id into v_contributor_id;

  return query select v_contributor_id;
end;
$$;

-- Confirm, reject or withdraw a contributor's recognition. Withdrawal keeps the
-- row and the audit trail; it only stops the name from being shown.
create or replace function public.set_codex_proposal_contributor_status(
  p_proposal_id uuid,
  p_member_id uuid,
  p_expected_status public.codex_contribution_status,
  p_status public.codex_contribution_status,
  p_reason text default null
)
returns table (contributor_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_proposal public.codex_proposals;
  v_contributor public.codex_proposal_contributors;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('codex.edit');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id for update;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  select * into v_contributor
  from public.codex_proposal_contributors
  where codex_proposal_contributors.proposal_id = p_proposal_id
    and codex_proposal_contributors.member_id = p_member_id
  for update;

  if v_contributor.id is null then
    raise exception using errcode = 'P0002', message = 'contributor not found';
  end if;

  if v_contributor.status is distinct from p_expected_status then
    raise exception using errcode = '40001', message = 'contributor changed since it was read';
  end if;

  if p_status not in ('confirmed', 'rejected', 'withdrawn') then
    raise exception using errcode = '22023', message = 'invalid contributor status';
  end if;

  if v_contributor.status = p_status then
    raise exception using errcode = '22023', message = 'contributor already has that status';
  end if;

  -- A withdrawn attribution is reversible by re-confirming; a rejected one is a
  -- judgement and stays rejected.
  if v_contributor.status = 'rejected' and p_status <> 'rejected' then
    raise exception using errcode = '22023', message = 'a rejected contributor cannot be restored';
  end if;

  update public.codex_proposal_contributors
  set status = p_status,
      -- Withdrawing an attribution is a status and a policy at once: the name
      -- stops being shown, while the row and the audit trail survive.
      attribution = case when p_status = 'withdrawn' then 'withdrawn' else attribution end,
      confirmed_by = case when p_status in ('confirmed', 'rejected') then v_actor_id else null end,
      confirmed_at = case when p_status in ('confirmed', 'rejected') then now() else null end
  where codex_proposal_contributors.id = v_contributor.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex_contributor.' || p_status::text,
    'codex_proposal',
    v_proposal.id,
    v_clean_reason,
    jsonb_build_object('member_id', p_member_id, 'status', v_contributor.status),
    jsonb_build_object('member_id', p_member_id, 'status', p_status)
  );

  return query select v_contributor.id;
end;
$$;

-- Assign an Archivist to work a proposal.
create or replace function public.assign_codex_proposal(
  p_proposal_id uuid,
  p_assignee_id uuid,
  p_reason text
)
returns table (proposal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_proposal public.codex_proposals;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('codex.edit');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id for update;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_assignee_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'assignee not found';
  end if;

  if not private.user_has_permission(p_assignee_id, 'codex.edit') then
    raise exception using errcode = '42501', message = 'assignee cannot edit codex';
  end if;

  update public.codex_proposals
  set assignee_id = p_assignee_id
  where codex_proposals.id = v_proposal.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex_proposal.assigned',
    'codex_proposal',
    v_proposal.id,
    v_clean_reason,
    jsonb_build_object('assignee_id', v_proposal.assignee_id),
    jsonb_build_object('assignee_id', p_assignee_id)
  );

  return query select v_proposal.id;
end;
$$;

-- The proposal state machine. Whitelisted transitions, compare-and-swap, and a
-- reason on every irreversible-looking move.
create or replace function public.update_codex_proposal_status(
  p_proposal_id uuid,
  p_expected_status public.codex_proposal_status,
  p_status public.codex_proposal_status,
  p_reason text default null,
  p_article_id uuid default null
)
returns table (proposal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_proposal public.codex_proposals;
  v_clean_reason text;
  v_audit_action text;
begin
  -- Withdrawal is the proposer's own act; everything else is the Archivist's.
  if p_status = 'withdrawn' then
    v_actor_id := private.require_active_actor();
  else
    v_actor_id := private.require_permission('codex.edit');
  end if;

  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id for update;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  -- A proposer sees their own proposal; an Archivist sees any. Same probe-proof
  -- answer for everyone else.
  if not (private.caller_edits_codex() or v_proposal.proposer_id = v_actor_id) then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if p_status = 'withdrawn' and v_proposal.proposer_id <> v_actor_id then
    raise exception using errcode = '42501', message = 'only the proposer withdraws a proposal';
  end if;

  if v_proposal.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'proposal changed since it was read';
  end if;

  if v_proposal.status = p_status then
    raise exception using errcode = '22023', message = 'proposal already has that status';
  end if;

  -- Whitelist of legal transitions, expressed from the current state.
  -- `published` -> `replaced` is a separate RPC so the replacing proposal is a
  -- real uuid parameter, not a uuid-typed string.
  if not (
    (v_proposal.status in ('proposed', 'reopened') and p_status in ('classified', 'rejected', 'withdrawn'))
    or (v_proposal.status = 'classified' and p_status in ('drafting', 'rejected', 'withdrawn'))
    or (v_proposal.status = 'drafting' and p_status in ('reviewed', 'rejected', 'withdrawn'))
    or (v_proposal.status = 'reviewed' and p_status in ('published', 'rejected', 'withdrawn'))
    or (v_proposal.status in ('withdrawn', 'rejected') and p_status = 'reopened')
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid proposal transition from ' || v_proposal.status::text;
  end if;

  -- Rejection and withdrawal are judgements that must survive the person who
  -- made them, so they carry a reason.
  if p_status in ('rejected', 'withdrawn') then
    v_clean_reason := private.validated_reason(p_reason);
  end if;

  -- Publishing is the one transition that requires `codex.publish`, and it only
  -- publishes a reviewed article: the proposal itself is never the article.
  if p_status = 'published' then
    v_actor_id := private.require_permission('codex.publish');

    if p_article_id is null then
      raise exception using errcode = '22023', message = 'publishing a proposal requires an article';
    end if;

    if not exists (
      select 1 from public.codex_articles
      where codex_articles.id = p_article_id
        and codex_articles.status in ('published', 'locked')
    ) then
      raise exception using errcode = '22023', message = 'the article must be published first';
    end if;

    -- Every remaining source must still be visible at the moment of publishing;
    -- a source that went private mid-review blocks the publish.
    if exists (
      select 1
      from public.codex_proposal_sources
      where codex_proposal_sources.proposal_id = v_proposal.id
        and not private.codex_source_is_visible(codex_proposal_sources)
    ) then
      raise exception using
        errcode = '22023',
        message = 'a proposal source is no longer visible; review it before publishing';
    end if;
  end if;

  update public.codex_proposals
  set status = p_status,
      article_id = coalesce(p_article_id, codex_proposals.article_id)
  where codex_proposals.id = v_proposal.id;

  v_audit_action := 'codex_proposal.' || p_status::text;

  perform private.write_audit_log(
    v_actor_id,
    v_audit_action,
    'codex_proposal',
    v_proposal.id,
    v_clean_reason,
    jsonb_build_object('status', v_proposal.status),
    jsonb_build_object('status', p_status, 'article_id', p_article_id)
  );

  return query select v_proposal.id;
end;
$$;

-- A dedicated transition for replacing a published proposal, so the replaced
-- proposal id is a real parameter instead of a uuid-typed string.
create or replace function public.replace_codex_proposal(
  p_proposal_id uuid,
  p_replaced_by uuid,
  p_reason text
)
returns table (proposal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_proposal public.codex_proposals;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('codex.publish');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_proposal from public.codex_proposals where codex_proposals.id = p_proposal_id for update;

  if v_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if v_proposal.status <> 'published' then
    raise exception using errcode = '22023', message = 'only a published proposal can be replaced';
  end if;

  if not exists (select 1 from public.codex_proposals where codex_proposals.id = p_replaced_by) then
    raise exception using errcode = 'P0002', message = 'replacing proposal not found';
  end if;

  update public.codex_proposals
  set status = 'replaced',
      replaced_by = p_replaced_by
  where codex_proposals.id = v_proposal.id;

  perform private.write_audit_log(
    v_actor_id,
    'codex_proposal.replaced',
    'codex_proposal',
    v_proposal.id,
    v_clean_reason,
    jsonb_build_object('status', 'published'),
    jsonb_build_object('status', 'replaced', 'replaced_by', p_replaced_by)
  );

  return query select v_proposal.id;
end;
$$;

-- ── Bookmarks ───────────────────────────────────────────────────────────────

create or replace function public.toggle_codex_bookmark(p_article_id uuid)
returns table (bookmarked boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_removed boolean;
begin
  v_actor_id := private.require_permission('bookmark.create');

  if not exists (
    select 1
    from public.codex_articles
    where codex_articles.id = p_article_id
      and codex_articles.status in ('published', 'locked')
  ) then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  delete from public.codex_bookmarks
  where codex_bookmarks.user_id = v_actor_id
    and codex_bookmarks.article_id = p_article_id;

  v_removed := found;

  if not v_removed then
    insert into public.codex_bookmarks (user_id, article_id)
    values (v_actor_id, p_article_id);
  end if;

  return query select not v_removed;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.list_codex_categories() from public, anon, authenticated;
revoke all on function public.list_codex_articles(text, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_codex_article(text) from public, anon, authenticated;
revoke all on function public.list_codex_versions(uuid, integer) from public, anon, authenticated;
revoke all on function public.list_own_codex_bookmarks(timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.list_own_codex_suggestions(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.moderation_list_codex_suggestions(
  public.codex_suggestion_status, timestamptz, uuid, integer
) from public, anon, authenticated;
revoke all on function public.get_codex_proposal(uuid) from public, anon, authenticated;
revoke all on function public.list_codex_proposal_sources(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.list_codex_proposal_contributors(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.list_own_codex_proposals(public.codex_proposal_status, integer)
  from public, anon, authenticated;
revoke all on function public.moderation_list_codex_proposals(
  public.codex_proposal_status, timestamptz, uuid, integer
) from public, anon, authenticated;
revoke all on function public.create_codex_article(text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_codex_article(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.publish_codex_article(uuid, public.codex_article_status, text)
  from public, anon, authenticated;
revoke all on function public.set_codex_article_status(
  uuid, public.codex_article_status, public.codex_article_status, text
) from public, anon, authenticated;
revoke all on function public.restore_codex_version(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_codex_category(text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.admin_set_codex_category_status(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.create_codex_suggestion(uuid, text) from public, anon, authenticated;
revoke all on function public.review_codex_suggestion(
  uuid, public.codex_suggestion_status, public.codex_suggestion_status, text
) from public, anon, authenticated;
revoke all on function public.create_codex_proposal(text, text, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.add_codex_proposal_source(
  uuid, public.codex_source_type, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.remove_codex_proposal_source(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.upsert_codex_proposal_contributor(
  uuid, uuid, public.codex_contribution_type, public.codex_attribution, text
) from public, anon, authenticated;
revoke all on function public.set_codex_proposal_contributor_status(
  uuid, uuid, public.codex_contribution_status, public.codex_contribution_status, text
) from public, anon, authenticated;
revoke all on function public.assign_codex_proposal(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_codex_proposal_status(
  uuid, public.codex_proposal_status, public.codex_proposal_status, text, uuid
) from public, anon, authenticated;
revoke all on function public.replace_codex_proposal(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.toggle_codex_bookmark(uuid) from public, anon, authenticated;

-- Visitors read the public library; members also manage their own suggestions,
-- proposals and bookmarks; Archivists and the Council get the work surfaces.
grant execute on function public.list_codex_categories() to anon, authenticated;
grant execute on function public.list_codex_articles(text, timestamptz, uuid, integer)
  to anon, authenticated;
grant execute on function public.get_codex_article(text) to anon, authenticated;

grant execute on function public.list_own_codex_bookmarks(timestamptz, uuid, integer)
  to authenticated;
grant execute on function public.list_own_codex_suggestions(uuid, integer) to authenticated;
grant execute on function public.get_codex_proposal(uuid) to authenticated;
grant execute on function public.list_codex_proposal_sources(uuid, integer) to authenticated;
grant execute on function public.list_codex_proposal_contributors(uuid, integer) to authenticated;
grant execute on function public.list_own_codex_proposals(public.codex_proposal_status, integer)
  to authenticated;
grant execute on function public.create_codex_suggestion(uuid, text) to authenticated;
grant execute on function public.create_codex_proposal(text, text, uuid, uuid, text)
  to authenticated;
grant execute on function public.add_codex_proposal_source(
  uuid, public.codex_source_type, uuid, uuid, text, text
) to authenticated;
grant execute on function public.remove_codex_proposal_source(uuid, uuid) to authenticated;
grant execute on function public.upsert_codex_proposal_contributor(
  uuid, uuid, public.codex_contribution_type, public.codex_attribution, text
) to authenticated;
grant execute on function public.update_codex_proposal_status(
  uuid, public.codex_proposal_status, public.codex_proposal_status, text, uuid
) to authenticated;
grant execute on function public.toggle_codex_bookmark(uuid) to authenticated;

-- Archivist and Council surfaces.
grant execute on function public.list_codex_versions(uuid, integer) to authenticated;
grant execute on function public.moderation_list_codex_suggestions(
  public.codex_suggestion_status, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.moderation_list_codex_proposals(
  public.codex_proposal_status, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.create_codex_article(text, text, text, text, text)
  to authenticated;
grant execute on function public.update_codex_article(uuid, text, text, text, text)
  to authenticated;
grant execute on function public.publish_codex_article(uuid, public.codex_article_status, text)
  to authenticated;
grant execute on function public.set_codex_article_status(
  uuid, public.codex_article_status, public.codex_article_status, text
) to authenticated;
grant execute on function public.restore_codex_version(uuid, integer, text) to authenticated;
grant execute on function public.admin_upsert_codex_category(text, text, text, integer)
  to authenticated;
grant execute on function public.admin_set_codex_category_status(text, text, text, text)
  to authenticated;
grant execute on function public.review_codex_suggestion(
  uuid, public.codex_suggestion_status, public.codex_suggestion_status, text
) to authenticated;
grant execute on function public.set_codex_proposal_contributor_status(
  uuid, uuid, public.codex_contribution_status, public.codex_contribution_status, text
) to authenticated;
grant execute on function public.assign_codex_proposal(uuid, uuid, text) to authenticated;
grant execute on function public.replace_codex_proposal(uuid, uuid, text) to authenticated;

comment on table public.codex_articles is
  'A Codex Libre article. Public once published or locked; drafts, unpublished and archived articles are Archivist-only. Versions snapshot the wording that each change replaced.';
comment on table public.codex_proposals is
  'A member''s proposal to distill a conversation into Codex knowledge. Sources and contributors are re-checked for visibility on every read; publishing links a reviewed article, never the proposal itself.';
comment on function public.update_codex_proposal_status(
  uuid, public.codex_proposal_status, public.codex_proposal_status, text, uuid
) is
  'Proposal state machine. Compare-and-swap; withdrawal is the proposer''s act, publishing requires codex.publish and a published article.';
comment on function public.restore_codex_version(uuid, integer, text) is
  'Revert an article to a past version. The reverted state is itself snapshotted, so history is never truncated by a restore.';
