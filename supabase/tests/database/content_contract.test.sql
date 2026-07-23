begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(82);

-- Fixtures exercise the real signup triggers, so profiles and the default role
-- arrive the same way they do in production.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'author@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Author"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'reader@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Reader"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'content-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Content Admin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'content-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Content Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'suspended-author@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Suspended Author"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select '50000000-0000-0000-0000-000000000003', id from public.roles where name = 'Administrator';

insert into public.user_roles (user_id, role_id)
select '50000000-0000-0000-0000-000000000004', id from public.roles where name = 'Moderator';

update public.profiles
set status = 'suspended'
where id = '50000000-0000-0000-0000-000000000005';

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

-- The content tables carry no grant for `anon` or `authenticated`, which is the
-- contract under test. These owner-privileged helpers let the assertions read
-- state without weakening that, and without the test having to drop back to
-- `postgres` between every check.
create or replace function pg_temp.plaza(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.plaza_posts_count(p_slug text)
returns integer language sql security definer set search_path = '' as $$
  select posts_count from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.post_counter(p_post_id uuid, p_name text)
returns integer language sql security definer set search_path = '' as $$
  select case p_name
    when 'comments' then comments_count
    when 'likes' then likes_count
    when 'dislikes' then dislikes_count
  end
  from public.posts where posts.id = p_post_id;
$$;

create or replace function pg_temp.comment_depth(p_comment_id uuid)
returns smallint language sql security definer set search_path = '' as $$
  select depth from public.comments where comments.id = p_comment_id;
$$;

create or replace function pg_temp.comment_replies(p_comment_id uuid)
returns integer language sql security definer set search_path = '' as $$
  select replies_count from public.comments where comments.id = p_comment_id;
$$;

create or replace function pg_temp.vote_rows()
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.content_votes;
$$;

create or replace function pg_temp.post_by_title(p_title text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.posts where posts.title = p_title;
$$;

create or replace function pg_temp.audit_count(p_action text)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.audit_logs where audit_logs.action = p_action;
$$;

-- ── Schema, RLS and exposure ───────────────────────────────────────────────

select ok(to_regclass('public.plazas') is not null, 'plazas exists');
select ok(to_regclass('public.posts') is not null, 'posts exists');
select ok(to_regclass('public.comments') is not null, 'comments exists');
select ok(to_regclass('public.content_votes') is not null, 'content_votes exists');
select ok(to_regclass('public.reactions') is not null, 'reactions catalog exists');
select ok(to_regclass('public.content_reactions') is not null, 'content_reactions exists');
select ok(to_regclass('public.bookmarks') is not null, 'bookmarks exists');
select ok(to_regclass('public.tags') is not null, 'tags exists');
select ok(to_regclass('public.post_tags') is not null, 'post_tags exists');

select ok((select relrowsecurity from pg_class where oid = 'public.plazas'::regclass), 'plazas has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.posts'::regclass), 'posts has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.comments'::regclass), 'comments has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.content_votes'::regclass), 'content_votes has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.content_reactions'::regclass), 'content_reactions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.bookmarks'::regclass), 'bookmarks has RLS');

-- Content tables are reached only through RPCs; no Data API role may touch them.
select is(has_table_privilege('anon', 'public.posts', 'select'), false, 'anon cannot select posts');
select is(has_table_privilege('authenticated', 'public.posts', 'select'), false, 'authenticated cannot select posts');
select is(has_table_privilege('authenticated', 'public.comments', 'select'), false, 'authenticated cannot select comments');
select is(has_table_privilege('authenticated', 'public.content_votes', 'select'), false, 'authenticated cannot select votes');
select is(has_table_privilege('authenticated', 'public.bookmarks', 'select'), false, 'authenticated cannot read other bookmarks');
select is(has_table_privilege('authenticated', 'public.plazas', 'update'), false, 'authenticated cannot update plazas');

select is((select count(*) from public.plazas), 9::bigint, 'the nine canonical Plazas are seeded');
select is((select count(*) from public.reactions where is_active), 5::bigint, 'the default reaction catalog is seeded');

-- ── Anonymous visibility ───────────────────────────────────────────────────

set local role anon;
select pg_temp.act_as(null);
select is((select count(*) from public.list_plazas()), 9::bigint, 'anon sees every public Plaza');
select is((select can_post from public.get_plaza('central-plaza')), false, 'anon cannot post');
select is(pg_temp.capture_sqlstate('select * from public.posts'), '42501', 'anon direct post read is denied');
select is(pg_temp.capture_sqlstate($sql$select public.create_post(pg_temp.plaza('central-plaza'),'x','y')$sql$), '42501', 'anon cannot create a post');

-- ── Authoring ──────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('50000000-0000-0000-0000-000000000001');
select is((select can_post from public.get_plaza('central-plaza')), true, 'an active member can post');

create temp table t_post as
select post_id from public.create_post(
  pg_temp.plaza('central-plaza'),
  'A first post',
  'The body of a first post.'
);

select is(pg_temp.plaza_posts_count('central-plaza'), 1, 'publishing increments the Plaza counter');
select is((select count(*) from public.list_posts(pg_temp.plaza('central-plaza'))), 1::bigint, 'the post appears in its Plaza listing');

-- Council Announcements requires an explicit permission to post.
select is(pg_temp.capture_sqlstate($sql$select public.create_post(pg_temp.plaza('council-announcements'),'Not allowed','Refused.')$sql$), '42501', 'a member cannot post in Council Announcements');

select is(pg_temp.capture_sqlstate($sql$select public.create_post(pg_temp.plaza('central-plaza'),'ab','Too short a title.')$sql$), '22023', 'a short title is rejected');
select is(pg_temp.capture_sqlstate($sql$select public.create_post(pg_temp.plaza('central-plaza'),'A valid title','')$sql$), '22023', 'an empty body is rejected');

-- ── Comments ───────────────────────────────────────────────────────────────

select pg_temp.act_as('50000000-0000-0000-0000-000000000002');
create temp table t_comment as
select comment_id from public.create_comment((select post_id from t_post), 'A top-level comment.');
create temp table t_reply as
select comment_id from public.create_comment(
  (select post_id from t_post), 'A reply.', (select comment_id from t_comment)
);

select is(pg_temp.post_counter((select post_id from t_post), 'comments'), 2, 'commenting increments the post counter');
select is(pg_temp.comment_depth((select comment_id from t_reply)), 1::smallint, 'a reply is one level deeper');
select is(pg_temp.comment_replies((select comment_id from t_comment)), 1, 'the parent records its reply');

-- ── Votes ──────────────────────────────────────────────────────────────────

select is((select caller_vote from public.set_post_vote((select post_id from t_post), 1::smallint)), 1::smallint, 'a like is recorded');
select is((select likes_count from public.set_post_vote((select post_id from t_post), 1::smallint)), 1, 'repeating a like is idempotent');
select is((select dislikes_count from public.set_post_vote((select post_id from t_post), -1::smallint)), 1, 'switching to a dislike moves the counter');
select is(pg_temp.post_counter((select post_id from t_post), 'likes'), 0, 'the previous like is withdrawn on switch');
select is((select caller_vote from public.set_post_vote((select post_id from t_post), 0::smallint)), 0::smallint, 'a vote can be withdrawn');
select is(pg_temp.vote_rows(), 0::bigint, 'withdrawing a vote leaves no row');
select is(pg_temp.capture_sqlstate($sql$select public.set_post_vote((select post_id from t_post), 5::smallint)$sql$), '22023', 'an out-of-range vote is rejected');

-- ── Reactions and bookmarks ────────────────────────────────────────────────

select is((select caller_reacted from public.toggle_post_reaction((select post_id from t_post), 'this-is-the-way')), true, 'a reaction is added');
select is((select total from public.toggle_post_reaction((select post_id from t_post), 'this-is-the-way')), 0, 'toggling the same reaction removes it');
select is(pg_temp.capture_sqlstate($sql$select public.toggle_post_reaction((select post_id from t_post), 'no-such-reaction')$sql$), 'P0002', 'an unknown reaction type is rejected');
select is((select bookmarked from public.toggle_bookmark((select post_id from t_post))), true, 'a post can be bookmarked');
select is((select count(*) from public.list_own_bookmarks()), 1::bigint, 'the bookmark appears in the owner listing');
select is((select bookmarked from public.toggle_bookmark((select post_id from t_post))), false, 'a bookmark can be removed');

-- ── Ownership ──────────────────────────────────────────────────────────────

select is(pg_temp.capture_sqlstate($sql$select public.update_own_post((select post_id from t_post), 'Hijacked', 'Nope.')$sql$), '42501', 'a non-author cannot edit a post');
select is(pg_temp.capture_sqlstate($sql$select public.delete_own_post((select post_id from t_post))$sql$), '42501', 'a non-author cannot delete a post');

-- ── Tags ───────────────────────────────────────────────────────────────────

select pg_temp.act_as('50000000-0000-0000-0000-000000000001');
select is((select count(*) from public.set_own_post_tags((select post_id from t_post), array['lore','the-way'])), 2::bigint, 'tags are attached to a post');
select is((select count(*) from public.list_posts(null, 'recent', 'lore')), 1::bigint, 'a listing can be filtered by tag');
select is((select count(*) from public.list_posts(null, 'recent', 'absent-tag')), 0::bigint, 'an unmatched tag returns nothing');
select is(pg_temp.capture_sqlstate($sql$select public.set_own_post_tags((select post_id from t_post), array['a','b','c','d','e','f'])$sql$), '22023', 'more than five tags is rejected');
select is(pg_temp.capture_sqlstate($sql$select public.set_own_post_tags((select post_id from t_post), array['Not A Slug'])$sql$), '22023', 'a non-slug tag is rejected');

-- ── Soft delete ────────────────────────────────────────────────────────────

select ok(public.delete_own_post((select post_id from t_post)) is not null, 'an author removes their own post');
select is((select status::text from public.get_post((select post_id from t_post))), 'deleted_by_author', 'the post is marked as removed by its author');
select is((select body from public.get_post((select post_id from t_post))), null, 'a removed post exposes no body');
select is(pg_temp.plaza_posts_count('central-plaza'), 0, 'removal decrements the Plaza counter');
select is((select count(*) from public.list_posts(pg_temp.plaza('central-plaza'))), 0::bigint, 'a removed post leaves the listing');
select is((select count(*) from public.list_post_comments((select post_id from t_post))), 2::bigint, 'comments on a removed post keep their context');
select is(pg_temp.capture_sqlstate($sql$select public.set_post_vote((select post_id from t_post), 1::smallint)$sql$), 'P0002', 'removed content refuses new engagement');
select is(pg_temp.capture_sqlstate($sql$select public.create_comment((select post_id from t_post), 'Too late.')$sql$), '42501', 'a removed post accepts no new comments');

-- ── Moderator visibility ───────────────────────────────────────────────────

set local role postgres;
insert into public.posts (plaza_id, author_id, title, body, status, published_at)
select id, '50000000-0000-0000-0000-000000000001', 'Hidden post', 'Body.', 'hidden', now()
from public.plazas where slug = 'tavern';
set local role authenticated;

select pg_temp.act_as('50000000-0000-0000-0000-000000000002');
select is((select count(*) from public.get_post(pg_temp.post_by_title('Hidden post'))), 0::bigint, 'a member cannot see hidden content');

select pg_temp.act_as('50000000-0000-0000-0000-000000000004');
select is((select count(*) from public.get_post(pg_temp.post_by_title('Hidden post'))), 1::bigint, 'a moderator can see hidden content');

-- ── Plaza administration and visibility ────────────────────────────────────

select pg_temp.act_as('50000000-0000-0000-0000-000000000003');
select ok(public.admin_create_plaza('inner-ring', 'Inner Ring', null, 'members') is not null, 'an administrator creates a members-only Plaza');
select ok(public.admin_create_plaza('war-room', 'War Room', null, 'private') is not null, 'an administrator creates a private Plaza');
select is(pg_temp.audit_count('plaza.create'), 2::bigint, 'Plaza creation is audited');

set local role anon;
select pg_temp.act_as(null);
select is((select count(*) from public.get_plaza('inner-ring')), 0::bigint, 'anon cannot see a members-only Plaza');
select is((select count(*) from public.get_plaza('war-room')), 0::bigint, 'anon cannot see a private Plaza');

set local role authenticated;
select pg_temp.act_as('50000000-0000-0000-0000-000000000002');
select is((select count(*) from public.get_plaza('inner-ring')), 1::bigint, 'a member sees a members-only Plaza');
select is((select count(*) from public.get_plaza('war-room')), 0::bigint, 'a member cannot see a private Plaza');

select pg_temp.act_as('50000000-0000-0000-0000-000000000003');
select is((select count(*) from public.get_plaza('war-room')), 1::bigint, 'an administrator sees a private Plaza');

-- Archiving is compare-and-swap, so a stale screen cannot overwrite a change.
select is(pg_temp.capture_sqlstate($sql$select public.admin_set_plaza_status(pg_temp.plaza('tavern'), 'archived', 'archived', 'Stale expectation')$sql$), '40001', 'a stale expected status is rejected');
select ok(public.admin_set_plaza_status(pg_temp.plaza('tavern'), 'active', 'archived', 'Archived by contract test') is not null, 'an administrator archives a Plaza');

select pg_temp.act_as('50000000-0000-0000-0000-000000000002');
select is(pg_temp.capture_sqlstate($sql$select public.create_post(pg_temp.plaza('tavern'),'Nope','Refused.')$sql$), '42501', 'an archived Plaza accepts no new posts');
select is(pg_temp.capture_sqlstate($sql$select public.admin_create_plaza('member-made','Member Made')$sql$), '42501', 'a member cannot create a Plaza');

-- ── Suspended account ──────────────────────────────────────────────────────

select pg_temp.act_as('50000000-0000-0000-0000-000000000005');
select is(pg_temp.capture_sqlstate($sql$select public.create_post(pg_temp.plaza('central-plaza'),'Suspended','Refused.')$sql$), '42501', 'a suspended member cannot post');
select is(pg_temp.capture_sqlstate($sql$select public.set_post_vote((select post_id from t_post), 1::smallint)$sql$), '42501', 'a suspended member cannot vote');
select is((select count(*) from public.list_plazas()), 9::bigint, 'a suspended member still reads public Plazas');

-- ── Counter drift repair ───────────────────────────────────────────────────

set local role postgres;
update public.plazas set posts_count = 999 where slug = 'central-plaza';
select private.recalculate_content_counters();
select is(pg_temp.plaza_posts_count('central-plaza'), 0, 'counter recalculation repairs drift');

select * from extensions.finish();
rollback;
