-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 — Codex Libre: documented DB-contract gaps (registry §2.12)
--
-- Forward-only closure of four gaps in the 0015 contract. No existing column,
-- enum or stable RPC signature is altered; each gap adds a check, a function,
-- or an overload.
--
-- 1. Duplicate-proposal detector. `create_codex_proposal` now refuses a source
--    that is already part of an *open* proposal by the same author, so a member
--    cannot file the same conversation twice. Decision (documented): raise a
--    `23505` unique-violation exception with a clear message — the same SQLSTATE
--    the suggestion one-open-per-article already uses, so the server action maps
--    it to a stable "already proposed" client code. The private helper is keyed
--    by source target and reusable by the chat-source path (gap 5) later.
-- 2. Public by-article provenance RPC. `get_article_provenance` returns the
--    sources and confirmed contributors of an article the caller can see,
--    replacing the client-side scan in `resolveArticleProvenance`. Only data
--    visible to the caller is returned: sources are re-checked through
--    `private.codex_source_is_visible` and a withdrawn contributor is never
--    named, exactly as on the proposal page.
-- 3. Non-public article list RPC. `list_codex_articles_for_review` lets an
--    Archivist holding `codex.edit` list drafts, unpublished and archived
--    articles for the `/council/codex` dashboard. Every other role sees nothing.
-- 4. Archived-category reactivation. `list_codex_categories(boolean)` adds an
--    `include_archived` overload so an Archivist can list archived shelves;
--    reactivation itself already exists as the CAS `admin_set_codex_category_status`
--    (active/archived) from 0015, which the category manager already calls.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Gap 1: duplicate-proposal detector ──────────────────────────────────────

-- True when the same source target already belongs to an *open* proposal by the
-- same author. "Open" reuses `private.codex_proposal_is_open`, so a proposal
-- that was withdrawn, rejected, published or replaced no longer blocks a fresh
-- filing of the same source. Exactly one target is matched by construction; the
-- caller passes the one it is about to insert.
create or replace function private.codex_source_already_proposed(
  p_proposer_id uuid,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_chat_message_id uuid default null,
  p_external_url text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.codex_proposals proposal
    join public.codex_proposal_sources source
      on source.proposal_id = proposal.id
    where proposal.proposer_id = p_proposer_id
      and private.codex_proposal_is_open(proposal.status)
      and (
        (p_post_id is not null and source.post_id = p_post_id)
        or (p_comment_id is not null and source.comment_id = p_comment_id)
        or (p_chat_message_id is not null and source.chat_message_id = p_chat_message_id)
        or (p_external_url is not null and source.external_url = p_external_url)
      )
  );
$$;

-- Recreated from 0015 with the same signature: the duplicate check runs after
-- the source is validated as visible and before the rate limit, so an already-
-- proposed source is refused before any row is written.
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

  -- Same source already proposed by this author, in a proposal still open.
  -- `23505` mirrors the one-open-suggestion SQLSTATE so the UI maps it to a
  -- stable "already proposed" code instead of a raw database message.
  if private.codex_source_already_proposed(v_actor_id, p_post_id, p_comment_id, null, v_clean_url) then
    raise exception using
      errcode = '23505',
      message = 'this source is already part of an open proposal by you';
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

-- ── Gap 2: public by-article provenance RPC ─────────────────────────────────

-- Sources and confirmed contributors of an article the caller can see, in one
-- read for the `/codex/[slug]` provenance panel. `kind` discriminates the two
-- logical sets; source columns are populated for `source` rows and contributor
-- columns for `contributor` rows. A source the caller can no longer open is
-- reported as restricted (label blanked) and a withdrawn contributor is never
-- named, matching the proposal page's privacy boundary.
create or replace function public.get_article_provenance(p_article_id uuid)
returns table (
  kind text,
  source_id uuid,
  source_type public.codex_source_type,
  source_is_visible boolean,
  source_label text,
  source_note text,
  contributor_id uuid,
  member_id uuid,
  member_display_name text,
  contribution_type public.codex_contribution_type,
  attribution public.codex_attribution,
  added_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
begin
  if p_article_id is null then
    raise exception using errcode = '22023', message = 'article id is required';
  end if;

  if not private.codex_article_is_visible_to_caller(p_article_id) then
    raise exception using errcode = 'P0002', message = 'article not found';
  end if;

  return query
  -- Sources: only those the caller may open; restricted ones stay, labelled
  -- blank, so nothing about their content leaks through the panel.
  select
    'source'::text,
    source.id,
    source.source_type,
    private.codex_source_is_visible(source),
    case when private.codex_source_is_visible(source)
      then private.codex_source_label(source) else null end,
    source.note,
    null::uuid,
    null::uuid,
    null::text,
    null::public.codex_contribution_type,
    null::public.codex_attribution,
    source.created_at
  from public.codex_proposal_sources source
  join public.codex_proposals proposal on proposal.id = source.proposal_id
  where proposal.article_id = p_article_id
    and proposal.status = 'published'

  union all

  -- Contributors: only confirmed ones, and a withdrawn attribution is never
  -- named (the withdrawal itself stays on record, as on the proposal page).
  select
    'contributor'::text,
    null::uuid,
    null::public.codex_source_type,
    null::boolean,
    null::text,
    null::text,
    contributor.id,
    contributor.member_id,
    case
      when contributor.attribution = 'withdrawn' or contributor.status = 'withdrawn'
        then null
      else member.display_name
    end,
    contributor.contribution_type,
    contributor.attribution,
    contributor.created_at
  from public.codex_proposal_contributors contributor
  join public.codex_proposals proposal on proposal.id = contributor.proposal_id
  join public.profiles member on member.id = contributor.member_id
  where proposal.article_id = p_article_id
    and proposal.status = 'published'
    and contributor.status = 'confirmed'
  -- Ordinal positions: a UNION ALL cannot ORDER BY output column names with a
  -- NULLS LAST suffix. Columns are kind(1), source_id(2), added_at(12).
  order by 1, 12, 2 nulls last;
end;
$$;

-- ── Gap 3: non-public article list RPC ──────────────────────────────────────

-- The Archivist work surface for `/council/codex`: drafts, unpublished and
-- archived articles the public list never shows. Gated on `codex.edit`, the
-- same permission the other moderation surfaces use, so a plain member or
-- visitor gets "permission denied" and no rows.
create or replace function public.list_codex_articles_for_review(
  p_status public.codex_article_status default null,
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
  status public.codex_article_status,
  version integer,
  published_at timestamptz,
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
    codex_articles.id,
    codex_articles.slug,
    codex_articles.title,
    coalesce(codex_articles.excerpt, left(codex_articles.body, 280)),
    codex_categories.slug,
    codex_categories.name,
    codex_articles.author_id,
    profiles.display_name,
    codex_articles.status,
    codex_articles.version,
    codex_articles.published_at,
    codex_articles.created_at
  from public.codex_articles
  join public.codex_categories on codex_categories.id = codex_articles.category_id
  join public.profiles on profiles.id = codex_articles.author_id
  where codex_articles.status not in ('published', 'locked')
    and (p_status is null or codex_articles.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (codex_articles.created_at, codex_articles.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by codex_articles.created_at desc, codex_articles.id desc
  limit v_limit;
end;
$$;

-- ── Gap 4: archived-category listing ────────────────────────────────────────

-- Overload of the public no-arg `list_codex_categories()`. With
-- `include_archived = false` it behaves exactly like the public list; with
-- `true` it also returns archived shelves, which only an Archivist may see. The
-- corresponding reactivation is the existing CAS `admin_set_codex_category_status`
-- (active/archived) from 0015, which the category manager already calls.
create or replace function public.list_codex_categories(p_include_archived boolean)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  status text,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
begin
  if coalesce(p_include_archived, false) and not private.caller_edits_codex() then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  return query
  select
    codex_categories.id,
    codex_categories.slug,
    codex_categories.name,
    codex_categories.description,
    codex_categories.status,
    codex_categories.sort_order
  from public.codex_categories
  where coalesce(p_include_archived, false) or codex_categories.status = 'active'
  order by codex_categories.sort_order, codex_categories.name;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function private.codex_source_already_proposed(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_article_provenance(uuid) from public, anon, authenticated;
revoke all on function public.list_codex_articles_for_review(
  public.codex_article_status, timestamptz, uuid, integer
) from public, anon, authenticated;
revoke all on function public.list_codex_categories(boolean) from public, anon, authenticated;

-- The recreated `create_codex_proposal` keeps its existing 0015 grant; only the
-- new functions are exposed here.
grant execute on function public.get_article_provenance(uuid) to anon, authenticated;
grant execute on function public.list_codex_articles_for_review(
  public.codex_article_status, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.list_codex_categories(boolean) to authenticated;

comment on function public.get_article_provenance(uuid) is
  'Sources and confirmed contributors of a published article the caller can see, in one read for the provenance panel. A source the caller can no longer open is reported restricted (label blank); a withdrawn contributor is never named.';
comment on function public.list_codex_articles_for_review(
  public.codex_article_status, timestamptz, uuid, integer
) is
  'Archivist work surface: drafts, unpublished and archived articles for the Council Codex dashboard. Requires codex.edit.';
comment on function public.list_codex_categories(boolean) is
  'Category listing overload. include_archived=false matches the public list; true also returns archived shelves and requires codex.edit. Reactivation is the existing admin_set_codex_category_status CAS.';
