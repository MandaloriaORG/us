begin;

-- Council reaction-type administration: the admin_list_reaction_types RPC
-- added in 0023. It lists every reaction type (active or not) with its full
-- administrative state, gated on `admin.manage_settings`.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(22);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'r-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Reaction Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'r-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Reaction Admin"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'e0000000-0000-0000-0000-000000000002', id from public.roles where name = 'Administrator';

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

-- ── Exposure ───────────────────────────────────────────────────────────────

select ok(
  to_regprocedure('public.admin_list_reaction_types()') is not null,
  'admin_list_reaction_types exists'
);
select is(
  has_function_privilege('anon', 'public.admin_list_reaction_types()', 'execute'),
  false,
  'anon cannot list reaction types for administration'
);
select is(
  has_function_privilege('authenticated', 'public.admin_list_reaction_types()', 'execute'),
  true,
  'authenticated callers may invoke the RPC (authority is re-checked inside)'
);

-- ── A member without admin.manage_settings is refused ──────────────────────

set local role authenticated;
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_list_reaction_types()$sql$),
  '42501',
  'a member without manage_settings is refused'
);

-- ── An Administrator sees every type with its full state ───────────────────

set local role authenticated;
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.admin_list_reaction_types()),
  5::bigint,
  'an administrator sees all five seeded reaction types'
);
select is(
  (select count(*) from public.admin_list_reaction_types() where not is_active),
  0::bigint,
  'the seeded catalog is entirely active by default'
);
select is(
  (select label from public.admin_list_reaction_types() where key = 'this-is-the-way'),
  'This is the Way',
  'the listing returns the label'
);
select is(
  (select emoji from public.admin_list_reaction_types() where key = 'honors'),
  '🔥',
  'the listing returns the emoji'
);
select is(
  (select affects_reputation from public.admin_list_reaction_types() where key = 'teaches'),
  true,
  'the listing returns affects_reputation'
);
select is(
  (select affects_reputation from public.admin_list_reaction_types() where key = 'laughs'),
  false,
  'the listing returns a non-reputation reaction as such'
);
select ok(
  (select created_at is not null from public.admin_list_reaction_types() where key = 'this-is-the-way'),
  'the listing returns the creation time'
);

-- ── Inactive types are visible so a Council can re-activate them ───────────

-- Deactivate one via the existing CAS RPC, then confirm the admin listing still
-- shows it (the public picker listing would not).
select ok(
  public.admin_set_reaction_type_active('laughs', true, false, 'Test deactivation') is not null,
  'an administrator deactivates a reaction type'
);
select is(
  (select count(*) from public.admin_list_reaction_types() where not is_active),
  1::bigint,
  'the admin listing still shows the deactivated type'
);
select is(
  (select key from public.admin_list_reaction_types() where not is_active),
  'laughs',
  'the deactivated type is the one just toggled'
);
select is(
  (select count(*) from public.list_reaction_types()),
  4::bigint,
  'the public picker listing still hides the inactive type'
);

-- ── Gap 15: per-plaza posting permission (clear-capable overload) ──────────

select ok(
  to_regprocedure(
    'public.admin_update_plaza(uuid, text, text, text, text, public.plaza_visibility, integer, text, boolean)'
  ) is not null,
  'the clear-capable admin_update_plaza overload exists'
);

-- A member without admin.manage_plazas is refused by the overload too.
set local role authenticated;
select pg_temp.act_as('e0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$
    select * from public.admin_update_plaza(
      '00000000-0000-0000-0000-000000000000', 'test', 'Test', null, null,
      'public', 0, null, false)
  $sql$),
  '42501',
  'a member without manage_plazas is refused by the overload'
);

set local role authenticated;
select pg_temp.act_as('e0000000-0000-0000-0000-000000000002');

-- Create a fresh plaza, then set a posting permission on it.
select ok(
  public.admin_create_plaza('post-gated', 'Post Gated', 'A gated plaza', 'public', 1, 'post.create') is not null,
  'an administrator creates a plaza with a posting permission'
);
select is(
  (select required_post_permission from public.plazas where slug = 'post-gated'),
  'post.create',
  'the created plaza stores its posting permission'
);

-- An unknown permission name is refused unless we are clearing.
select is(
  pg_temp.capture_sqlstate($sql$
    select * from public.admin_update_plaza(
      (select id from public.plazas where slug = 'post-gated'),
      'post-gated', 'Post Gated', null, null, 'public', 1, 'nope.nope', false)
  $sql$),
  '22023',
  'an unknown posting permission is refused'
);

-- Clear the restriction via the explicit flag.
select ok(
  public.admin_update_plaza(
    (select id from public.plazas where slug = 'post-gated'),
    'post-gated', 'Post Gated', null, null, 'public', 1, null, true) is not null,
  'an administrator clears the posting permission with the flag'
);
select is(
  (select required_post_permission from public.plazas where slug = 'post-gated'),
  null,
  'the cleared plaza has no posting restriction'
);

rollback;
