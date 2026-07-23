begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(41);

-- Fixtures exercise the real signup triggers, so profiles and the default role
-- arrive the same way they do in production.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'r-author@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Revision Author"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'r-nosy@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Nosy Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'r-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Revision Moderator"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'a0000000-0000-0000-0000-000000000003', id from public.roles where name = 'Moderator';

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

-- `content_revisions` carries no grant, which is the contract under test. These
-- owner-privileged helpers read state without weakening it.
create or replace function pg_temp.plaza(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.revision_rows(p_post_id uuid, p_comment_id uuid)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.content_revisions
  where content_revisions.post_id is not distinct from p_post_id
    and content_revisions.comment_id is not distinct from p_comment_id;
$$;

create or replace function pg_temp.post_body(p_post_id uuid)
returns text language sql security definer set search_path = '' as $$
  select body from public.posts where posts.id = p_post_id;
$$;

create or replace function pg_temp.comment_body(p_comment_id uuid)
returns text language sql security definer set search_path = '' as $$
  select body from public.comments where comments.id = p_comment_id;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.content_revisions') is not null, 'content_revisions exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.content_revisions'::regclass),
  'content_revisions has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'content_revisions'),
  0::bigint,
  'content_revisions carries no policy, so RLS denies everything'
);
select is(has_table_privilege('anon', 'public.content_revisions', 'select'), false, 'anon cannot select revisions');
select is(has_table_privilege('authenticated', 'public.content_revisions', 'select'), false, 'a member cannot select revisions directly');
select is(
  has_function_privilege('anon', 'public.list_content_revisions(uuid, uuid, integer)', 'execute'),
  false,
  'anon cannot read edit history'
);

-- ── An edit leaves a snapshot of what came before ──────────────────────────

set local role authenticated;
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');

create temp table t_post as
select post_id from public.create_post(
  pg_temp.plaza('central-plaza'),
  'The first title',
  'The first body.'
);

select is(
  pg_temp.revision_rows((select post_id from t_post), null),
  0::bigint,
  'creating a post writes no revision'
);
select is(
  (select count(*) from public.list_content_revisions((select post_id from t_post))),
  0::bigint,
  'a post that was never edited has an empty history'
);

select ok(
  public.update_own_post((select post_id from t_post), 'The second title', 'The second body.') is not null,
  'the author edits their post'
);
select is(
  pg_temp.revision_rows((select post_id from t_post), null),
  1::bigint,
  'the edit leaves one revision'
);
select is(
  pg_temp.post_body((select post_id from t_post)),
  'The second body.',
  'the post itself holds the new wording'
);
select is(
  (select body from public.list_content_revisions((select post_id from t_post))),
  'The first body.',
  'the revision holds what the post said before'
);
select is(
  (select title from public.list_content_revisions((select post_id from t_post))),
  'The first title',
  'a post revision keeps the previous title'
);
select is(
  (select editor_display_name from public.list_content_revisions((select post_id from t_post))),
  'Revision Author',
  'the revision names who wrote the replaced version'
);

-- An edit that changes nothing is not history.
select ok(
  public.update_own_post((select post_id from t_post), 'The second title', 'The second body.') is not null,
  'saving identical content is accepted'
);
select is(
  pg_temp.revision_rows((select post_id from t_post), null),
  1::bigint,
  'saving identical content leaves no new revision'
);

-- Newest first.
select ok(
  public.update_own_post((select post_id from t_post), 'The third title', 'The third body.') is not null,
  'the author edits again'
);
select is(
  (select body from public.list_content_revisions((select post_id from t_post)) limit 1),
  'The second body.',
  'the history is newest first'
);
select is(
  (select count(*) from public.list_content_revisions((select post_id from t_post))),
  2::bigint,
  'both edits are in the history'
);

-- ── Comments ───────────────────────────────────────────────────────────────

create temp table t_comment as
select comment_id from public.create_comment((select post_id from t_post), 'The first comment.');

select ok(
  public.update_own_comment((select comment_id from t_comment), 'The edited comment.') is not null,
  'the author edits their comment'
);
select is(
  pg_temp.comment_body((select comment_id from t_comment)),
  'The edited comment.',
  'the comment holds the new wording'
);
select is(
  (select body from public.list_content_revisions(null, (select comment_id from t_comment))),
  'The first comment.',
  'the comment revision holds what it said before'
);
select is(
  (select title from public.list_content_revisions(null, (select comment_id from t_comment))),
  null,
  'a comment revision has no title'
);
select is(
  (select count(*) from public.list_content_revisions((select post_id from t_post))),
  2::bigint,
  'the comment revision is not mixed into the post history'
);

-- ── Reading is limited ─────────────────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_content_revisions()$sql$),
  '22023',
  'naming no target is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_content_revisions((select post_id from t_post), (select comment_id from t_comment))$sql$),
  '22023',
  'naming two targets is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_content_revisions('99999999-0000-4000-8000-000000000001')$sql$),
  'P0002',
  'history for a post that does not exist is refused as missing'
);

select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_content_revisions((select post_id from t_post))$sql$),
  'P0002',
  'another member is told the history does not exist, not that it is forbidden'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_content_revisions(null, (select comment_id from t_comment))$sql$),
  'P0002',
  'the same holds for a comment'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.content_revisions$sql$),
  '42501',
  'a member cannot read revisions directly'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_content_revisions((select post_id from t_post))$sql$),
  '42501',
  'anon cannot read any edit history'
);

set local role authenticated;
select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select is(
  (select count(*) from public.list_content_revisions((select post_id from t_post))),
  2::bigint,
  'a moderator reads the history of content they did not write'
);
select is(
  (select count(*) from public.list_content_revisions(null, (select comment_id from t_comment))),
  1::bigint,
  'a moderator reads a comment history too'
);

-- ── Evidence outlives the removal ──────────────────────────────────────────

select ok(
  public.moderation_set_post_status((select post_id from t_post), 'published', 'hidden', 'Reported and hidden') is not null,
  'a moderator hides the post'
);
select is(
  (select count(*) from public.list_content_revisions((select post_id from t_post))),
  2::bigint,
  'hiding the post keeps its edit history readable by a moderator'
);

-- ── The history is bounded ─────────────────────────────────────────────────

select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');

create temp table t_loop as
select post_id from public.create_post(
  pg_temp.plaza('central-plaza'),
  'A post edited many times',
  'Body 0.'
);

do $$
declare
  i integer;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  for i in 1..60 loop
    perform public.update_own_post(
      (select post_id from t_loop),
      'A post edited many times',
      'Body ' || i || '.'
    );
  end loop;
end;
$$;

select is(
  pg_temp.revision_rows((select post_id from t_loop), null),
  50::bigint,
  'an edit loop cannot grow the history past the bound'
);
select is(
  (select body from public.list_content_revisions((select post_id from t_loop), null, 50) limit 1),
  'Body 59.',
  'the newest revision survives the trim'
);
select is(
  (select count(*) from public.list_content_revisions((select post_id from t_loop), null, 500)),
  50::bigint,
  'a caller cannot ask for more than the bound'
);
select is(
  pg_temp.post_body((select post_id from t_loop)),
  'Body 60.',
  'the post itself holds the last wording'
);
select is(
  pg_temp.revision_rows((select post_id from t_post), null),
  2::bigint,
  'trimming one item leaves another item''s history alone'
);

-- ── A removed post takes its revisions with it ─────────────────────────────

set local role postgres;
delete from public.posts where id = (select post_id from t_loop);
select is(
  pg_temp.revision_rows((select post_id from t_loop), null),
  0::bigint,
  'deleting a post physically removes its revisions'
);

select * from extensions.finish();
rollback;
