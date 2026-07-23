begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(105);

-- Fixtures exercise the real signup triggers, so profiles and the default role
-- arrive the same way they do in production.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm-author@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Author"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm-second@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Second Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Moderator One"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'm-guardian@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Guardian One"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'm-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Admin One"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select '80000000-0000-0000-0000-000000000003', id from public.roles where name = 'Moderator';

insert into public.user_roles (user_id, role_id)
select '80000000-0000-0000-0000-000000000004', id from public.roles where name = 'Guardian';

insert into public.user_roles (user_id, role_id)
select '80000000-0000-0000-0000-000000000005', id from public.roles where name = 'Administrator';

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

-- The content tables carry no grant for `anon` or `authenticated`. These
-- owner-privileged helpers read ground truth without weakening that, and
-- without dropping back to `postgres` between every assertion.
create or replace function pg_temp.plaza(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.plaza_posts_count(p_slug text)
returns integer language sql security definer set search_path = '' as $$
  select posts_count from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.post_status(p_post_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.posts where posts.id = p_post_id;
$$;

create or replace function pg_temp.post_flag(p_post_id uuid, p_name text)
returns boolean language sql security definer set search_path = '' as $$
  select case p_name
    when 'is_pinned' then is_pinned
    when 'is_highlighted' then is_highlighted
    when 'edit_locked' then edit_locked
  end
  from public.posts where posts.id = p_post_id;
$$;

create or replace function pg_temp.post_plaza_slug(p_post_id uuid)
returns text language sql security definer set search_path = '' as $$
  select plazas.slug from public.posts
  join public.plazas on plazas.id = posts.plaza_id
  where posts.id = p_post_id;
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

create or replace function pg_temp.comment_status(p_comment_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.comments where comments.id = p_comment_id;
$$;

create or replace function pg_temp.comment_flag(p_comment_id uuid, p_name text)
returns boolean language sql security definer set search_path = '' as $$
  select case p_name
    when 'is_pinned' then is_pinned
    when 'replies_locked' then replies_locked
  end
  from public.comments where comments.id = p_comment_id;
$$;

create or replace function pg_temp.comment_replies(p_comment_id uuid)
returns integer language sql security definer set search_path = '' as $$
  select replies_count from public.comments where comments.id = p_comment_id;
$$;

create or replace function pg_temp.audit_count_for(p_action text, p_target_id uuid)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.audit_logs
  where audit_logs.action = p_action and audit_logs.target_id = p_target_id;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(
  exists (select 1 from pg_attribute where attrelid = 'public.comments'::regclass and attname = 'is_pinned' and not attisdropped),
  'comments.is_pinned exists'
);
select ok(
  exists (select 1 from pg_attribute where attrelid = 'public.comments'::regclass and attname = 'replies_locked' and not attisdropped),
  'comments.replies_locked exists'
);

select is(has_function_privilege('anon', 'public.moderation_set_post_status(uuid, public.post_status, public.post_status, text)', 'execute'), false, 'anon cannot execute moderation_set_post_status');
select is(has_function_privilege('authenticated', 'public.moderation_set_post_status(uuid, public.post_status, public.post_status, text)', 'execute'), true, 'authenticated can execute moderation_set_post_status');
select is(has_function_privilege('anon', 'public.moderation_set_post_flags(uuid, text, boolean, boolean, boolean)', 'execute'), false, 'anon cannot execute moderation_set_post_flags');
select is(has_function_privilege('authenticated', 'public.moderation_set_post_flags(uuid, text, boolean, boolean, boolean)', 'execute'), true, 'authenticated can execute moderation_set_post_flags');
select is(has_function_privilege('anon', 'public.moderation_move_post(uuid, uuid, text)', 'execute'), false, 'anon cannot execute moderation_move_post');
select is(has_function_privilege('authenticated', 'public.moderation_move_post(uuid, uuid, text)', 'execute'), true, 'authenticated can execute moderation_move_post');
select is(has_function_privilege('anon', 'public.moderation_set_comment_status(uuid, public.comment_status, public.comment_status, text)', 'execute'), false, 'anon cannot execute moderation_set_comment_status');
select is(has_function_privilege('authenticated', 'public.moderation_set_comment_status(uuid, public.comment_status, public.comment_status, text)', 'execute'), true, 'authenticated can execute moderation_set_comment_status');
select is(has_function_privilege('anon', 'public.moderation_set_comment_flags(uuid, text, boolean, boolean)', 'execute'), false, 'anon cannot execute moderation_set_comment_flags');
select is(has_function_privilege('authenticated', 'public.moderation_set_comment_flags(uuid, text, boolean, boolean)', 'execute'), true, 'authenticated can execute moderation_set_comment_flags');
select is(has_function_privilege('anon', 'public.list_post_comments(uuid, timestamptz, uuid, integer)', 'execute'), true, 'list_post_comments stays grantable to anon');

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status('00000000-0000-0000-0000-000000000000'::uuid, 'published'::public.post_status)$sql$),
  '42883',
  'no two-argument overload of moderation_set_post_status exists'
);

-- ── Fixture content ────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('80000000-0000-0000-0000-000000000001');

create temp table t_post_a as
select post_id from public.create_post(pg_temp.plaza('central-plaza'), 'Lifecycle post title', 'Lifecycle post body content.');
create temp table t_post_b as
select post_id from public.create_post(pg_temp.plaza('central-plaza'), 'Draft post title', 'Draft post body content.', false);
create temp table t_post_c as
select post_id from public.create_post(pg_temp.plaza('central-plaza'), 'Terminal post title', 'Terminal post body content.');
create temp table t_post_d as
select post_id from public.create_post(pg_temp.plaza('central-plaza'), 'Move post title', 'Move post body content.');

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');

create temp table t_c1 as
select comment_id from public.create_comment((select post_id from t_post_a), 'Top comment one.');
create temp table t_r1 as
select comment_id from public.create_comment((select post_id from t_post_a), 'Reply to comment one.', (select comment_id from t_c1));
create temp table t_c2 as
select comment_id from public.create_comment((select post_id from t_post_a), 'Top comment two.');
create temp table t_c3 as
select comment_id from public.create_comment((select post_id from t_post_a), 'Top comment three.');
create temp table t_c4 as
select comment_id from public.create_comment((select post_id from t_post_a), 'Top comment four.');

select pg_temp.act_as('80000000-0000-0000-0000-000000000001');
select ok(public.delete_own_post((select post_id from t_post_c)) is not null, 'fixture: the author removes their own post');

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select ok(public.delete_own_comment((select comment_id from t_c3)) is not null, 'fixture: the author removes their own comment');

select pg_temp.act_as('80000000-0000-0000-0000-000000000005');
create temp table t_quiet_hall as
select plaza_id from public.admin_create_plaza('quiet-hall', 'Quiet Hall');
select public.admin_set_plaza_status((select plaza_id from t_quiet_hall), 'active', 'archived', 'Archived for the move-refusal fixture.');

-- ── Post status: permission split (rule 2) ─────────────────────────────────

select pg_temp.act_as('80000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_a), 'published', 'quarantined', 'Testing quarantine denial.')$sql$),
  '42501',
  'a plain Moderator is refused moderation.quarantine on a post'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_a), 'published', 'deleted_by_moderator', 'Testing delete denial.')$sql$),
  '42501',
  'a plain Moderator is refused moderation.delete on a post'
);

-- ── Post status: hide, CAS, restore (rule 1, rule 5) ───────────────────────

select ok(
  public.moderation_set_post_status((select post_id from t_post_a), 'published', 'hidden', 'Hiding for the contract test.') is not null,
  'a Moderator hides a published post'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 1, 'hiding a published post decrements the Plaza counter');
select is(pg_temp.post_status((select post_id from t_post_a)), 'hidden', 'the post is now hidden');
select is(pg_temp.audit_count_for('post.status', (select post_id from t_post_a)), 1::bigint, 'the hide is audited');

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_a), 'published', 'hidden', 'Stale expectation.')$sql$),
  '40001',
  'a stale expected status is rejected'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_a), 'hidden', 'hidden', 'Same status.')$sql$),
  '22023',
  'setting the status it already has is refused'
);

select ok(
  public.moderation_set_post_status((select post_id from t_post_a), 'hidden', 'published', 'Restoring for the contract test.') is not null,
  'a Moderator restores a hidden post'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 2, 'restoring a post increments the Plaza counter again');
select is(pg_temp.post_status((select post_id from t_post_a)), 'published', 'the post is published again');

-- ── Post status: moderation cannot return a post to the author workflow (rule 4)

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_a), 'published', 'draft', 'Trying to send it back to draft.')$sql$),
  '22023',
  'moderation cannot send a post to draft'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_a), 'published', 'pending_review', 'Trying to send it back to review.')$sql$),
  '22023',
  'moderation cannot send a post to pending_review'
);

-- ── Post status: Guardian holds quarantine where Moderator does not ───────

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select ok(
  public.moderation_set_post_status((select post_id from t_post_a), 'published', 'quarantined', 'Guardian quarantines the post.') is not null,
  'a Guardian quarantines a published post'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 1, 'quarantining a published post decrements the Plaza counter');
select is(pg_temp.post_status((select post_id from t_post_a)), 'quarantined', 'the post is now quarantined');

-- ── Post flags (rule 6) ─────────────────────────────────────────────────────

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_flags((select post_id from t_post_a), 'Trying to pin without permission.', true)$sql$),
  '42501',
  'a plain member is refused moderation_set_post_flags'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_flags((select post_id from t_post_a), 'No flag given.')$sql$),
  '22023',
  'post flags with every argument null is refused'
);
select ok(
  public.moderation_set_post_flags((select post_id from t_post_a), 'Pinning a quarantined post.', true) is not null,
  'a quarantined (not removed) post can still be pinned'
);
select is(pg_temp.post_flag((select post_id from t_post_a), 'is_pinned'), true, 'the pin is recorded');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_flags((select post_id from t_post_a), 'Same value again.', true)$sql$),
  '22023',
  'post flags with no actual change is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_flags((select post_id from t_post_c), 'Trying to flag a removed post.', true)$sql$),
  '22023',
  'a removed post carries no flags'
);

-- ── Post status: restore the quarantined post, then deleted_by_author is terminal (rule 3)

select pg_temp.act_as('80000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_set_post_status((select post_id from t_post_a), 'quarantined', 'published', 'Restoring the quarantined post.') is not null,
  'a Moderator restores a quarantined post'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 2, 'restoring the quarantined post increments the Plaza counter again');
select is(pg_temp.post_status((select post_id from t_post_a)), 'published', 'the post is published once more');

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_c), 'deleted_by_author', 'published', 'Trying to undo the author''s removal.')$sql$),
  '22023',
  'a post removed by its author can only be deleted further, not restored'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_post_status((select post_id from t_post_c), 'deleted_by_author', 'deleted_by_moderator', 'Trying to delete further.')$sql$),
  '42501',
  'a plain Moderator is refused moderation.delete even to delete an author-removed post further'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select ok(
  public.moderation_set_post_status((select post_id from t_post_c), 'deleted_by_author', 'deleted_by_moderator', 'Deleting further as a Guardian.') is not null,
  'a Guardian deletes an author-removed post further'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 2, 'a post never counted stays uncounted when deleted further');
select is(pg_temp.post_status((select post_id from t_post_c)), 'deleted_by_moderator', 'the post is now deleted by a moderator');

-- ── Post status: never-counted state moving to hidden does not touch the counter (rule 5)

select ok(
  public.moderation_set_post_status((select post_id from t_post_b), 'draft', 'hidden', 'Hiding an unpublished draft.') is not null,
  'a Guardian hides a draft post'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 2, 'hiding a post that was never counted does not change the Plaza counter');
select is(pg_temp.post_status((select post_id from t_post_b)), 'hidden', 'the draft is now hidden');

-- ── Post move (rule 7) ──────────────────────────────────────────────────────

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_move_post((select post_id from t_post_d), pg_temp.plaza('tavern'), 'Trying to move without permission.')$sql$),
  '42501',
  'a plain member is refused moderation_move_post'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_move_post((select post_id from t_post_d), pg_temp.plaza('central-plaza'), 'Moving into its own Plaza.')$sql$),
  '22023',
  'moving a post into the Plaza it already occupies is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_move_post((select post_id from t_post_d), (select plaza_id from t_quiet_hall), 'Moving into an archived Plaza.')$sql$),
  '22023',
  'moving a post into an archived Plaza is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_move_post((select post_id from t_post_d), '99999999-0000-4000-8000-000000000099', 'Moving into nothing.')$sql$),
  'P0002',
  'moving a post into a Plaza that does not exist is refused as missing'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_move_post((select post_id from t_post_c), pg_temp.plaza('tavern'), 'Trying to move a removed post.')$sql$),
  '22023',
  'a removed post cannot be moved'
);

select ok(
  public.moderation_move_post((select post_id from t_post_d), pg_temp.plaza('tavern'), 'Moved to the Tavern by the contract test.') is not null,
  'a Moderator moves a post to another active Plaza'
);
select is(pg_temp.plaza_posts_count('central-plaza'), 1, 'the source Plaza counter is decremented');
select is(pg_temp.plaza_posts_count('tavern'), 1, 'the destination Plaza counter is incremented');
select is(pg_temp.post_plaza_slug((select post_id from t_post_d)), 'tavern', 'the post now belongs to the destination Plaza');
select is(pg_temp.audit_count_for('post.moved', (select post_id from t_post_d)), 1::bigint, 'the move is audited');

-- ── Comment status: permission split, CAS, restore (rule 1, rule 2) ────────

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_status((select comment_id from t_c2), 'published', 'quarantined', 'Testing quarantine denial.')$sql$),
  '42501',
  'a plain Moderator is refused moderation.quarantine on a comment'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_status((select comment_id from t_c2), 'published', 'deleted_by_moderator', 'Testing delete denial.')$sql$),
  '42501',
  'a plain Moderator is refused moderation.delete on a comment'
);

select ok(
  public.moderation_set_comment_status((select comment_id from t_c2), 'published', 'hidden', 'Hiding a comment.') is not null,
  'a Moderator hides a published comment'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 3, 'hiding a top-level comment decrements the post counter');
select is(pg_temp.comment_status((select comment_id from t_c2)), 'hidden', 'the comment is now hidden');

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_status((select comment_id from t_c2), 'published', 'hidden', 'Stale expectation.')$sql$),
  '40001',
  'a stale expected status is rejected for a comment'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_status((select comment_id from t_c2), 'hidden', 'hidden', 'Same status.')$sql$),
  '22023',
  'setting the comment status it already has is refused'
);

select ok(
  public.moderation_set_comment_status((select comment_id from t_c2), 'hidden', 'published', 'Restoring a comment.') is not null,
  'a Moderator restores a hidden comment'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 4, 'restoring a comment increments the post counter again');

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select ok(
  public.moderation_set_comment_status((select comment_id from t_c2), 'published', 'quarantined', 'A Guardian quarantines the comment.') is not null,
  'a Guardian quarantines a published comment where a Moderator could not'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 3, 'quarantining a comment decrements the post counter');
select is(pg_temp.comment_status((select comment_id from t_c2)), 'quarantined', 'the comment is now quarantined');
select is(pg_temp.audit_count_for('comment.status', (select comment_id from t_c2)), 3::bigint, 'every successful comment status change is audited');

-- ── Comment status: deleted_by_author is terminal (rule 3) ────────────────

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_status((select comment_id from t_c3), 'deleted_by_author', 'published', 'Trying to undo the author''s removal.')$sql$),
  '22023',
  'a comment removed by its author can only be deleted further, not restored'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_status((select comment_id from t_c3), 'deleted_by_author', 'deleted_by_moderator', 'Trying to delete further.')$sql$),
  '42501',
  'a plain Moderator is refused moderation.delete on a comment'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select ok(
  public.moderation_set_comment_status((select comment_id from t_c3), 'deleted_by_author', 'deleted_by_moderator', 'Deleting further as a Guardian.') is not null,
  'a Guardian deletes an author-removed comment further'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 3, 'a comment never counted stays uncounted when deleted further');
select is(pg_temp.comment_status((select comment_id from t_c3)), 'deleted_by_moderator', 'the comment is now deleted by a moderator');

-- ── Comment status: hiding/restoring a reply moves its parent's counter (rule 5)

select ok(
  public.moderation_set_comment_status((select comment_id from t_r1), 'published', 'hidden', 'Hiding a reply.') is not null,
  'a Guardian hides a reply'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 2, 'hiding a reply decrements the post counter');
select is(pg_temp.comment_replies((select comment_id from t_c1)), 0, 'hiding a reply decrements its parent''s reply counter');

select ok(
  public.moderation_set_comment_status((select comment_id from t_r1), 'hidden', 'published', 'Restoring a reply.') is not null,
  'a Guardian restores a reply'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 3, 'restoring a reply increments the post counter again');
select is(pg_temp.comment_replies((select comment_id from t_c1)), 1, 'restoring a reply increments its parent''s reply counter again');

-- ── Comment flags (rule 6, rule 8) ─────────────────────────────────────────

select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_flags((select comment_id from t_c4), 'Trying to pin without permission.', true)$sql$),
  '42501',
  'a plain member is refused moderation_set_comment_flags'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_flags((select comment_id from t_c4), 'No flag given.')$sql$),
  '22023',
  'comment flags with every argument null is refused'
);
select ok(
  public.moderation_set_comment_flags((select comment_id from t_c4), 'Pinning a comment.', true) is not null,
  'a Guardian pins a comment'
);
select is(pg_temp.comment_flag((select comment_id from t_c4), 'is_pinned'), true, 'the pin is recorded');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_flags((select comment_id from t_c4), 'Same value again.', true)$sql$),
  '22023',
  'comment flags with no actual change is refused'
);
select ok(
  public.moderation_set_comment_flags((select comment_id from t_c4), 'Locking replies.', null, true) is not null,
  'a Guardian locks replies on a comment'
);
select is(pg_temp.comment_flag((select comment_id from t_c4), 'replies_locked'), true, 'the reply lock is recorded');

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_flags((select comment_id from t_c3), 'Trying to flag a removed comment.', true)$sql$),
  '22023',
  'only a published comment carries flags (removed comment)'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_comment_flags((select comment_id from t_c2), 'Trying to flag a quarantined comment.', true)$sql$),
  '22023',
  'only a published comment carries flags (quarantined comment, unlike a quarantined post)'
);

-- ── create_comment refuses a locked parent (rule 8) ────────────────────────

select pg_temp.act_as('80000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select public.create_comment((select post_id from t_post_a), 'Trying to reply to a locked comment.', (select comment_id from t_c4))$sql$),
  '42501',
  'a reply under a replies_locked comment is refused'
);

-- ── list_post_comments exposes the new flags and keeps the quarantine rule (rule 9)

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select ok(
  public.moderation_set_comment_status((select comment_id from t_c1), 'published', 'quarantined', 'Quarantining a comment with a live reply.') is not null,
  'a Guardian quarantines a comment that still has a reply'
);
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 2, 'quarantining that comment decrements the post counter');
select is(pg_temp.comment_replies((select comment_id from t_c1)), 1, 'the quarantined comment keeps its own reply counter');

select pg_temp.act_as('80000000-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.list_post_comments((select post_id from t_post_a)) where id = (select comment_id from t_c1)),
  1::bigint,
  'a quarantined comment with a live reply stays visible to a non-moderator'
);
select is(
  (select count(*) from public.list_post_comments((select post_id from t_post_a)) where id = (select comment_id from t_c2)),
  0::bigint,
  'a quarantined comment with no replies is hidden from a non-moderator'
);
select is(
  (select is_pinned from public.list_post_comments((select post_id from t_post_a)) where id = (select comment_id from t_c4)),
  true,
  'list_post_comments exposes is_pinned'
);
select is(
  (select replies_locked from public.list_post_comments((select post_id from t_post_a)) where id = (select comment_id from t_c4)),
  true,
  'list_post_comments exposes replies_locked'
);

select pg_temp.act_as('80000000-0000-0000-0000-000000000004');
select is(
  (select count(*) from public.list_post_comments((select post_id from t_post_a)) where id = (select comment_id from t_c2)),
  1::bigint,
  'a Guardian still sees a quarantined comment with no replies'
);

-- ── Counter repair covers the thread counters too (rule 10) ────────────────

set local role postgres;
update public.plazas set posts_count = 999 where slug = 'central-plaza';
update public.posts set comments_count = 999, likes_count = 999 where id = (select post_id from t_post_a);
update public.comments set replies_count = 999 where id = (select comment_id from t_c1);

select private.recalculate_content_counters();

select is(pg_temp.plaza_posts_count('central-plaza'), 1, 'counter recalculation still repairs the Plaza post total');
select is(pg_temp.post_counter((select post_id from t_post_a), 'comments'), 2, 'counter recalculation repairs a post''s comments_count');
select is(pg_temp.comment_replies((select comment_id from t_c1)), 1, 'counter recalculation repairs a comment''s replies_count');
select is(pg_temp.post_counter((select post_id from t_post_a), 'likes'), 0, 'counter recalculation leaves the vote repair it already did intact');

select * from extensions.finish();
rollback;
