begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(58);

-- Fixtures exercise the real signup triggers, so profiles and the default role
-- arrive the same way they do in production.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'r-author@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Report Author"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'r-reporter@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Reporter"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'r-second@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Second Reporter"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'r-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Report Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'r-mod-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Second Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'r-suspended@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Suspended Reporter"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select '60000000-0000-0000-0000-000000000004', id from public.roles where name = 'Moderator';

insert into public.user_roles (user_id, role_id)
select '60000000-0000-0000-0000-000000000005', id from public.roles where name = 'Moderator';

update public.profiles
set status = 'suspended'
where id = '60000000-0000-0000-0000-000000000006';

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

-- `content_reports` carries no grant for `anon` or `authenticated`, which is
-- the contract under test. These owner-privileged helpers read state without
-- weakening it.
create or replace function pg_temp.plaza(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.plazas where plazas.slug = p_slug;
$$;

create or replace function pg_temp.report_rows()
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.content_reports;
$$;

create or replace function pg_temp.report_status(p_report_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.content_reports where content_reports.id = p_report_id;
$$;

create or replace function pg_temp.report_field(p_report_id uuid, p_name text)
returns text language sql security definer set search_path = '' as $$
  select case p_name
    when 'resolution' then resolution
    when 'resolved_by' then resolved_by::text
    when 'resolved_at' then resolved_at::text
  end
  from public.content_reports where content_reports.id = p_report_id;
$$;

create or replace function pg_temp.audit_count(p_action text)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.audit_logs where audit_logs.action = p_action;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.content_reports') is not null, 'content_reports exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.content_reports'::regclass),
  'content_reports has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'content_reports'),
  0::bigint,
  'content_reports carries no policy, so RLS denies everything'
);
select is(has_table_privilege('anon', 'public.content_reports', 'select'), false, 'anon cannot select reports');
select is(has_table_privilege('authenticated', 'public.content_reports', 'select'), false, 'authenticated cannot select reports');
select is(has_table_privilege('authenticated', 'public.content_reports', 'insert'), false, 'authenticated cannot insert a report directly');
select is(has_function_privilege('anon', 'public.create_report(public.report_reason, uuid, uuid, uuid, text)', 'execute'), false, 'anon cannot file a report');
select is(has_function_privilege('authenticated', 'public.create_report(public.report_reason, uuid, uuid, uuid, text)', 'execute'), true, 'a member can file a report');
select is(has_function_privilege('anon', 'public.moderation_list_reports(public.report_status, timestamptz, uuid, integer)', 'execute'), false, 'anon cannot read the queue');

-- ── Fixture content ────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('60000000-0000-0000-0000-000000000001');

create temp table t_post as
select post_id from public.create_post(
  pg_temp.plaza('central-plaza'),
  'A reportable post',
  'The body of a reportable post.'
);

create temp table t_comment as
select comment_id from public.create_comment(
  (select post_id from t_post),
  'A reportable comment.'
);

-- ── Filing ─────────────────────────────────────────────────────────────────

select pg_temp.act_as('60000000-0000-0000-0000-000000000002');

create temp table t_report as
select report_id from public.create_report(
  'spam'::public.report_reason,
  (select post_id from t_post),
  null,
  null,
  '  This is repeated advertising.  '
);

select ok((select report_id from t_report) is not null, 'a member files a report on a post');
select is(pg_temp.report_status((select report_id from t_report)), 'open', 'a new report starts open');
select is(pg_temp.report_field((select report_id from t_report), 'resolved_at'), null, 'a new report has no resolution timestamp');

select ok(
  public.create_report('harassment'::public.report_reason, null, (select comment_id from t_comment)) is not null,
  'a member files a report on a comment'
);
select ok(
  public.create_report('impersonation'::public.report_reason, null, null, '60000000-0000-0000-0000-000000000001') is not null,
  'a member files a report on a profile'
);

-- Duplicate suppression: the same reporter cannot pile onto a live report.
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, (select post_id from t_post))$sql$),
  '23505',
  'a second live report on the same post by the same reporter is refused'
);

-- A different reporter is not duplicate abuse; that is the brigading signal.
select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select ok(
  public.create_report('spam'::public.report_reason, (select post_id from t_post)) is not null,
  'a different reporter may report the same post'
);

-- ── Filing is validated ────────────────────────────────────────────────────

select pg_temp.act_as('60000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason)$sql$),
  '22023',
  'a report with no target is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, (select post_id from t_post), (select comment_id from t_comment))$sql$),
  '22023',
  'a report naming two targets is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, '99999999-0000-4000-8000-000000000001')$sql$),
  'P0002',
  'a report on a post that does not exist is refused as missing'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, null, '99999999-0000-4000-8000-000000000002')$sql$),
  'P0002',
  'a report on a comment that does not exist is refused as missing'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, null, null, '99999999-0000-4000-8000-000000000003')$sql$),
  'P0002',
  'a report on a profile that does not exist is refused as missing'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('other'::public.report_reason, null, null, '60000000-0000-0000-0000-000000000002')$sql$),
  '22023',
  'a member cannot report their own profile'
);

select pg_temp.act_as('60000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, (select post_id from t_post))$sql$),
  '22023',
  'an author cannot report their own post'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, null, (select comment_id from t_comment))$sql$),
  '22023',
  'an author cannot report their own comment'
);

select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, null, (select comment_id from t_comment), null, repeat('x', 1001))$sql$),
  '22023',
  'details beyond the ceiling are refused'
);

-- ── Suspended and anonymous accounts ───────────────────────────────────────

select pg_temp.act_as('60000000-0000-0000-0000-000000000006');
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, (select post_id from t_post))$sql$),
  '42501',
  'a suspended member cannot file a report'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('spam'::public.report_reason, (select post_id from t_post))$sql$),
  '42501',
  'anon cannot file a report'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.content_reports$sql$),
  '42501',
  'anon cannot read reports directly'
);

-- ── The queue is moderator-only ────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('60000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_list_reports()$sql$),
  '42501',
  'a reporter cannot read the queue'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_get_report((select report_id from t_report))$sql$),
  '42501',
  'a reporter cannot read their own report back'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status((select report_id from t_report), 'open', 'dismissed', 'Not my call')$sql$),
  '42501',
  'a member cannot resolve a report'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.content_reports$sql$),
  '42501',
  'a member cannot read reports directly'
);

-- ── A moderator works the queue ────────────────────────────────────────────

select pg_temp.act_as('60000000-0000-0000-0000-000000000004');
select is(
  (select count(*) from public.moderation_list_reports('open'::public.report_status)),
  4::bigint,
  'the moderator sees every open report'
);
select is(
  (select target_type from public.moderation_list_reports('open'::public.report_status)
   where target_id = (select post_id from t_post) limit 1),
  'post',
  'a post report is labelled as a post'
);
select is(
  (select open_report_count from public.moderation_list_reports('open'::public.report_status)
   where target_id = (select post_id from t_post) limit 1),
  2,
  'the queue counts the live reports naming the same target'
);
select is(
  (select reporter_display_name from public.moderation_list_reports('open'::public.report_status)
   where report_id = (select report_id from t_report)),
  'Reporter',
  'the queue names the reporter'
);
select is(
  (select details from public.moderation_list_reports('open'::public.report_status)
   where report_id = (select report_id from t_report)),
  'This is repeated advertising.',
  'the reporter''s details are trimmed but preserved'
);
select is(
  (select count(*) from public.moderation_list_reports('resolved'::public.report_status)),
  0::bigint,
  'nothing is resolved yet'
);
select is(
  (select count(*) from public.moderation_list_reports(null)),
  4::bigint,
  'a null status filter returns every report'
);
select is(
  (select count(*) from public.moderation_list_reports('open'::public.report_status, null, null, 2)),
  2::bigint,
  'the queue honours the page size'
);
select is(
  (select target_body from public.moderation_get_report((select report_id from t_report))),
  'The body of a reportable post.',
  'opening a report shows the evidence'
);
select is(
  (select target_status from public.moderation_get_report((select report_id from t_report))),
  'published',
  'opening a report shows the current state of the target'
);

-- ── Claiming and resolving ─────────────────────────────────────────────────

select ok(
  public.moderation_set_report_status((select report_id from t_report), 'open', 'under_review') is not null,
  'a moderator claims a report'
);
select is(pg_temp.report_status((select report_id from t_report)), 'under_review', 'the claim is recorded');

-- Compare-and-swap: a second moderator on a stale queue cannot overwrite.
select pg_temp.act_as('60000000-0000-0000-0000-000000000005');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status((select report_id from t_report), 'open', 'under_review')$sql$),
  '40001',
  'a stale expected status is rejected'
);

select pg_temp.act_as('60000000-0000-0000-0000-000000000004');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status((select report_id from t_report), 'under_review', 'under_review')$sql$),
  '22023',
  'setting the status it already has is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status((select report_id from t_report), 'under_review', 'resolved', 'ok')$sql$),
  '22023',
  'closing a report needs a reason of at least three characters'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status((select report_id from t_report), 'under_review', 'open', 'Reopening with a reason')$sql$),
  '22023',
  'a resolution belongs only to a closed report'
);

select ok(
  public.moderation_set_report_status(
    (select report_id from t_report), 'under_review', 'resolved', 'Removed the advertising.'
  ) is not null,
  'a moderator resolves a claimed report'
);
select is(pg_temp.report_status((select report_id from t_report)), 'resolved', 'the resolution is recorded');
select is(
  pg_temp.report_field((select report_id from t_report), 'resolution'),
  'Removed the advertising.',
  'the reason is stored with the report'
);
select is(
  pg_temp.report_field((select report_id from t_report), 'resolved_by'),
  '60000000-0000-0000-0000-000000000004',
  'the report records who closed it'
);
select ok(
  pg_temp.report_field((select report_id from t_report), 'resolved_at') is not null,
  'the report records when it was closed'
);
select is(pg_temp.audit_count('report.status'), 2::bigint, 'claiming and resolving are both audited');

-- ── A closed report stays closed ───────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status((select report_id from t_report), 'resolved', 'open')$sql$),
  '22023',
  'a closed report cannot be reopened'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_set_report_status('99999999-0000-4000-8000-000000000009', 'open', 'dismissed', 'Nothing there')$sql$),
  'P0002',
  'resolving a report that does not exist is refused as missing'
);

-- Filing again after closure is allowed: the content may have changed since.
select pg_temp.act_as('60000000-0000-0000-0000-000000000002');
select ok(
  public.create_report('spam'::public.report_reason, (select post_id from t_post)) is not null,
  'the same reporter may file again once the first report is closed'
);

-- ── Rate limit ─────────────────────────────────────────────────────────────

set local role postgres;
-- Already-closed rows: the limit counts what was filed in the window whatever
-- became of it, and closed rows sidestep the one-live-report-per-target index.
insert into public.content_reports (
  reporter_id, profile_id, reason, status, resolution, resolved_by, resolved_at
)
select
  '60000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000001',
  'other'::public.report_reason,
  'dismissed'::public.report_status,
  'Filed in bulk by the contract test.',
  '60000000-0000-0000-0000-000000000004',
  now()
from generate_series(1, 9);

set local role authenticated;
select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.create_report('other'::public.report_reason, null, (select comment_id from t_comment))$sql$),
  '53400',
  'the report rate limit is enforced from the reports themselves'
);

select * from extensions.finish();
rollback;
