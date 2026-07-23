begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(60);

-- Fixtures exercise the real signup triggers, so profiles and the default role
-- arrive the same way they do in production.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'w-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Warned Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'w-other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Other Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'w-mod@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Warning Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'w-mod-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Second Moderator"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'w-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Protected Admin"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select '90000000-0000-0000-0000-000000000003', id from public.roles where name = 'Moderator';

insert into public.user_roles (user_id, role_id)
select '90000000-0000-0000-0000-000000000004', id from public.roles where name = 'Guardian';

insert into public.user_roles (user_id, role_id)
select '90000000-0000-0000-0000-000000000005', id from public.roles where name = 'Administrator';

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

-- Neither table carries a grant for `authenticated`, which is the contract
-- under test. These owner-privileged helpers read state without weakening it.
create or replace function pg_temp.warning_rows(p_user_id uuid)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.user_warnings where user_warnings.user_id = p_user_id;
$$;

create or replace function pg_temp.warning_field(p_warning_id uuid, p_name text)
returns text language sql security definer set search_path = '' as $$
  select case p_name
    when 'reason' then reason
    when 'actor_id' then actor_id::text
    when 'acknowledged_at' then acknowledged_at::text
  end
  from public.user_warnings where user_warnings.id = p_warning_id;
$$;

create or replace function pg_temp.note_rows(p_user_id uuid)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.moderator_notes where moderator_notes.subject_id = p_user_id;
$$;

create or replace function pg_temp.audit_count(p_action text)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.audit_logs where audit_logs.action = p_action;
$$;

-- Every row in one transaction shares the same `now()`, so the audit row is
-- reached through the id the action returned rather than by ordering on time.
create or replace function pg_temp.audit_reason_for(p_key text, p_id uuid)
returns text language sql security definer set search_path = '' as $$
  select reason from public.audit_logs
  where audit_logs.metadata ->> p_key = p_id::text
  limit 1;
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.user_warnings') is not null, 'user_warnings exists');
select ok(to_regclass('public.moderator_notes') is not null, 'moderator_notes exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_warnings'::regclass),
  'user_warnings has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.moderator_notes'::regclass),
  'moderator_notes has RLS'
);
select is(
  (select count(*) from pg_policies where tablename in ('user_warnings', 'moderator_notes')),
  0::bigint,
  'neither table carries a policy, so RLS denies everything'
);
select is(has_table_privilege('anon', 'public.user_warnings', 'select'), false, 'anon cannot select warnings');
select is(has_table_privilege('authenticated', 'public.user_warnings', 'select'), false, 'a member cannot select warnings directly');
select is(has_table_privilege('authenticated', 'public.moderator_notes', 'select'), false, 'a member cannot select notes directly');
select is(has_function_privilege('anon', 'public.list_own_warnings()', 'execute'), false, 'anon cannot list warnings');
select is(has_function_privilege('authenticated', 'public.moderation_warn_user(uuid, text)', 'execute'), true, 'an account is needed to reach the warn RPC');

-- ── Warning: who may issue one ─────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('90000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000002', 'Behave yourself')$sql$),
  '42501',
  'a member cannot warn another member'
);

set local role anon;
select pg_temp.act_as(null);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000001', 'Behave yourself')$sql$),
  '42501',
  'anon cannot warn anyone'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.user_warnings$sql$),
  '42501',
  'anon cannot read warnings directly'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.list_own_warnings()$sql$),
  '42501',
  'anon has no warnings to list'
);

-- ── Issuing a warning ──────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('90000000-0000-0000-0000-000000000003');

create temp table t_warning as
select warning_id from public.moderation_warn_user(
  '90000000-0000-0000-0000-000000000001',
  '  Repeatedly posting off topic in the Central Plaza.  '
);

select ok((select warning_id from t_warning) is not null, 'a Moderator warns a member');
select is(pg_temp.warning_rows('90000000-0000-0000-0000-000000000001'), 1::bigint, 'the warning is stored');
select is(
  pg_temp.warning_field((select warning_id from t_warning), 'reason'),
  'Repeatedly posting off topic in the Central Plaza.',
  'the warning text is trimmed but preserved'
);
select is(
  pg_temp.warning_field((select warning_id from t_warning), 'actor_id'),
  '90000000-0000-0000-0000-000000000003',
  'the warning records who issued it'
);
select is(
  pg_temp.warning_field((select warning_id from t_warning), 'acknowledged_at'),
  null,
  'a new warning is unacknowledged'
);
select is(pg_temp.audit_count('user.warned'), 1::bigint, 'warning a member is audited');

-- ── Issuing is validated ───────────────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000003', 'Warning myself')$sql$),
  '22023',
  'a moderator cannot warn themselves'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('99999999-0000-4000-8000-000000000001', 'Nobody there')$sql$),
  'P0002',
  'warning a user that does not exist is refused as missing'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000002', 'no')$sql$),
  '22023',
  'a warning needs at least three characters'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000002', '   ')$sql$),
  '22023',
  'a blank warning is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000002', null)$sql$),
  '22023',
  'a null warning is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000002', repeat('x', 1001))$sql$),
  '22023',
  'a warning beyond the ceiling is refused'
);

-- A warning may run past the 500 characters an audit reason allows; the audit
-- row truncates rather than the warning being rejected.
create temp table t_long as
select warning_id from public.moderation_warn_user(
  '90000000-0000-0000-0000-000000000002', repeat('y', 900)
);
select ok((select warning_id from t_long) is not null, 'a warning longer than an audit reason is accepted');
select is(
  char_length(pg_temp.audit_reason_for('warning_id', (select warning_id from t_long))),
  500,
  'the audit row truncates it instead of refusing the warning'
);
select is(
  char_length(pg_temp.warning_field((select warning_id from t_long), 'reason')),
  900,
  'the warning itself keeps its full text'
);

-- ── Protected targets ──────────────────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate($sql$select public.moderation_warn_user('90000000-0000-0000-0000-000000000005', 'Warning an administrator')$sql$),
  '42501',
  'a Moderator cannot warn a protected user'
);

select pg_temp.act_as('90000000-0000-0000-0000-000000000005');
select ok(
  public.moderation_warn_user('90000000-0000-0000-0000-000000000003', 'Watch your tone in the queue') is not null,
  'an Administrator can warn a Moderator'
);

-- ── A member reads and acknowledges their own ──────────────────────────────

select pg_temp.act_as('90000000-0000-0000-0000-000000000001');
select is((select count(*) from public.list_own_warnings()), 1::bigint, 'a member sees their own warning');
select is(
  (select reason from public.list_own_warnings()),
  'Repeatedly posting off topic in the Central Plaza.',
  'the member reads the warning text'
);

select pg_temp.act_as('90000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.list_own_warnings() where warning_id = (select warning_id from t_warning)),
  0::bigint,
  'a member cannot see another member''s warning'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.acknowledge_warning((select warning_id from t_warning))$sql$),
  'P0002',
  'acknowledging someone else''s warning is refused as missing, not as forbidden'
);

select pg_temp.act_as('90000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select public.acknowledge_warning((select warning_id from t_warning))$sql$),
  'P0002',
  'the moderator who issued it cannot acknowledge it for the member'
);

select pg_temp.act_as('90000000-0000-0000-0000-000000000001');
select ok(
  public.acknowledge_warning((select warning_id from t_warning)) is not null,
  'the member acknowledges their own warning'
);
select ok(
  pg_temp.warning_field((select warning_id from t_warning), 'acknowledged_at') is not null,
  'the acknowledgement is recorded'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.acknowledge_warning((select warning_id from t_warning))$sql$),
  '22023',
  'acknowledging twice is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.acknowledge_warning('99999999-0000-4000-8000-000000000002')$sql$),
  'P0002',
  'acknowledging a warning that does not exist is refused as missing'
);

-- ── Moderator notes ────────────────────────────────────────────────────────

select is(
  pg_temp.capture_sqlstate($sql$select public.council_add_user_note('90000000-0000-0000-0000-000000000002', 'A note from a member')$sql$),
  '42501',
  'a member cannot write a Council note'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.council_list_user_notes('90000000-0000-0000-0000-000000000001')$sql$),
  '42501',
  'a member cannot read Council notes'
);

select pg_temp.act_as('90000000-0000-0000-0000-000000000004');

create temp table t_note as
select note_id from public.council_add_user_note(
  '90000000-0000-0000-0000-000000000001',
  'Third off-topic thread this week. Watching before escalating.'
);

select ok((select note_id from t_note) is not null, 'a Guardian writes a note');
select is(pg_temp.note_rows('90000000-0000-0000-0000-000000000001'), 1::bigint, 'the note is stored');
select is(
  (select body from public.council_list_user_notes('90000000-0000-0000-0000-000000000001')),
  'Third off-topic thread this week. Watching before escalating.',
  'the Council reads the note back'
);
select is(
  (select actor_display_name from public.council_list_user_notes('90000000-0000-0000-0000-000000000001')),
  'Second Moderator',
  'the note names its author'
);
select is(pg_temp.audit_count('user.note_added'), 1::bigint, 'adding a note is audited');
select is(
  pg_temp.audit_reason_for('note_id', (select note_id from t_note)),
  null,
  'the audit row does not copy the note body'
);

select is(
  pg_temp.capture_sqlstate($sql$select public.council_add_user_note('90000000-0000-0000-0000-000000000001', 'no')$sql$),
  '22023',
  'a note needs at least three characters'
);
select is(
  pg_temp.capture_sqlstate($sql$select public.council_add_user_note('99999999-0000-4000-8000-000000000003', 'About nobody')$sql$),
  'P0002',
  'a note about a user that does not exist is refused as missing'
);

-- The subject never reads what the Council wrote about them.
select pg_temp.act_as('90000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.council_list_user_notes('90000000-0000-0000-0000-000000000001')$sql$),
  '42501',
  'the subject of a note cannot read it'
);
select is(
  (select count(*) from public.list_own_warnings()),
  1::bigint,
  'a note is not a warning and does not reach the member'
);

-- Only the author removes a note.
select pg_temp.act_as('90000000-0000-0000-0000-000000000005');
select is(
  pg_temp.capture_sqlstate($sql$select public.council_delete_user_note((select note_id from t_note))$sql$),
  '42501',
  'another Council member cannot remove someone else''s note'
);

select pg_temp.act_as('90000000-0000-0000-0000-000000000004');
select ok(
  public.council_delete_user_note((select note_id from t_note)) is not null,
  'the author removes their own note'
);
select is(pg_temp.note_rows('90000000-0000-0000-0000-000000000001'), 0::bigint, 'the note is gone');
select is(pg_temp.audit_count('user.note_removed'), 1::bigint, 'removing a note is audited');
select is(
  pg_temp.capture_sqlstate($sql$select public.council_delete_user_note((select note_id from t_note))$sql$),
  'P0002',
  'removing a note twice is refused as missing'
);

-- ── The moderation history is the audit log, filtered ──────────────────────

-- Only an Administrator holds `admin.view_audit_logs`, which is what makes the
-- filtered audit log usable as one member's moderation history.
select pg_temp.act_as('90000000-0000-0000-0000-000000000005');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.council_list_audit_logs(null, null, '90000000-0000-0000-0000-000000000001', null, null, 50, 0)$sql$),
  '00000',
  'an Administrator reads the filtered audit log'
);
select is(
  (
    select count(*)
    from public.council_list_audit_logs(
      null, null, '90000000-0000-0000-0000-000000000001', null, null, 50, 0
    )
  ),
  3::bigint,
  'the audit log filtered by target is the member''s moderation history'
);
select ok(
  exists(
    select 1
    from public.council_list_audit_logs(
      null, null, '90000000-0000-0000-0000-000000000001', null, null, 50, 0
    )
    where action = 'user.warned'
  ),
  'the warning appears in that history'
);

select * from extensions.finish();
rollback;
