begin;

-- Search, settings and the per-plaza permission contract.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(48);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 's-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Search Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 's-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Search Admin"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'd0000000-0000-0000-0000-000000000002', id from public.roles where name = 'Administrator';

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

create or replace function pg_temp.plaza(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.plazas where plazas.slug = p_slug;
$$;

-- ── Settings exposure ──────────────────────────────────────────────────────

select ok(to_regclass('public.site_settings') is not null, 'site_settings exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.site_settings'::regclass),
  'site_settings has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'site_settings'),
  0::bigint,
  'site_settings carries no policy'
);
select is(has_table_privilege('authenticated', 'public.site_settings', 'select'), false, 'members cannot read settings directly');
select is(
  has_function_privilege('anon', 'public.admin_set_site_setting(text, jsonb, jsonb, text)', 'execute'),
  false,
  'anon cannot change settings'
);

-- Visitors read only the public settings.
set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.get_site_settings()),
  4::bigint,
  'visitors see the four public settings'
);
select is(
  (select value #>> '{}' from public.get_site_settings() where key = 'site.name'),
  'Mandaloria',
  'the site name is public'
);

-- ── Settings administration ────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_get_site_settings()$sql$),
  '42501',
  'a member cannot read the full settings'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_set_site_setting('site.name', '"Hacked"'::jsonb)$sql$),
  '42501',
  'a member cannot change a setting'
);

set local role authenticated;
select pg_temp.act_as('d0000000-0000-0000-0000-000000000002');
select ok(
  exists(select 1 from public.admin_get_site_settings()),
  'an administrator reads the full settings'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_set_site_setting('nope.nope', '"x"'::jsonb)$sql$),
  'P0002',
  'an unknown setting is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_set_site_setting('site.registration_open', '"yes"'::jsonb)$sql$),
  '22023',
  'a value of the wrong type is refused'
);

-- Compare-and-swap against the shown value.
select ok(
  public.admin_set_site_setting('site.name', '"Mandaloria Prime"'::jsonb, '"Mandaloria"'::jsonb, 'Rebrand') is not null,
  'an administrator updates a setting with the shown value'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_set_site_setting('site.name', '"Elsewhere"'::jsonb, '"Mandaloria"'::jsonb, 'Stale')$sql$),
  '40001',
  'a stale expected value is refused'
);
select is(
  (select value #>> '{}' from public.get_site_settings() where key = 'site.name'),
  'Mandaloria Prime',
  'the update took effect for visitors'
);

-- Numeric bounds are enforced by the table and surfaced through the RPC. The
-- fixture row is inserted as the migration owner, since members cannot write
-- site_settings directly.
set local role postgres;
insert into public.site_settings (key, value, value_type, description, is_public, min_value, max_value)
values ('limits.posts_per_day', '5', 'number', 'Posts per day.', false, 1, 100);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_set_site_setting('limits.posts_per_day', '500'::jsonb, '5'::jsonb)$sql$),
  '23514',
  'a number above the maximum is refused'
);
select ok(
  public.admin_set_site_setting('limits.posts_per_day', '10'::jsonb, '5'::jsonb) is not null,
  'a number within bounds is accepted'
);

-- ── Search ─────────────────────────────────────────────────────────────────

-- Content to search.
set local role authenticated;
select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
create temp table t_post as
select post_id from public.create_post(
  pg_temp.plaza('central-plaza'),
  'The anvil rings true',
  'Every forge has a rhythm of its own.'
);
select is(
  (select entity_type from public.search_content('rhythm') limit 1),
  'post',
  'a member finds their own post'
);

-- Comments are searchable.
select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
select ok(
  public.create_comment((select post_id from t_post), 'The rhythm of the hammer') is not null,
  'a member comments'
);
select is(
  (select entity_type from public.search_content('hammer') where entity_type = 'comment'),
  'comment',
  'a comment match surfaces with entity type comment'
);

-- Tag filter.
select ok(
  public.set_own_post_tags((select post_id from t_post), array['forge']) is not null,
  'the post is tagged'
);
select is(
  (select count(*) from public.search_content('rhythm', 'post', null, 'forge')),
  1::bigint,
  'the tag filter narrows the post search'
);
select is(
  (select count(*) from public.search_content('rhythm', 'post', null, 'nomatch')),
  0::bigint,
  'a tag with no matches returns nothing'
);

-- Author filter.
select is(
  (select count(*) from public.search_content('rhythm', null, null, null, 'd0000000-0000-0000-0000-000000000001')),
  2::bigint,
  'the author filter finds their post and their comment'
);
select is(
  (select count(*) from public.search_content('rhythm', null, null, null, 'd0000000-0000-0000-0000-000000000002')),
  0::bigint,
  'another author has no matches'
);

-- Input validation.
select is(
  pg_temp.capture_sqlstate($sql$select * from public.search_content('')$sql$),
  '22023',
  'an empty query is refused'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.search_content('x', 'widget')$sql$),
  '22023',
  'an unknown entity type is refused'
);

-- Visitors find the same published content.
set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.search_content('rhythm')),
  2::bigint,
  'a visitor searches the same published post and comment'
);

-- Hidden content leaves the search surface.
set local role authenticated;
select pg_temp.act_as('d0000000-0000-0000-0000-000000000002');
select ok(
  public.moderation_set_post_status((select post_id from t_post), 'published', 'hidden', 'Search must not show this') is not null,
  'an administrator hides the post'
);
set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.search_content('rhythm')),
  0::bigint,
  'hidden content disappears from search'
);

-- Private-plaza content is invisible to members without access. The post is
-- created by the administrator, who is the only one who can see the plaza.
set local role authenticated;
select pg_temp.act_as('d0000000-0000-0000-0000-000000000002');
create temp table t_private_plaza as
select plaza_id from public.admin_create_plaza(
  'council-vault', 'Council Vault', null, 'private', 999
);
create temp table t_private_post as
select post_id from public.create_post(
  (select plaza_id from t_private_plaza),
  'A private council record',
  'Only the council reads this.'
);
set local role anon;
select pg_temp.act_as(null);
select is(
  (select count(*) from public.search_content('council record')),
  0::bigint,
  'a visitor cannot search private-plaza content'
);
set local role authenticated;
select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
select is(
  (select count(*) from public.search_content('council record')),
  0::bigint,
  'a member without access cannot search private-plaza content'
);
select pg_temp.act_as('d0000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.search_content('council record')),
  1::bigint,
  'an administrator with access can'
);

-- Deleted content never surfaces.
select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
create temp table t_gone as
select post_id from public.create_post(
  pg_temp.plaza('central-plaza'),
  'This will be removed',
  'Temporary thoughts.'
);
select ok(
  public.delete_own_post((select post_id from t_gone)) is not null,
  'the author deletes their post'
);
select is(
  (select count(*) from public.search_content('Temporary thoughts')),
  0::bigint,
  'a deleted post is not searchable'
);

-- Codex articles are searchable too.
select pg_temp.act_as('d0000000-0000-0000-0000-000000000002');
select ok(
  public.admin_upsert_codex_category('search-cat', 'Search Cat') is not null,
  'a category exists for the search test'
);
create temp table t_article as
select article_id from public.create_codex_article('search-cat', 'A searchable article', 'Veritas rerum, the truth of things.');
select ok(
  public.publish_codex_article((select article_id from t_article), 'draft') is not null,
  'the article is published'
);
select is(
  (select entity_type from public.search_content('veritas') where entity_type = 'article'),
  'article',
  'a codex article surfaces with entity type article'
);
select is(
  (select entity_type from public.search_content('veritas', 'article')),
  'article',
  'search can be narrowed to articles'
);

-- ── The per-plaza posting permission ───────────────────────────────────────

create temp table t_restricted as
select plaza_id from public.admin_create_plaza(
  'forge-only', 'Forge Only', null, 'public', 200, 'admin.manage_plazas'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_create_plaza('bad-perm', 'Bad Perm', null, 'public', 201, 'does.not.exist')$sql$),
  '22023',
  'a nonexistent required permission is refused'
);

select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
select is(
  (select can_post from public.get_plaza('forge-only')),
  false,
  'a member without the required permission cannot post'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.create_post((select plaza_id from t_restricted), 'Not allowed', 'Nope.')$sql$),
  '42501',
  'posting to the restricted plaza is refused'
);

select pg_temp.act_as('d0000000-0000-0000-0000-000000000002');
select is(
  (select can_post from public.get_plaza('forge-only')),
  true,
  'a holder of the required permission can post'
);
select ok(
  public.admin_update_plaza(
    (select plaza_id from t_restricted), 'forge-only', 'Forge Only', null, null, 'public', 200, 'post.create'
  ) is not null,
  'the required permission can be changed'
);
select pg_temp.act_as('d0000000-0000-0000-0000-000000000001');
select is(
  (select can_post from public.get_plaza('forge-only')),
  true,
  'after the change the member can post'
);

-- ── Clan emblem path hardening ─────────────────────────────────────────────

-- The path helpers are private; the owner reads them directly.
set local role postgres;
select is(
  (select private.clan_emblem_path_is_valid('c0000000-0000-4000-8000-000000000001/12345678-1234-4123-8123-123456789abc.png')),
  true,
  'a well-formed clan emblem path is valid'
);
select is(
  (select private.clan_emblem_path_is_valid('../escape.png')),
  false,
  'a path traversal is not a valid emblem path'
);
select is(
  (select private.clan_emblem_path_is_valid('c0000000-0000-4000-8000-000000000001/12345678-1234-4123-8123-123456789abc.gif')),
  false,
  'a disallowed mime extension is refused'
);

select * from extensions.finish();
rollback;
