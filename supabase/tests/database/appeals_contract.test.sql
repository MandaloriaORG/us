begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(52);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ap-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Appealing Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ap-mod-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"First Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ap-mod-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Second Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'ap-bystander@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Bystander"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'b0000000-0000-0000-0000-000000000002', id from public.roles where name = 'Moderator';
insert into public.user_roles (user_id, role_id)
select 'b0000000-0000-0000-0000-000000000003', id from public.roles where name = 'Moderator';

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

-- Owner-privileged readers: the tables under test carry no grant, which is
-- itself part of the contract.
create or replace function pg_temp.latest_audit(p_action text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.audit_logs
  where audit_logs.action = p_action
  order by audit_logs.created_at desc, audit_logs.id desc
  limit 1;
$$;

-- `now()` is the transaction clock, so every row this suite writes shares one
-- timestamp and "the latest audit row" is not well defined. Warnings are
-- therefore looked up by the id the RPC returned, not by time.
create or replace function pg_temp.audit_for_warning(p_warning_id uuid)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.audit_logs
  where audit_logs.action = 'user.warned'
    and audit_logs.metadata ->> 'warning_id' = p_warning_id::text;
$$;

create or replace function pg_temp.appeal_rows()
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.moderation_appeals;
$$;

create or replace function pg_temp.appeal_status(p_appeal_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.moderation_appeals where moderation_appeals.id = p_appeal_id;
$$;

create or replace function pg_temp.set_profile_status(p_user_id uuid, p_status text)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set status = p_status where profiles.id = p_user_id;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.moderation_appeals') is not null, 'moderation_appeals exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.moderation_appeals'::regclass),
  'moderation_appeals has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'moderation_appeals'),
  0::bigint,
  'moderation_appeals carries no policy, so RLS denies everything'
);
select is(
  has_table_privilege('anon', 'public.moderation_appeals', 'select'),
  false,
  'anon cannot select appeals'
);
select is(
  has_table_privilege('authenticated', 'public.moderation_appeals', 'select'),
  false,
  'a member cannot select appeals directly'
);
select is(
  has_function_privilege('anon', 'public.create_appeal(uuid, text)', 'execute'),
  false,
  'anon cannot file an appeal'
);
select is(
  has_function_privilege('anon', 'public.moderation_list_appeals(public.appeal_status, timestamptz, uuid, integer)', 'execute'),
  false,
  'anon cannot read the appeal queue'
);
select is(
  has_function_privilege('authenticated', 'private.purge_expired_moderation_evidence(interval)', 'execute'),
  false,
  'the retention job is not callable by a member'
);

-- ── An action to argue with ────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('b0000000-0000-0000-0000-000000000002');

create temp table t_first_warning as
select warning_id from public.moderation_warn_user(
  'b0000000-0000-0000-0000-000000000001',
  'Stop reposting the same link.'
);

select ok(
  (select warning_id from t_first_warning) is not null,
  'the first moderator warns the member'
);

create temp table t_warning as
select pg_temp.audit_for_warning((select warning_id from t_first_warning)) as audit_log_id;

select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');

select is(
  (select count(*) from public.list_own_moderation_actions()),
  1::bigint,
  'the member sees the action taken against them'
);
select is(
  (select appeal_id from public.list_own_moderation_actions()),
  null,
  'no appeal exists against it yet'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000004');
select is(
  (select count(*) from public.list_own_moderation_actions()),
  0::bigint,
  'a bystander sees no actions, because none were taken against them'
);

-- ── Filing ─────────────────────────────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.create_appeal((select audit_log_id from t_warning), 'This warning is not mine to answer for.')$sql$
  ),
  'P0002',
  'someone else''s sanction is reported as missing, not as forbidden'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');

select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.create_appeal((select audit_log_id from t_warning), 'Too short')$sql$
  ),
  '22023',
  'an appeal shorter than the floor is refused'
);
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.create_appeal('99999999-0000-4000-8000-000000000001', 'I would like to appeal an action that does not exist at all.')$sql$
  ),
  'P0002',
  'an action that does not exist is refused as missing'
);

create temp table t_appeal as
select appeal_id from public.create_appeal(
  (select audit_log_id from t_warning),
  'The link was posted once and then edited, not reposted. Please look at the edit history.'
);

select ok((select appeal_id from t_appeal) is not null, 'the member files an appeal');
select is(pg_temp.appeal_rows(), 1::bigint, 'exactly one appeal exists');
select is(
  pg_temp.appeal_status((select appeal_id from t_appeal)),
  'open',
  'a new appeal starts open'
);
select is(
  (select appeal_id from public.list_own_moderation_actions()),
  (select appeal_id from t_appeal),
  'the action now shows its appeal'
);
select is(
  (select count(*) from public.list_own_appeals()),
  1::bigint,
  'the appellant reads their own appeal back'
);
select is(
  (select action from public.list_own_appeals()),
  'user.warned',
  'the appeal names the action it argues with'
);

select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.create_appeal((select audit_log_id from t_warning), 'I would like to argue this same warning a second time please.')$sql$
  ),
  '22023',
  'a second live appeal against the same action is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_appeals$sql$),
  '42501',
  'the appellant cannot read the appeals table directly'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.moderation_list_appeals()$sql$),
  '42501',
  'the appellant cannot read the appeal queue'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000004');
select is(
  (select count(*) from public.list_own_appeals()),
  0::bigint,
  'a bystander reads no appeals'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.create_appeal((select audit_log_id from t_warning), 'An anonymous visitor cannot have been sanctioned at all.')$sql$
  ),
  '42501',
  'anon cannot file an appeal'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_own_moderation_actions()$sql$),
  '42501',
  'anon cannot read moderation actions'
);

-- ── Reviewing ──────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('b0000000-0000-0000-0000-000000000004');
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_get_appeal((select appeal_id from t_appeal))$sql$
  ),
  '42501',
  'a member without moderation.hide cannot open an appeal'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000003');

select is(
  (select count(*) from public.moderation_list_appeals()),
  1::bigint,
  'a moderator sees the appeal in the queue'
);
select is(
  (select count(*) from public.moderation_list_appeals('granted')),
  0::bigint,
  'the queue filters by status'
);
select is(
  (select action_actor_display_name from public.moderation_get_appeal((select appeal_id from t_appeal))),
  'First Moderator',
  'the appeal shows who took the action under argument'
);
select is(
  (select action_reason from public.moderation_get_appeal((select appeal_id from t_appeal))),
  'Stop reposting the same link.',
  'the appeal shows the reason given for that action'
);

select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_claim_appeal((select appeal_id from t_appeal), 'under_review')$sql$
  ),
  '40001',
  'claiming with a stale status is a conflict, not an overwrite'
);
select ok(
  public.moderation_claim_appeal((select appeal_id from t_appeal), 'open') is not null,
  'a moderator claims the appeal'
);
select is(
  pg_temp.appeal_status((select appeal_id from t_appeal)),
  'under_review',
  'claiming puts the appeal under review'
);
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_claim_appeal((select appeal_id from t_appeal), 'under_review')$sql$
  ),
  '22023',
  'only an open appeal can be claimed'
);

select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_resolve_appeal((select appeal_id from t_appeal), 'under_review', 'granted', 'ok')$sql$
  ),
  '22023',
  'a decision needs a reason of at least three characters'
);
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_resolve_appeal((select appeal_id from t_appeal), 'under_review', 'open', 'Sending it back to the queue')$sql$
  ),
  '22023',
  'an appeal can only be granted or denied'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_resolve_appeal((select appeal_id from t_appeal), 'under_review', 'denied', 'I stand by my own warning.')$sql$
  ),
  '42501',
  'the moderator who took the action cannot decide the appeal against it'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000003');
select ok(
  public.moderation_resolve_appeal(
    (select appeal_id from t_appeal),
    'under_review',
    'granted',
    'The edit history supports the member; the warning is withdrawn.'
  ) is not null,
  'a second moderator decides the appeal'
);
select is(
  pg_temp.appeal_status((select appeal_id from t_appeal)),
  'granted',
  'the decision is recorded on the appeal'
);
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.moderation_resolve_appeal((select appeal_id from t_appeal), 'granted', 'denied', 'Changing my mind after the fact.')$sql$
  ),
  '22023',
  'a decided appeal cannot be decided again'
);
select ok(
  pg_temp.latest_audit('appeal.decided') is not null,
  'the decision is audited'
);

select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');
select is(
  (select decision from public.list_own_appeals()),
  'The edit history supports the member; the warning is withdrawn.',
  'the appellant reads the decision'
);
select is(
  pg_temp.capture_sqlstate(
    $sql$select * from public.create_appeal((select audit_log_id from t_warning), 'I would like to argue this decided warning all over again now.')$sql$
  ),
  '22023',
  'an action that was already appealed cannot be appealed a second time'
);

-- ── Losing your account status does not lose your right to argue ───────────

select pg_temp.act_as('b0000000-0000-0000-0000-000000000002');
create temp table t_second as
select warning_id from public.moderation_warn_user(
  'b0000000-0000-0000-0000-000000000001',
  'Second warning, issued while this test runs.'
);

select ok(
  (select warning_id from t_second) is not null,
  'the member is warned a second time'
);

create temp table t_second_warning as
select pg_temp.audit_for_warning((select warning_id from t_second)) as audit_log_id;

set local role postgres;
select pg_temp.set_profile_status('b0000000-0000-0000-0000-000000000001', 'banned');
set local role authenticated;
select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');

select ok(
  public.create_appeal(
    (select audit_log_id from t_second_warning),
    'I am banned and this is the only way left for me to argue about it.'
  ) is not null,
  'a banned member can still file an appeal'
);

set local role postgres;
select pg_temp.set_profile_status('b0000000-0000-0000-0000-000000000001', 'active');

-- ── Retention ──────────────────────────────────────────────────────────────

-- A decided appeal and a closed report, both older than the window, plus one of
-- each that is still live.
update public.moderation_appeals
set decided_at = now() - interval '400 days'
where status = 'granted';

insert into public.content_reports (reporter_id, profile_id, reason, status, resolution, resolved_by, resolved_at)
values
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'spam', 'resolved', 'Handled long ago', 'b0000000-0000-0000-0000-000000000003', now() - interval '400 days'),
  ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'spam', 'open', null, null, null);

create temp table t_purge as
select * from private.purge_expired_moderation_evidence();

select is(
  (select reports_removed from t_purge),
  1,
  'the closed report past the window is purged'
);
select is(
  (select appeals_removed from t_purge),
  1,
  'the decided appeal past the window is purged'
);
select is(
  (select count(*) from public.content_reports where status = 'open'),
  1::bigint,
  'an open report is left alone'
);
select is(
  pg_temp.appeal_rows(),
  1::bigint,
  'the still-open appeal is left alone'
);
select ok(
  pg_temp.latest_audit('user.warned') is not null,
  'audit rows are deliberately not purged'
);

select * from extensions.finish();
rollback;
