begin;

-- Codex Libre gaps (registry §2.12) closed by migration 0021: duplicate-proposal
-- detector, by-article provenance RPC, non-public article list, and archived
-- category listing. Everything runs inside one transaction and rolls back.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(39);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'g-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'g-archivist@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Archivist"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'g-other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gap Other"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'a0000000-0000-0000-0000-000000000002', id from public.roles where name = 'Archivist';

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

create or replace function pg_temp.act_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), true);
end;
$$;

-- Seed a category directly; the upsert RPC is exercised below.
insert into public.codex_categories (slug, name, description, status, sort_order)
values ('philosophy', 'Philosophy', 'The ideas that hold the culture together.', 'active', 10);

-- ── Exposure ────────────────────────────────────────────────────────────────

select is(
  has_function_privilege('anon', 'public.get_article_provenance(uuid)', 'execute'),
  true,
  'anon can execute the provenance RPC'
);
select is(
  has_function_privilege('anon', 'public.list_codex_articles_for_review(public.codex_article_status, timestamptz, uuid, integer)', 'execute'),
  false,
  'anon cannot execute the review list RPC'
);
select is(
  has_function_privilege('anon', 'public.list_codex_categories(boolean)', 'execute'),
  false,
  'anon cannot execute the archived-category overload'
);
select is(
  has_function_privilege('authenticated', 'public.get_article_provenance(uuid)', 'execute'),
  true,
  'a member can execute the provenance RPC'
);

-- ── Gap 1: duplicate-proposal detector ─────────────────────────────────────

-- A conversation worth distilling. The proposer is a plain member.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
create temp table g_post as
select post_id from public.create_post(
  (select id from public.list_plazas() where slug = 'central-plaza'),
  'A conversation worth distilling',
  'The thread that should become knowledge.'
);

create temp table g_proposal as
select proposal_id from public.create_codex_proposal(
  'This thread distilled how the creed is actually lived and deserves preserving.',
  'How the Way is lived',
  (select post_id from g_post)
);

select ok(
  (select proposal_id from g_proposal) is not null,
  'the first proposal on a post is accepted'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_proposal(
    'A second attempt to file the very same conversation into the library.',
    null,
    (select post_id from g_post)
  )$sql$),
  '23505',
  'the same author proposing the same post again is refused as a duplicate'
);

-- A different author may propose the same source.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_proposal(
    'A different member filing the same conversation for the library.',
    null,
    (select post_id from g_post)
  )$sql$),
  '00000',
  'a different author may propose the same post'
);

-- The same author may file the same source again once the first is withdrawn.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select ok(
  public.update_codex_proposal_status((select proposal_id from g_proposal), 'proposed', 'withdrawn', 'Changed my mind') is not null,
  'the proposer withdraws their first proposal'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_proposal(
    'Filing the same conversation again after withdrawing the first attempt.',
    null,
    (select post_id from g_post)
  )$sql$),
  '00000',
  'a withdrawn proposal no longer blocks the same source'
);

-- External URL duplicates are detected too.
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_proposal(
    'An external thread worth distilling into the library.',
    null, null, null, 'https://example.test/thread'
  )$sql$),
  '00000',
  'an external source is proposed once'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_proposal(
    'Filing the same external thread a second time.',
    null, null, null, 'https://example.test/thread'
  )$sql$),
  '23505',
  'the same external URL by the same author is refused as a duplicate'
);

-- ── Gap 2: by-article provenance RPC ────────────────────────────────────────

-- Build a published article produced by a published proposal, with a source and
-- a confirmed contributor. The member files the proposal on a fresh post; the
-- Archivist writes and publishes the article.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
create temp table g_prov_post as
select post_id from public.create_post(
  (select id from public.list_plazas() where slug = 'central-plaza'),
  'A second conversation for the provenance panel',
  'This source feeds the provenance of a published article.'
);
create temp table g_prov_proposal as
select proposal_id from public.create_codex_proposal(
  'A proposal that becomes a published article for the provenance panel.',
  null,
  (select post_id from g_prov_post)
);

select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
create temp table g_article as
select article_id from public.create_codex_article('philosophy', 'From conversation to knowledge', 'A reviewed body.');

-- Owner-privileged reader so the provenance assertions do not weaken the RLS
-- contract: temp tables are owned by the `authenticated` role, so a visitor
-- (`anon`) cannot read them directly. SECURITY DEFINER reads as the owner, the
-- same pattern the codex_contract suite uses for its article fixtures.
create or replace function pg_temp.gap_article_id()
returns uuid language sql security definer set search_path = '' as $$
  select article_id from pg_temp.g_article limit 1;
$$;
select ok(
  public.publish_codex_article((select article_id from g_article), 'draft') is not null,
  'the article for the provenance panel is published'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from g_prov_proposal), 'proposed', 'classified', null) is not null,
  'the provenance proposal is classified'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from g_prov_proposal), 'classified', 'drafting', null) is not null,
  'the provenance proposal moves to drafting'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from g_prov_proposal), 'drafting', 'reviewed', null) is not null,
  'the provenance proposal reaches reviewed'
);
-- The contributor is recorded and confirmed while the proposal is still open,
-- before publishing closes it to contributor changes.
select ok(
  public.upsert_codex_proposal_contributor(
    (select proposal_id from g_prov_proposal),
    'a0000000-0000-0000-0000-000000000001',
    'synthesis',
    'public',
    null
  ) is not null,
  'an archivist records a contributor on the provenance proposal'
);
select ok(
  public.set_codex_proposal_contributor_status(
    (select proposal_id from g_prov_proposal),
    'a0000000-0000-0000-0000-000000000001',
    'proposed',
    'confirmed',
    'Reviewed the contribution'
  ) is not null,
  'an archivist confirms the contributor'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from g_prov_proposal), 'reviewed', 'published', null, (select article_id from g_article)) is not null,
  'the provenance proposal is published with its article'
);

-- The provenance read, as a visitor.
set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.get_article_provenance(pg_temp.gap_article_id())),
  2::bigint,
  'the provenance of a published article has a source and a contributor'
);
select is(
  (select kind from public.get_article_provenance(pg_temp.gap_article_id()) where kind = 'source' limit 1),
  'source',
  'a source row is tagged source'
);
select is(
  (select source_is_visible from public.get_article_provenance(pg_temp.gap_article_id()) where kind = 'source' limit 1),
  true,
  'a visible source is reported visible'
);
select is(
  (select kind from public.get_article_provenance(pg_temp.gap_article_id()) where kind = 'contributor' limit 1),
  'contributor',
  'a contributor row is tagged contributor'
);
select is(
  (select member_display_name from public.get_article_provenance(pg_temp.gap_article_id()) where kind = 'contributor' limit 1),
  'Gap Member',
  'a confirmed contributor is named'
);

-- A non-published article is refused.
select is(
  pg_temp.capture_sqlstate($sql$
    select * from public.get_article_provenance(
      (select article_id from public.create_codex_article('philosophy', 'A draft that stays hidden', 'Draft body.'))
    )
  $sql$),
  'P0002',
  'a draft article has no provenance visible to a visitor'
);

-- ── Gap 3: non-public article list RPC ─────────────────────────────────────

set local role anon;
select pg_temp.act_as(null);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_codex_articles_for_review()$sql$),
  '42501',
  'a visitor cannot list articles for review'
);

set local role authenticated;
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_codex_articles_for_review()$sql$),
  '42501',
  'a plain member cannot list articles for review'
);

select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
create temp table g_draft as
select article_id from public.create_codex_article('philosophy', 'A draft awaiting review', 'A draft body.');
select is(
  (select count(*) from public.list_codex_articles_for_review()),
  1::bigint,
  'an archivist lists the non-public draft'
);
select is(
  (select status from public.list_codex_articles_for_review() limit 1),
  'draft',
  'the review list reports the draft status'
);
select is(
  (select count(*) from public.list_codex_articles_for_review('draft'::public.codex_article_status)),
  1::bigint,
  'the review list filters by draft status'
);
select is(
  (select count(*) from public.list_codex_articles_for_review('published'::public.codex_article_status)),
  0::bigint,
  'the review list never shows published articles'
);

-- ── Gap 4: archived-category listing ────────────────────────────────────────

set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.list_codex_categories(false)),
  1::bigint,
  'a visitor lists active categories with include_archived=false'
);

set local role authenticated;
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_codex_categories(true)$sql$),
  '42501',
  'a plain member cannot list archived categories'
);

select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.list_codex_categories(false)),
  1::bigint,
  'an archivist listing active categories sees only the active one'
);

-- Archive a category, then list it back.
select ok(
  public.admin_set_codex_category_status('philosophy', 'active', 'archived', 'Shelving the philosophy shelf') is not null,
  'an archivist archives a category'
);
select is(
  (select count(*) from public.list_codex_categories(false)),
  0::bigint,
  'the archived category leaves the active list'
);
select is(
  (select count(*) from public.list_codex_categories(true)),
  1::bigint,
  'an archivist listing archived categories sees the archived shelf'
);
select is(
  (select status from public.list_codex_categories(true) limit 1),
  'archived',
  'the archived category reports its status'
);

-- Reactivation through the existing CAS RPC closes the loop.
select ok(
  public.admin_set_codex_category_status('philosophy', 'archived', 'active', 'Restoring the shelf') is not null,
  'an archivist reactivates the archived category'
);
select is(
  (select count(*) from public.list_codex_categories(false)),
  1::bigint,
  'the reactivated category is active again'
);

select * from extensions.finish();
rollback;
