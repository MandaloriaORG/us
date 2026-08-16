begin;

-- Codex Libre contract. Everything below runs inside one transaction and rolls
-- back, so fixtures never survive.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(85);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'c-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Codex Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'c-archivist@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Codex Archivist"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'c-nosy@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Nosy Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'c-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Codex Admin"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'c0000000-0000-0000-0000-000000000002', id from public.roles where name = 'Archivist';
insert into public.user_roles (user_id, role_id)
select 'c0000000-0000-0000-0000-000000000004', id from public.roles where name = 'Administrator';

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

create or replace function pg_temp.count_rows(p_table text)
returns bigint language plpgsql as $$
begin
  return (select count(*) from public.codex_articles);
end;
$$;

-- Owner-privileged readers so the assertions do not weaken the RLS contract.
create or replace function pg_temp.codex_article_version(p_article_id uuid)
returns integer language sql security definer set search_path = '' as $$
  select version from public.codex_articles where codex_articles.id = p_article_id;
$$;

create or replace function pg_temp.codex_version_count(p_article_id uuid)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.codex_versions where codex_versions.article_id = p_article_id;
$$;

create or replace function pg_temp.codex_article_status(p_article_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.codex_articles where codex_articles.id = p_article_id;
$$;

create or replace function pg_temp.codex_article_body(p_article_id uuid)
returns text language sql security definer set search_path = '' as $$
  select body from public.codex_articles where codex_articles.id = p_article_id;
$$;

create or replace function pg_temp.audit_action_count(p_action text)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.audit_logs where audit_logs.action = p_action;
$$;

-- Seed a category directly; the upsert RPC is exercised below.
insert into public.codex_categories (slug, name, description, status, sort_order)
values ('philosophy', 'Philosophy', 'The ideas that hold the culture together.', 'active', 10);

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.codex_categories') is not null, 'codex_categories exists');
select ok(to_regclass('public.codex_articles') is not null, 'codex_articles exists');
select ok(to_regclass('public.codex_versions') is not null, 'codex_versions exists');
select ok(to_regclass('public.codex_suggestions') is not null, 'codex_suggestions exists');
select ok(to_regclass('public.codex_proposals') is not null, 'codex_proposals exists');
select ok(to_regclass('public.codex_proposal_sources') is not null, 'codex_proposal_sources exists');
select ok(to_regclass('public.codex_proposal_contributors') is not null, 'codex_proposal_contributors exists');
select ok(to_regclass('public.codex_bookmarks') is not null, 'codex_bookmarks exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.codex_articles'::regclass),
  'codex_articles has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'codex_articles'),
  0::bigint,
  'codex_articles carries no policy, so RLS denies everything'
);
select is(has_table_privilege('anon', 'public.codex_articles', 'select'), false, 'anon cannot select articles directly');
select is(has_table_privilege('authenticated', 'public.codex_articles', 'select'), false, 'a member cannot select articles directly');
select is(
  has_function_privilege('anon', 'public.create_codex_article(text, text, text, text, text)', 'execute'),
  false,
  'anon cannot create articles'
);
select is(
  has_function_privilege('anon', 'public.create_codex_suggestion(uuid, text)', 'execute'),
  false,
  'anon cannot suggest'
);
select is(
  has_function_privilege('anon', 'public.get_codex_proposal(uuid)', 'execute'),
  false,
  'anon cannot read proposals'
);

-- ── Public reading ─────────────────────────────────────────────────────────

set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.list_codex_categories()),
  1::bigint,
  'anon lists active categories'
);
select ok(
  (select count(*) from public.list_codex_articles()) = 0::bigint,
  'anon sees no articles before any are published'
);

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');

-- ── The article lifecycle ─────────────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_article('philosophy', 'A draft', 'Draft body.')$sql$),
  '42501',
  'a member cannot create an article'
);

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');

create temp table t_article as
select article_id from public.create_codex_article('philosophy', 'The Way, in brief', 'Body one. The first version.');

select is(
  pg_temp.codex_article_status((select article_id from t_article)),
  'draft',
  'a new article starts as a draft'
);
select is(
  pg_temp.codex_version_count((select article_id from t_article)),
  0::bigint,
  'a draft writes no version'
);

select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.get_codex_article('the-way-in-brief')$sql$),
  'P0002',
  'a draft is not visible to a member'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.get_codex_article('the-way-in-brief')$sql$),
  'P0002',
  'a draft is not visible to a visitor'
);

-- Publish.
set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.publish_codex_article((select article_id from t_article), 'draft') is not null,
  'an archivist publishes the article'
);
select is(
  pg_temp.codex_article_status((select article_id from t_article)),
  'published',
  'the article is published'
);
select is(
  pg_temp.codex_version_count((select article_id from t_article)),
  1::bigint,
  'publishing snapshots the draft into the ledger'
);
select is(
  pg_temp.codex_article_version((select article_id from t_article)),
  1,
  'the article version counter advanced to one'
);
select is(
  pg_temp.audit_action_count('codex.published'),
  1::bigint,
  'publishing is audited'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.list_codex_articles()),
  1::bigint,
  'anon lists the published article'
);
select is(
  (select title from public.get_codex_article('the-way-in-brief')),
  'The Way, in brief',
  'anon reads the published article'
);

-- Editing a published article snapshots the old wording.
set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.update_codex_article(
    (select article_id from t_article),
    'The Way, in brief',
    'Body two. The second version.',
    null,
    'Second pass'
  ) is not null,
  'an archivist edits a published article'
);
select is(
  pg_temp.codex_version_count((select article_id from t_article)),
  2::bigint,
  'the edit left a second version'
);
select is(
  pg_temp.codex_article_body((select article_id from t_article)),
  'Body two. The second version.',
  'the article holds the new wording'
);
select is(
  (select body from public.list_codex_versions((select article_id from t_article)) limit 1),
  'Body one. The first version.',
  'the ledger is newest first and holds what came before'
);

-- An edit that changes nothing is not a new version.
select ok(
  public.update_codex_article(
    (select article_id from t_article),
    'The Way, in brief',
    'Body two. The second version.'
  ) is not null,
  'saving identical content is accepted'
);
select is(
  pg_temp.codex_version_count((select article_id from t_article)),
  2::bigint,
  'saving identical content writes no version'
);

-- Restore.
select ok(
  public.restore_codex_version((select article_id from t_article), 1, 'Reverting the rewrite') is not null,
  'an archivist restores version one'
);
select is(
  pg_temp.codex_article_body((select article_id from t_article)),
  'Body one. The first version.',
  'restoring put version one back in the article'
);
select is(
  pg_temp.codex_version_count((select article_id from t_article)),
  3::bigint,
  'the revert itself is in the ledger'
);
select is(
  pg_temp.audit_action_count('codex.version_restored'),
  1::bigint,
  'a version restore is audited'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.restore_codex_version((select article_id from t_article), 99, 'No such version')$sql$),
  'P0002',
  'restoring a version that does not exist is refused'
);

-- Lock and unpublish.
select ok(
  public.set_codex_article_status(
    (select article_id from t_article), 'published', 'locked', 'Freeze this article'
  ) is not null,
  'an archivist locks the article'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_codex_article((select article_id from t_article), 'X', 'Y')$sql$),
  '42501',
  'a locked article cannot be edited'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.list_codex_articles()),
  1::bigint,
  'a locked article stays public'
);

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.set_codex_article_status(
    (select article_id from t_article), 'locked', 'unpublished', 'Needs a second review'
  ) is not null,
  'an archivist unpublishes the article'
);
select is(
  pg_temp.audit_action_count('codex.unpublished'),
  1::bigint,
  'unpublishing is audited'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.list_codex_articles()),
  0::bigint,
  'an unpublished article leaves the public list'
);

-- Restore to published.
set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.set_codex_article_status(
    (select article_id from t_article), 'unpublished', 'published', 'Cleared for readers'
  ) is not null,
  'an archivist restores the article'
);

-- ── Suggestions ────────────────────────────────────────────────────────────

select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
create temp table t_suggestion as
select suggestion_id from public.create_codex_suggestion(
  (select article_id from t_article),
  'The excerpt could mention the historical context.'
);

select ok(
  (select suggestion_id from t_suggestion) is not null,
  'a member can suggest a correction'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_codex_suggestion((select article_id from t_article), 'A second open suggestion.')$sql$),
  '23505',
  'one open suggestion per member per article'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.review_codex_suggestion((select suggestion_id from t_suggestion), 'open', 'accepted', 'Good point')$sql$),
  '42501',
  'a member cannot review suggestions'
);

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.review_codex_suggestion((select suggestion_id from t_suggestion), 'open', 'accepted', 'Good point') is not null,
  'an archivist accepts a suggestion'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.review_codex_suggestion((select suggestion_id from t_suggestion), 'open', 'accepted', 'Again')$sql$),
  '40001',
  'reviewing is compare-and-swap'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.review_codex_suggestion((select suggestion_id from t_suggestion), 'accepted', 'merged', 'Merged now')$sql$),
  '00000',
  'an accepted suggestion can be merged'
);
select is(
  pg_temp.audit_action_count('codex_suggestion.merged'),
  1::bigint,
  'merging a suggestion is audited'
);

-- ── Proposals ──────────────────────────────────────────────────────────────

-- A conversation worth distilling. The proposer is a plain member.
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
create temp table t_source_post as
select post_id from public.create_post(
  (select id from public.list_plazas() where slug = 'central-plaza'),
  'A conversation worth distilling',
  'The thread that should become knowledge.'
);

create temp table t_proposal as
select proposal_id from public.create_codex_proposal(
  'This thread distilled how the creed is actually lived and deserves preserving.',
  'How the Way is lived',
  (select post_id from t_source_post)
);

select is(
  (select status from public.get_codex_proposal((select proposal_id from t_proposal))),
  'proposed',
  'a proposal starts proposed'
);

select pg_temp.act_as('c0000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.get_codex_proposal((select proposal_id from t_proposal))$sql$),
  'P0002',
  'a stranger is told the proposal does not exist'
);

select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_codex_proposal_status((select proposal_id from t_proposal), 'proposed', 'classified', null)$sql$),
  '42501',
  'a member cannot classify a proposal'
);
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_codex_proposal_status((select proposal_id from t_proposal), 'proposed', 'reviewed', null)$sql$),
  '22023',
  'proposed cannot jump to reviewed'
);

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.update_codex_proposal_status((select proposal_id from t_proposal), 'proposed', 'classified', null) is not null,
  'an archivist classifies the proposal'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from t_proposal), 'classified', 'drafting', null) is not null,
  'the proposal moves to drafting'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from t_proposal), 'drafting', 'reviewed', null) is not null,
  'the proposal reaches reviewed'
);

-- Publishing the proposal requires a published article and codex.publish.
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_codex_proposal_status((select proposal_id from t_proposal), 'reviewed', 'published', null, null)$sql$),
  '22023',
  'publishing a proposal requires an article'
);

-- The member's own proposal, withdrawn.
set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
create temp table t_withdrawn as
select proposal_id from public.create_codex_proposal(
  'A second conversation worth distilling into the library.',
  null,
  null,
  null,
  'https://example.test/thread'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from t_withdrawn), 'proposed', 'withdrawn', 'Changed my mind') is not null,
  'the proposer withdraws their own proposal'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_codex_proposal_status((select proposal_id from t_withdrawn), 'withdrawn', 'reopened', null)$sql$),
  '42501',
  'the proposer cannot reopen their withdrawn proposal'
);

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.update_codex_proposal_status((select proposal_id from t_withdrawn), 'withdrawn', 'reopened', null) is not null,
  'an archivist reopens a withdrawn proposal'
);

-- A rejected proposal stays rejected for the proposer.
select is(
  pg_temp.capture_sqlstate($sql$select * from public.update_codex_proposal_status((select proposal_id from t_withdrawn), 'reopened', 'rejected', 'Not a fit')$sql$),
  '00000',
  'an archivist rejects a proposal'
);

-- Publish the reviewed proposal into a freshly published article.
create temp table t_reviewed as
select article_id from public.create_codex_article('philosophy', 'From conversation to knowledge', 'A reviewed body.');

set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.publish_codex_article((select article_id from t_reviewed), 'draft') is not null,
  'the article for the proposal is published first'
);
select ok(
  public.update_codex_proposal_status((select proposal_id from t_proposal), 'reviewed', 'published', null, (select article_id from t_reviewed)) is not null,
  'the reviewed proposal is published with its article'
);
select is(
  (select article_id from public.get_codex_proposal((select proposal_id from t_proposal))),
  (select article_id from t_reviewed),
  'the proposal points at the article it produced'
);

-- Replacing a published proposal. A member files the superseding proposal.
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
create temp table t_replacement as
select proposal_id from public.create_codex_proposal(
  'A superseding distillation that replaces the earlier one entirely.',
  null,
  (select post_id from t_source_post)
);
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.replace_codex_proposal((select proposal_id from t_proposal), (select proposal_id from t_replacement), 'Superseded by a fuller account') is not null,
  'a published proposal can be replaced'
);
select is(
  (select status from public.get_codex_proposal((select proposal_id from t_proposal))),
  'replaced',
  'the replaced proposal is marked replaced'
);
select is(
  (select replaced_by from public.get_codex_proposal((select proposal_id from t_proposal))),
  (select proposal_id from t_replacement),
  'the replacement is recorded'
);

-- ── Sources never leak ─────────────────────────────────────────────────────

-- A post source that later becomes invisible must not leak through the proposal.
-- The source is written by a different member so that, once hidden, neither the
-- proposer nor anyone else can see it (an author always sees their own content).
set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000003');
create temp table t_hidden_post as
select post_id from public.create_post(
  (select id from public.list_plazas() where slug = 'central-plaza'),
  'A conversation that gets hidden',
  'This body must never leak through a proposal.'
);

select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
create temp table t_proposal2 as
select proposal_id from public.create_codex_proposal(
  'A proposal built on a post that will later be hidden.',
  null,
  (select post_id from t_hidden_post)
);
select is(
  (select source_count from public.get_codex_proposal((select proposal_id from t_proposal2))),
  1,
  'the proposer sees their visible source'
);

-- Hide the source post.
set local role authenticated;
select pg_temp.act_as('c0000000-0000-0000-0000-000000000004');
select ok(
  public.moderation_set_post_status((select post_id from t_hidden_post), 'published', 'hidden', 'Hidden after review') is not null,
  'the admin hides the source post'
);

select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select is(
  (select source_count from public.get_codex_proposal((select proposal_id from t_proposal2))),
  0,
  'a hidden source no longer counts as visible'
);
select is(
  (select bool_and(is_visible) from public.list_codex_proposal_sources((select proposal_id from t_proposal2))),
  false,
  'the source row reports restricted, never its content'
);
select is(
  (select label from public.list_codex_proposal_sources((select proposal_id from t_proposal2)) limit 1),
  null,
  'the restricted source label is blank, so nothing leaks'
);

-- ── Bookmarks ──────────────────────────────────────────────────────────────

select ok(
  public.toggle_codex_bookmark((select article_id from t_article)) is not null,
  'a member bookmarks a published article'
);
select is(
  (select count(*) from public.list_own_codex_bookmarks()),
  1::bigint,
  'the bookmark appears in the member list'
);
select is(
  (select bookmarked from public.toggle_codex_bookmark((select article_id from t_article))),
  false,
  'toggling again removes the bookmark'
);

-- ── Contributors ───────────────────────────────────────────────────────────

select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.upsert_codex_proposal_contributor(
    (select proposal_id from t_proposal2),
    'c0000000-0000-0000-0000-000000000001',
    'synthesis',
    'public',
    'https://example.test/evidence'
  ) is not null,
  'an archivist records a contributor'
);
select ok(
  public.set_codex_proposal_contributor_status(
    (select proposal_id from t_proposal2),
    'c0000000-0000-0000-0000-000000000001',
    'proposed',
    'confirmed',
    'Reviewed the contribution'
  ) is not null,
  'an archivist confirms the contributor'
);

-- Withdrawn attribution hides the name but keeps the record.
select pg_temp.act_as('c0000000-0000-0000-0000-000000000002');
select ok(
  public.set_codex_proposal_contributor_status(
    (select proposal_id from t_proposal2),
    'c0000000-0000-0000-0000-000000000001',
    'confirmed',
    'withdrawn',
    'Prefers not to be named'
  ) is not null,
  'an archivist withdraws an attribution'
);
select is(
  (select member_display_name from public.list_codex_proposal_contributors((select proposal_id from t_proposal2)) limit 1),
  null,
  'a withdrawn contributor is no longer named'
);
select is(
  (select status from public.list_codex_proposal_contributors((select proposal_id from t_proposal2)) limit 1),
  'withdrawn',
  'the withdrawal itself is on record'
);

select * from extensions.finish();
rollback;
