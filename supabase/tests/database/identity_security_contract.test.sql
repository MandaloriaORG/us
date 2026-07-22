begin;

-- Linked tests connect through Supabase's temporary `cli_login_postgres` role.
-- Assume the project-local `postgres` role so pgTAP in `extensions` is usable.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(160);

-- Auth fixtures exercise the real signup triggers.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'normal@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Normal User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'guardian@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Guardian User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'admin-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Admin One"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'admin-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Admin Two"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'target@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Target % User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'suspended@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Suspended User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'banned@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Banned User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'delegate@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Delegated Admin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'suspender@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Suspend Operator"}', now(), now(), '', '', '', '');

update public.profiles
set
  status = case
    when id = '10000000-0000-0000-0000-000000000006' then 'suspended'
    when id = '10000000-0000-0000-0000-000000000007' then 'banned'
    else status
  end,
  profile_visibility = case
    when id = '10000000-0000-0000-0000-000000000008' then 'members'
    when id = '10000000-0000-0000-0000-000000000009' then 'private'
    else profile_visibility
  end;

insert into public.user_roles (user_id, role_id)
select '10000000-0000-0000-0000-000000000002', id
from public.roles where name = 'Guardian';

insert into public.user_roles (user_id, role_id)
select users.id, roles.id
from (values
  ('10000000-0000-0000-0000-000000000003'::uuid),
  ('10000000-0000-0000-0000-000000000004'::uuid)
) as users(id)
cross join public.roles
where roles.name = 'Administrator';

insert into public.roles (name, description, is_protected)
values
  ('Test Delegated Admin', 'SQL contract-test role', false),
  ('Test Suspend Operator', 'SQL transition-test role', false),
  ('Test Role Manager', 'SQL protected-role boundary role', false);

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles cross join public.permissions
where roles.name = 'Test Delegated Admin'
  and permissions.name in (
    'admin.manage_roles', 'admin.manage_protected_roles',
    'admin.view_users', 'admin.view_audit_logs'
  );

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles cross join public.permissions
where roles.name = 'Test Suspend Operator'
  and permissions.name = 'moderation.suspend';

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles cross join public.permissions
where roles.name = 'Test Role Manager'
  and permissions.name = 'admin.manage_roles';

insert into public.user_roles (user_id, role_id)
select assignments.user_id, roles.id
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Test Role Manager'::text),
  ('10000000-0000-0000-0000-000000000008'::uuid, 'Test Delegated Admin'::text),
  ('10000000-0000-0000-0000-000000000009'::uuid, 'Test Suspend Operator'::text)
) as assignments(user_id, role_name)
join public.roles on roles.name = assignments.role_name;

-- Deterministic audit fixtures isolate filtering, ordering and nullable-name
-- behavior from mutation records written later in this transaction.
insert into public.audit_logs (
  id, actor_id, action, target_type, target_id, reason,
  old_values, new_values, metadata, created_at
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'test.audit.alpha', 'user',
    '10000000-0000-0000-0000-000000000005',
    'Alpha audit reason',
    '{"status":"banned","role_name":"Must stay hidden"}',
    '{"status":"active","role_name":"Must stay hidden","assignment_id":"hidden"}',
    '{"secret":"must stay hidden"}',
    '2026-01-01 10:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000004',
    'test.audit.alpha', 'user',
    '10000000-0000-0000-0000-000000000005',
    'Second alpha reason', null, null, '{}',
    '2026-01-02 10:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'test.audit.beta', 'user',
    '10000000-0000-0000-0000-000000000006',
    'Beta target reason', null, null, '{}',
    '2026-01-02 10:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    'test.audit.beta', 'system', null,
    'Beta system reason', null, null, '{}',
    '2026-01-03 10:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-000000000005',
    '10000000-0000-0000-0000-000000000099',
    'test.audit.orphan', 'user',
    '10000000-0000-0000-0000-000000000098',
    null,
    '{"status":"active"}',
    '{"status":"banned","role_name":"Must stay hidden"}',
    '{"secret":"must stay hidden"}',
    '2026-01-04 10:00:00+00'
  );

insert into storage.objects (bucket_id, name, metadata)
values
  ('avatars', '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp', '{"mimetype":"image/webp","size":100}'),
  ('avatars', '10000000-0000-0000-0000-000000000008/50000000-0000-4000-8000-000000000008.webp', '{"mimetype":"image/webp","size":100}'),
  ('avatars', '10000000-0000-0000-0000-000000000009/50000000-0000-4000-8000-000000000009.webp', '{"mimetype":"image/webp","size":100}'),
  ('avatars', '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp', '{"mimetype":"image/webp","size":100}'),
  ('avatars', '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000013.webp', '{"mimetype":"image/webp","size":100}'),
  ('avatars', '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000012.webp', '{"mimetype":"image/png","size":100}');

update public.profiles
set avatar_path = case id
  when '10000000-0000-0000-0000-000000000005' then '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp'
  when '10000000-0000-0000-0000-000000000008' then '10000000-0000-0000-0000-000000000008/50000000-0000-4000-8000-000000000008.webp'
  when '10000000-0000-0000-0000-000000000009' then '10000000-0000-0000-0000-000000000009/50000000-0000-4000-8000-000000000009.webp'
  else avatar_path
end;

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

-- Schema, bucket, RLS and grants.
select ok(to_regclass('public.audit_logs') is not null, 'audit_logs exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass), 'audit_logs has RLS');
select is((select public from storage.buckets where id = 'avatars'), false, 'avatars bucket is private');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 5242880::bigint, 'avatars bucket is limited to 5 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'avatars'), array['image/webp']::text[], 'avatars bucket accepts only generated WebP');
select ok((select proretset and prorows = 1000 from pg_proc where oid = 'public.get_member_profile(uuid)'::regprocedure), 'member detail remains set-returning and typegen sees a collection');
select ok((select proretset and prorows = 1000 from pg_proc where oid = 'public.council_get_user(uuid)'::regprocedure), 'Council detail remains set-returning and typegen sees a collection');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_website_safe'
    and convalidated
), 'website safety constraint exists and is validated');
select ok((
  select indisunique and indpred is not null
  from pg_index
  where indexrelid = 'public.profiles_avatar_path_unique'::regclass
), 'avatar_path has a partial unique index');
select is((select avatar_url from public.profiles limit 1), null::text, 'legacy avatar_url remains NULL');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update'), 'avatar_url is not editable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'avatar_path', 'update'), 'avatar_path requires CAS');
select ok(has_column_privilege('authenticated', 'public.profiles', 'profile_visibility', 'update'), 'owner can edit profile_visibility');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot select profiles directly');
select ok(not has_table_privilege('anon', 'public.user_roles', 'select'), 'anon cannot select role assignments directly');
select ok(not has_table_privilege('anon', 'public.permissions', 'select'), 'anon cannot select permissions');
select ok(
  has_table_privilege('anon', 'storage.objects', 'insert')
  and has_table_privilege('anon', 'storage.objects', 'update')
  and has_table_privilege('anon', 'storage.objects', 'delete'),
  'provider-owned anon Storage DML ACL remains RLS-gated'
);
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'select'), 'audit logs have no direct authenticated read');
select ok(has_table_privilege('authenticated', 'storage.objects', 'insert'), 'provider-owned Storage insert ACL remains RLS-gated');
select ok(has_table_privilege('authenticated', 'storage.objects', 'update'), 'provider-owned Storage update ACL remains RLS-gated');
select ok(has_table_privilege('authenticated', 'storage.objects', 'delete'), 'provider-owned Storage delete ACL remains RLS-gated');
select ok(has_table_privilege('service_role', 'storage.objects', 'insert'), 'service_role retains Storage insert');
select ok(has_table_privilege('service_role', 'storage.objects', 'update'), 'service_role retains Storage update');
select ok(has_table_privilege('service_role', 'storage.objects', 'delete'), 'service_role retains Storage delete');
select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and permissive = 'PERMISSIVE'
    and cmd in ('INSERT', 'UPDATE', 'DELETE')
    and ('authenticated' = any(roles) or 'anon' = any(roles))
), 'Data API roles have no permissive Storage mutation policy');
select is((
  select count(*)
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and permissive = 'RESTRICTIVE'
    and cmd in ('INSERT', 'UPDATE', 'DELETE')
    and roles @> array['anon', 'authenticated']::name[]
    and policyname in (
      'Avatar objects are server-only insert',
      'Avatar objects are server-only update',
      'Avatar objects are server-only delete'
    )
), 3::bigint, 'three restrictive avatar mutation policies target anon and authenticated');
select ok(has_function_privilege('anon', 'public.list_member_profiles(text,integer,integer)', 'execute'), 'anon can execute narrow member list');
select ok(has_function_privilege('anon', 'public.get_member_profile(uuid)', 'execute'), 'anon can execute narrow member detail');
select ok(not has_function_privilege('anon', 'public.set_profile_avatar(text,text)', 'execute'), 'anon cannot execute avatar CAS');
select ok(has_function_privilege('authenticated', 'public.set_profile_avatar(text,text)', 'execute'), 'authenticated can execute avatar CAS');
select ok(to_regprocedure('public.council_set_user_status(uuid,text,text)') is null, 'obsolete status mutation overload is absent');
select ok(has_function_privilege('authenticated', 'public.council_set_user_status(uuid,text,text,text)', 'execute'), 'authenticated can execute status CAS');
select ok(not has_function_privilege('anon', 'public.council_set_user_status(uuid,text,text,text)', 'execute'), 'anon cannot execute status CAS');
select ok(to_regprocedure('public.council_list_audit_logs(text,uuid,uuid,integer,integer)') is null, 'obsolete audit-list overload is absent');
select ok(has_function_privilege('authenticated', 'public.council_list_audit_logs(text,uuid,uuid,timestamptz,timestamptz,integer,integer)', 'execute'), 'authenticated can execute narrow audit listing');
select ok(not has_function_privilege('anon', 'public.council_list_audit_logs(text,uuid,uuid,timestamptz,timestamptz,integer,integer)', 'execute'), 'anon cannot execute audit listing');
select ok((
  select pg_index.indisvalid
    and pg_index.indisready
    and pg_get_indexdef(pg_index.indexrelid) like '%(created_at DESC, id DESC)%'
  from pg_index
  where pg_index.indexrelid = 'public.idx_audit_logs_created_id'::regclass
), 'audit listing has a deterministic-order index');
select is((
  select array_agg(arguments.argument_name order by arguments.ordinality)::text[]
  from pg_proc
  cross join lateral unnest(
    pg_proc.proargnames,
    pg_proc.proargmodes
  ) with ordinality as arguments(argument_name, argument_mode, ordinality)
  where pg_proc.oid = 'public.council_list_audit_logs(text,uuid,uuid,timestamptz,timestamptz,integer,integer)'::regprocedure
    and arguments.argument_mode = 't'
), array[
  'id', 'actor_id', 'actor_display_name', 'action', 'target_type',
  'target_id', 'target_display_name', 'reason', 'old_status',
  'new_status', 'role_name', 'created_at', 'total_count'
]::text[], 'audit listing exposes only the exact scalar allowlist');
select ok(not has_function_privilege('authenticated', 'private.require_permission(text)', 'execute'), 'private permission helper stays closed');
select ok(not has_function_privilege('authenticated', 'private.avatar_path_is_valid(uuid,text)', 'execute'), 'avatar path helper is not directly executable');
select ok(not exists (
  select 1 from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  cross join lateral unnest(pg_proc.proargnames) as argument_name
  where pg_namespace.nspname = 'public'
    and pg_proc.proname in ('list_member_profiles', 'get_member_profile')
    and argument_name in ('profile_visibility', 'avatar_url', 'email')
), 'public member RPCs omit visibility, legacy URL and email');

-- Anonymous callers see active public profiles and only their published avatars.
set local role anon;
select is(pg_temp.capture_sqlstate('select * from public.profiles'), '42501', 'anon direct profile read is denied');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs()'), '42501', 'anon cannot list audit logs');
select is((select total_count from public.list_member_profiles(null, 25, 0) limit 1), 5::bigint, 'anon sees only active public profiles');
select is((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000008')), 0::bigint, 'anon cannot see members-only profile');
select is((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000009')), 0::bigint, 'anon cannot see private profile');
select is((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000006')), 0::bigint, 'anon cannot see inactive profile');
select is((select avatar_path from public.get_member_profile('10000000-0000-0000-0000-000000000005')), '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp', 'public detail returns portable avatar path');
select ok((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000005')) <= 1, 'member detail runtime cardinality remains at most one row');
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 1::bigint, 'anon storage SELECT sees only published public avatar');
select is(pg_temp.capture_sqlstate($sql$insert into storage.objects(bucket_id,name,metadata) values ('avatars','10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000015.webp','{"mimetype":"image/webp"}')$sql$), '42501', 'anon cannot insert an avatar object');
with changed as (
  update storage.objects
  set metadata = metadata
  where name = '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp'
  returning 1
)
select is((select count(*) from changed), 0::bigint, 'anon direct update mutates zero avatar objects');
select pg_temp.capture_sqlstate($sql$delete from storage.objects where name = '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp'$sql$);
select ok(exists (
  select 1 from storage.objects
  where name = '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp'
), 'anon direct delete leaves the avatar object intact');
select is((select count(*) from public.list_member_profiles('%', 25, 0)), 1::bigint, 'member search escapes wildcard characters');
select is(pg_temp.capture_sqlstate($sql$select * from public.list_member_profiles(null, 101, 0)$sql$), '22023', 'member list rejects oversized limit');
set local role postgres;

-- Active authenticated members see members-only profiles but not other private profiles.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select ok(exists(select 1 from public.current_user_permissions() where permission_name = 'profile.edit.own'), 'active member gets effective permissions');
select is((select count(*) - count(distinct permission_name) from public.current_user_permissions()), 0::bigint, 'permission names are unique');
select is((select total_count from public.list_member_profiles(null, 25, 0) limit 1), 6::bigint, 'active member sees public plus members-only profiles');
select is((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000008')), 1::bigint, 'active member sees members-only detail');
select is((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000009')), 0::bigint, 'active member cannot see another private detail');
select is((select profile_visibility from public.profiles where id = auth.uid()), 'public', 'owner can read own privacy value directly');
with changed as (
  update public.profiles
  set profile_visibility = 'private'
  where id = auth.uid()
  returning 1
)
select is((select count(*) from changed), 1::bigint, 'owner can update own privacy value');
select is(pg_temp.capture_sqlstate($sql$update public.profiles set status = 'active' where id = auth.uid()$sql$), '42501', 'owner cannot update status');
select is(pg_temp.capture_sqlstate($sql$update public.profiles set avatar_path = null where id = auth.uid()$sql$), '42501', 'owner cannot bypass avatar CAS');
select is(pg_temp.capture_sqlstate($sql$insert into public.user_roles(user_id, role_id) select auth.uid(), id from public.roles where name = 'Administrator'$sql$), '42501', 'owner cannot assign a role');
select is(pg_temp.capture_sqlstate($sql$select * from public.council_list_users(null, null, 'created_desc', 25, 0)$sql$), '42501', 'normal member cannot list Council users');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs()'), '42501', 'normal member cannot list audit logs');

with changed as (
  update public.profiles
  set website = 'HTTPS://Example.test/a/path?q=one#fragment'
  where id = auth.uid()
  returning 1
)
select is((select count(*) from changed), 1::bigint, 'website accepts case-insensitive HTTPS with path, query and fragment');
select is(pg_temp.capture_sqlstate($sql$update public.profiles set website = 'javascript:alert(1)' where id = auth.uid()$sql$), '23514', 'website rejects non-HTTP schemes');
select is(pg_temp.capture_sqlstate($sql$update public.profiles set website = 'https://user:pass@example.test/private' where id = auth.uid()$sql$), '23514', 'website rejects URL credentials');
select is(pg_temp.capture_sqlstate($sql$update public.profiles set website = 'https://example.test/a b' where id = auth.uid()$sql$), '23514', 'website rejects whitespace');
select is(pg_temp.capture_sqlstate($sql$update public.profiles set website = 'https://example.test/' || repeat('a', 2048) where id = auth.uid()$sql$), '23514', 'website rejects values longer than 2048 characters');

-- Object mutation is server-only; the user session can only publish via CAS.
select is(pg_temp.capture_sqlstate($sql$insert into storage.objects(bucket_id,name,metadata) values ('avatars','10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000014.webp','{"mimetype":"image/webp"}')$sql$), '42501', 'active owner cannot upload directly');
select is(pg_temp.capture_sqlstate($sql$insert into storage.objects(bucket_id,name,metadata) values ('avatars','10000000-0000-0000-0000-000000000002/50000000-0000-4000-8000-000000000011.webp','{"mimetype":"image/webp"}')$sql$), '42501', 'owner cannot upload under another uid');
select is(pg_temp.capture_sqlstate($sql$select public.set_profile_avatar(null, '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp')$sql$), '22023', 'avatar CAS rejects SQL NULL expected path');
select ok(public.set_profile_avatar('', '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp'), 'avatar CAS normalizes empty expected sentinel to NULL');
select is((select avatar_path from public.profiles where id = auth.uid()), '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp', 'avatar CAS persists new path');
with changed as (
  update storage.objects
  set metadata = metadata
  where name = '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp'
  returning 1
)
select is((select count(*) from changed), 0::bigint, 'owner direct update mutates zero avatar objects');
select pg_temp.capture_sqlstate($sql$delete from storage.objects where name = '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp'$sql$);
select ok(exists (
  select 1 from storage.objects
  where name = '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp'
), 'owner direct delete leaves the current avatar object intact');
select is(pg_temp.capture_sqlstate($sql$select public.set_profile_avatar('10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp', '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000012.webp')$sql$), '22023', 'avatar CAS rejects a non-WebP server object');
select is(public.set_profile_avatar('', '10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000013.webp'), false, 'stale avatar CAS loses race');
select is(public.reset_profile_avatar('10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000013.webp'), false, 'reset CAS returns false for a valid stale path');
select is(pg_temp.capture_sqlstate($sql$select public.reset_profile_avatar('wrong/path.webp')$sql$), '22023', 'reset CAS rejects an invalid expected path');
select ok(public.reset_profile_avatar('10000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000001.webp'), 'reset CAS clears matching avatar');
select is(pg_temp.capture_sqlstate($sql$select public.set_profile_avatar('', 'https://attacker.invalid/avatar.webp')$sql$), '22023', 'avatar CAS rejects URL instead of object path');
select ok(exists(select 1 from storage.objects where name = '10000000-0000-0000-0000-000000000008/50000000-0000-4000-8000-000000000008.webp'), 'active member can read members-only avatar object');
select ok(not exists(select 1 from storage.objects where name = '10000000-0000-0000-0000-000000000009/50000000-0000-4000-8000-000000000009.webp'), 'active member cannot read another private avatar');

-- Private owner can see own active profile/avatar; inactive callers fail closed.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000009', true);
select is((select count(*) from public.get_member_profile(auth.uid())), 1::bigint, 'owner can read own active private profile via RPC');
select ok(exists(select 1 from storage.objects where name = '10000000-0000-0000-0000-000000000009/50000000-0000-4000-8000-000000000009.webp'), 'owner can read own private avatar');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
select is(pg_temp.capture_sqlstate('select * from public.current_user_permissions()'), '42501', 'suspended permission lookup fails closed');
select is((select count(*) from public.get_member_profile('10000000-0000-0000-0000-000000000008')), 0::bigint, 'suspended caller does not gain members visibility');
select is(pg_temp.capture_sqlstate($sql$insert into storage.objects(bucket_id,name,metadata) values ('avatars','10000000-0000-0000-0000-000000000006/50000000-0000-4000-8000-000000000006.webp','{"mimetype":"image/webp"}')$sql$), '42501', 'suspended owner cannot upload avatar');
select is(pg_temp.capture_sqlstate($sql$select public.reset_profile_avatar(null)$sql$), '42501', 'suspended owner cannot mutate avatar CAS');

-- Council reads, transition-specific permissions and audit logging.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select ok(exists(select 1 from public.current_user_permissions() where permission_name = 'admin.view_users'), 'Guardian gets admin.view_users');
select is((select total_count from public.council_list_users(null, null, 'created_desc', 25, 0) limit 1), 9::bigint, 'Council list includes every account status/visibility');
select is((select avatar_path from public.council_get_user('10000000-0000-0000-0000-000000000005')), '10000000-0000-0000-0000-000000000005/50000000-0000-4000-8000-000000000005.webp', 'Council detail returns portable avatar path');
select ok((select count(*) from public.council_get_user('10000000-0000-0000-0000-000000000005')) <= 1, 'Council detail runtime cardinality remains at most one row');
select is(pg_temp.capture_sqlstate($sql$select public.council_set_user_status('10000000-0000-0000-0000-000000000003','active','suspended','Protected target test')$sql$), '42501', 'Guardian cannot suspend protected administrator');
select is(pg_temp.capture_sqlstate($sql$select public.council_assign_user_role('10000000-0000-0000-0000-000000000005',(select id from public.roles where name='Verified Member'),'Denied role assignment')$sql$), '42501', 'Guardian cannot assign roles');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs()'), '42501', 'Guardian cannot list audit logs without the exact permission');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000009', true);
select ok(public.council_set_user_status('10000000-0000-0000-0000-000000000005', 'active', 'suspended', 'Temporary suspension for SQL verification') is not null, 'suspend permission changes active target');
select is(pg_temp.capture_sqlstate($sql$select public.council_set_user_status('10000000-0000-0000-0000-000000000005','suspended','banned','Suspend-only actor cannot ban')$sql$), '42501', 'suspend-only actor cannot ban');
select ok(public.council_set_user_status('10000000-0000-0000-0000-000000000005', 'suspended', 'active', 'Suspension ended after verification') is not null, 'suspend permission unsuspends target');
select is(pg_temp.capture_sqlstate($sql$select public.council_set_user_status('10000000-0000-0000-0000-000000000005','active','active','No-op rejected')$sql$), '22023', 'status no-op is rejected');
select is(pg_temp.capture_sqlstate($sql$select public.council_set_user_status('10000000-0000-0000-0000-000000000009','active','suspended','Self action rejected')$sql$), '42501', 'status self-action is rejected');
set local role postgres;
select ok(exists(select 1 from public.audit_logs where action = 'user.suspended' and target_id = '10000000-0000-0000-0000-000000000005'), 'status mutation is audited');
set local role authenticated;

-- Administrator role actions and last-Administrator invariant.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is(pg_temp.capture_sqlstate($sql$select public.council_assign_user_role('10000000-0000-0000-0000-000000000003',(select id from public.roles where name='Verified Member'),'Self assignment rejected')$sql$), '42501', 'administrator cannot assign a role to self');
select ok(not exists(
  select 1
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where user_roles.user_id = auth.uid()
    and roles.name = 'Verified Member'
), 'rejected self assignment does not mutate roles');
select is((select count(*) from public.council_list_audit_logs('user.role_assigned', auth.uid(), auth.uid(), null, null, 50, 0)), 0::bigint, 'rejected self assignment writes no audit row');
select is(pg_temp.capture_sqlstate($sql$select public.council_remove_user_role('10000000-0000-0000-0000-000000000003',(select id from public.roles where name='Administrator'),'Self removal rejected')$sql$), '42501', 'administrator cannot remove a role from self');
select ok(exists(
  select 1
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where user_roles.user_id = auth.uid()
    and roles.name = 'Administrator'
), 'rejected self removal preserves the role');
select is((select count(*) from public.council_list_audit_logs('user.role_removed', auth.uid(), auth.uid(), null, null, 50, 0)), 0::bigint, 'rejected self removal writes no audit row');
select ok(public.council_assign_user_role('10000000-0000-0000-0000-000000000005', (select id from public.roles where name='Verified Member'), 'Verified role granted') is not null, 'administrator assigns protected role');
select is(pg_temp.capture_sqlstate($sql$select public.council_assign_user_role('10000000-0000-0000-0000-000000000005',(select id from public.roles where name='Verified Member'),'Duplicate rejected')$sql$), '22023', 'duplicate role assignment is rejected');
select ok(public.council_remove_user_role('10000000-0000-0000-0000-000000000005', (select id from public.roles where name='Verified Member'), 'Verified role removed') is not null, 'administrator removes protected role');
select ok(public.council_set_user_status('10000000-0000-0000-0000-000000000005', 'active', 'banned', 'Ban transition verified') is not null, 'ban permission bans target');
select is(pg_temp.capture_sqlstate($sql$select public.council_set_user_status('10000000-0000-0000-0000-000000000005','suspended','active','Stale unban rejected')$sql$), '22023', 'stale expected status is rejected');
select is((select status from public.council_get_user('10000000-0000-0000-0000-000000000005')), 'banned', 'stale status CAS does not mutate target');
select is((select count(*) from public.council_list_audit_logs('user.unbanned', auth.uid(), '10000000-0000-0000-0000-000000000005', null, null, 50, 0)), 0::bigint, 'stale status CAS writes no audit row');
select ok(public.council_set_user_status('10000000-0000-0000-0000-000000000005', 'banned', 'active', 'Unban transition verified') is not null, 'ban permission unbans target');
select ok((select count(*) > 0 from public.council_list_audit_logs(null, null, null, null, null, 50, 0)), 'authorized administrator lists audit RPC');

-- Audit-list filters, half-open time range, stable order and bounded pagination.
select is((select count(*) from public.council_list_audit_logs(p_action => 'test.audit.alpha')), 2::bigint, 'audit listing filters by action');
select is((
  select count(*)
  from public.council_list_audit_logs(
    p_actor_id => '10000000-0000-0000-0000-000000000003',
    p_created_from => '2026-01-01 00:00:00+00',
    p_created_before => '2026-01-04 00:00:00+00',
    p_limit => 100
  )
), 3::bigint, 'audit listing filters by actor');
select is((
  select count(*)
  from public.council_list_audit_logs(
    p_target_id => '10000000-0000-0000-0000-000000000005',
    p_created_from => '2026-01-01 00:00:00+00',
    p_created_before => '2026-01-04 00:00:00+00',
    p_limit => 100
  )
), 2::bigint, 'audit listing filters by target');
select is((
  select count(*)
  from public.council_list_audit_logs(
    p_created_from => '2026-01-02 00:00:00+00',
    p_created_before => '2026-01-03 00:00:00+00',
    p_limit => 100
  )
), 2::bigint, 'audit listing uses a half-open creation range');
select is((
  select count(*)
  from public.council_list_audit_logs(
    p_action => 'test.audit.beta',
    p_actor_id => '10000000-0000-0000-0000-000000000003',
    p_target_id => '10000000-0000-0000-0000-000000000006',
    p_created_from => '2026-01-01 00:00:00+00',
    p_created_before => '2026-01-04 00:00:00+00'
  )
), 1::bigint, 'audit listing combines action, actor, target and date filters');
select is(pg_temp.capture_sqlstate($sql$select * from public.council_list_audit_logs(p_created_from => '2026-01-02 00:00:00+00', p_created_before => '2026-01-02 00:00:00+00')$sql$), '22023', 'audit listing rejects an empty time range');
select is(pg_temp.capture_sqlstate($sql$select * from public.council_list_audit_logs(p_created_from => '2026-01-03 00:00:00+00', p_created_before => '2026-01-02 00:00:00+00')$sql$), '22023', 'audit listing rejects a reversed time range');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs(p_limit => 0)'), '22023', 'audit listing rejects zero limit');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs(p_limit => 101)'), '22023', 'audit listing rejects oversized limit');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs(p_offset => -1)'), '22023', 'audit listing rejects negative offset');
select is(pg_temp.capture_sqlstate('select * from public.council_list_audit_logs(p_offset => 1000001)'), '22023', 'audit listing rejects oversized offset');
select is(pg_temp.capture_sqlstate($sql$select * from public.council_list_audit_logs(p_action => ' padded ')$sql$), '22023', 'audit listing rejects a padded action filter');
select is(pg_temp.capture_sqlstate($sql$select * from public.council_list_audit_logs(p_action => E'\tuser.banned')$sql$), '22023', 'audit listing rejects a leading tab in action filter');
select is(pg_temp.capture_sqlstate($sql$select * from public.council_list_audit_logs(p_action => E'user.banned\n')$sql$), '22023', 'audit listing rejects a trailing newline in action filter');
select is((
  select array_agg(id)
  from public.council_list_audit_logs(
    p_created_from => '2026-01-01 00:00:00+00',
    p_created_before => '2026-01-04 00:00:00+00',
    p_limit => 100
  )
), array[
  '70000000-0000-4000-8000-000000000004',
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001'
]::uuid[], 'audit listing orders by created_at DESC then id DESC');
select is((select count(*) from public.council_list_audit_logs(p_action => 'test.audit.beta', p_limit => 1, p_offset => 0)), 1::bigint, 'audit page cardinality respects limit');
select is((select id from public.council_list_audit_logs(p_action => 'test.audit.beta', p_limit => 1, p_offset => 0)), '70000000-0000-4000-8000-000000000004'::uuid, 'first audit page returns newest row');
select is((select total_count from public.council_list_audit_logs(p_action => 'test.audit.beta', p_limit => 1, p_offset => 0)), 2::bigint, 'first audit page reports filtered total_count');
select is((select id from public.council_list_audit_logs(p_action => 'test.audit.beta', p_limit => 1, p_offset => 1)), '70000000-0000-4000-8000-000000000003'::uuid, 'second audit page advances by offset');
select is((select total_count from public.council_list_audit_logs(p_action => 'test.audit.beta', p_limit => 1, p_offset => 1)), 2::bigint, 'second audit page preserves filtered total_count');
select is((select count(*) from public.council_list_audit_logs(p_action => 'test.audit.beta', p_limit => 1, p_offset => 2)), 0::bigint, 'audit pagination returns no rows past the filtered set');

-- Projection exposes no JSON blobs or internal keys and uses safe NULL fallbacks.
select ok(not (
  to_jsonb(audit_row) ?| array[
    'metadata', 'old_values', 'new_values', 'role_id', 'assignment_id'
  ]
), 'audit listing rows contain no raw JSON, metadata or internal IDs')
from public.council_list_audit_logs(
  p_action => 'user.role_assigned',
  p_actor_id => auth.uid(),
  p_target_id => '10000000-0000-0000-0000-000000000005'
) as audit_row
limit 1;
select ok((
  select old_status is null and new_status is null and role_name is null
  from public.council_list_audit_logs(p_action => 'test.audit.alpha')
  where id = '70000000-0000-4000-8000-000000000001'
), 'unrecognized actions cannot project allowlisted JSON values');
select ok((
  select old_status = 'active' and new_status = 'banned' and role_name is null
  from public.council_list_audit_logs(
    p_action => 'user.banned',
    p_actor_id => auth.uid(),
    p_target_id => '10000000-0000-0000-0000-000000000005'
  )
), 'status audit projects only allowlisted status scalars');
select ok((
  select role_name = 'Verified Member'
    and old_status is null
    and new_status is null
  from public.council_list_audit_logs(
    p_action => 'user.role_assigned',
    p_actor_id => auth.uid(),
    p_target_id => '10000000-0000-0000-0000-000000000005'
  )
), 'role audit projects only the allowlisted role name');
select is((
  select reason
  from public.council_list_audit_logs(p_action => 'test.audit.alpha')
  where id = '70000000-0000-4000-8000-000000000001'
), 'Alpha audit reason', 'audit listing preserves reason');
select ok((
  select actor_id = '10000000-0000-0000-0000-000000000099'
    and actor_display_name is null
    and target_id = '10000000-0000-0000-0000-000000000098'
    and target_display_name is null
    and reason is null
    and old_status is null
    and new_status is null
    and role_name is null
  from public.council_list_audit_logs(p_action => 'test.audit.orphan')
), 'audit listing preserves historical IDs and uses NULL for missing profiles and disallowed fields');
select is(pg_temp.capture_sqlstate('delete from public.audit_logs'), '42501', 'audit logs are append-only to authenticated callers');

-- manage_roles alone cannot cross either protected-role boundary.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(pg_temp.capture_sqlstate($sql$select public.council_assign_user_role('10000000-0000-0000-0000-000000000005',(select id from public.roles where name='Verified Member'),'Protected role rejected')$sql$), '42501', 'manage_roles without manage_protected cannot assign a protected role');
set local role postgres;
select ok(not exists(
  select 1
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where user_roles.user_id = '10000000-0000-0000-0000-000000000005'
    and roles.name = 'Verified Member'
), 'rejected protected-role assignment does not mutate roles');
select is((select count(*) from public.audit_logs where action = 'user.role_assigned' and actor_id = '10000000-0000-0000-0000-000000000001' and target_id = '10000000-0000-0000-0000-000000000005'), 0::bigint, 'rejected protected-role assignment writes no audit row');
set local role authenticated;
select is(pg_temp.capture_sqlstate($sql$select public.council_assign_user_role('10000000-0000-0000-0000-000000000003',(select id from public.roles where name='Test Suspend Operator'),'Protected target rejected')$sql$), '42501', 'manage_roles without manage_protected cannot change a protected target');
set local role postgres;
select ok(not exists(
  select 1
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where user_roles.user_id = '10000000-0000-0000-0000-000000000003'
    and roles.name = 'Test Suspend Operator'
), 'rejected protected-target assignment does not mutate roles');
select is((select count(*) from public.audit_logs where action = 'user.role_assigned' and actor_id = '10000000-0000-0000-0000-000000000001' and target_id = '10000000-0000-0000-0000-000000000003'), 0::bigint, 'rejected protected-target assignment writes no audit row');
set local role authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000008', true);
select ok(public.council_remove_user_role('10000000-0000-0000-0000-000000000004', (select id from public.roles where name='Administrator'), 'Remove redundant Administrator') is not null, 'authorized actor removes one of multiple Administrators');
select is((select count(*) from public.council_list_users(null, null, 'created_desc', 100, 0) where 'Administrator' = any(role_names)), 1::bigint, 'one Administrator remains');
select is(pg_temp.capture_sqlstate($sql$select public.council_remove_user_role('10000000-0000-0000-0000-000000000003',(select id from public.roles where name='Administrator'),'Last removal rejected')$sql$), '23514', 'last Administrator removal is rejected');
select is((select count(*) from public.council_list_users(null, null, 'created_desc', 100, 0) where 'Administrator' = any(role_names)), 1::bigint, 'last Administrator remains assigned');

set local role postgres;
select * from extensions.finish();
rollback;
