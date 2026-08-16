-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — Settings, search, the per-plaza permission, and attachment hardening
--
-- Four unrelated deliverables in one file, because each is small and none
-- deserves its own migration.
--
-- 1. **Site settings.** A key/value table with a type, a public flag, numeric
--    bounds and an audit trail. Public settings are readable by visitors; every
--    write needs `admin.manage_settings`, is compare-and-swap against the shown
--    value, and is audited with the old and new values.
-- 2. **Search.** One permission-aware RPC across posts, comments and Codex
--    articles, with plaza, tag and author filters. Deleted, hidden, quarantined
--    and private content never appears; every filter and every read re-checks
--    the same visibility helpers the pages use.
-- 3. **The Phase-2 open item.** `admin_create_plaza` and `admin_update_plaza`
--    finally accept `p_required_post_permission`, the column 0007 created. The
--    app call passes named arguments, so the new defaulted parameter is a pure
--    addition.
-- 4. **Attachment hardening.** A private `clan-emblems` bucket, 5 MiB, WebP and
--    PNG only, with the same CAS pointer pattern the avatars use, so a clan
--    emblem is a `<clan id>/<object id>.(webp|png)` path that only the clan's
--    leader (or an admin) can manage and that is readable only when the clan is.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Site settings ───────────────────────────────────────────────────────────

create table public.site_settings (
  key text primary key
    constraint site_settings_key_format
    check (key ~ '^[a-z0-9]+(\.[a-z0-9_]+)*$' and char_length(key) between 2 and 60),
  value jsonb not null
    check (jsonb_typeof(value) in ('string', 'number', 'boolean', 'array', 'object')),
  value_type text not null
    check (value_type in ('string', 'number', 'boolean', 'json', 'array')),
  description text
    constraint site_settings_description_length
    check (description is null or char_length(description) <= 500),
  -- Public settings ship to visitors (site name, description, navigation,
  -- theme, public feature flags). Everything else is Council-only.
  is_public boolean not null default false,
  min_value numeric,
  max_value numeric,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A numeric setting is validated against its bounds.
  constraint site_settings_number_bounds check (
    value_type <> 'number'
    or (
      jsonb_typeof(value) = 'number'
      and (min_value is null or (value #>> '{}')::numeric >= min_value)
      and (max_value is null or (value #>> '{}')::numeric <= max_value)
    )
  )
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.update_updated_at();

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from public, anon, authenticated;
grant all on table public.site_settings to service_role;

-- ── Search helpers ─────────────────────────────────────────────────────────

-- Escapes a LIKE pattern so `%` and `_` in the query are literal.
create or replace function private.like_escape(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(coalesce(p_text, ''), chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_');
$$;

revoke all on function private.like_escape(text) from public, anon, authenticated;

-- ── Settings reads ─────────────────────────────────────────────────────────

create or replace function public.get_site_settings()
returns table (
  key text,
  value jsonb,
  value_type text,
  description text
)
language sql
stable
security definer
set search_path = ''
rows 100
as $$
  select site_settings.key, site_settings.value, site_settings.value_type, site_settings.description
  from public.site_settings
  where site_settings.is_public
  order by site_settings.key;
$$;

create or replace function public.admin_get_site_settings()
returns table (
  key text,
  value jsonb,
  value_type text,
  description text,
  is_public boolean,
  min_value numeric,
  max_value numeric,
  updated_by uuid,
  updated_by_display_name text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 200
as $$
begin
  perform private.require_permission('admin.manage_settings');

  return query
  select
    site_settings.key,
    site_settings.value,
    site_settings.value_type,
    site_settings.description,
    site_settings.is_public,
    site_settings.min_value,
    site_settings.max_value,
    site_settings.updated_by,
    updater.display_name,
    site_settings.updated_at
  from public.site_settings
  left join public.profiles updater on updater.id = site_settings.updated_by
  order by site_settings.key;
end;
$$;

-- Compare-and-swap against the value the administrator was shown, validated
-- against the setting's type and numeric bounds, and audited with both values.
create or replace function public.admin_set_site_setting(
  p_key text,
  p_value jsonb,
  p_expected_value jsonb default null,
  p_reason text default null
)
returns table (setting_key text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_key text := lower(btrim(coalesce(p_key, '')));
  v_setting public.site_settings;
  v_clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor_id := private.require_permission('admin.manage_settings');

  if v_clean_key !~ '^[a-z0-9]+(\.[a-z0-9_]+)*$' or char_length(v_clean_key) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'key must be a lowercase dotted identifier';
  end if;

  if p_value is null or jsonb_typeof(p_value) not in ('string', 'number', 'boolean', 'array', 'object') then
    raise exception using errcode = '22023', message = 'value must be a json scalar, array or object';
  end if;

  if v_clean_reason is not null and char_length(v_clean_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'reason must contain between 3 and 500 characters';
  end if;

  select * into v_setting from public.site_settings where site_settings.key = v_clean_key for update;

  if v_setting.key is null then
    raise exception using errcode = 'P0002', message = 'setting not found';
  end if;

  -- The type never changes after creation, so a value of the wrong type is
  -- refused rather than coerced.
  if not (
    (v_setting.value_type = 'string' and jsonb_typeof(p_value) = 'string')
    or (v_setting.value_type = 'number' and jsonb_typeof(p_value) = 'number')
    or (v_setting.value_type = 'boolean' and jsonb_typeof(p_value) = 'boolean')
    or (v_setting.value_type in ('json', 'array') and jsonb_typeof(p_value) in ('array', 'object'))
  ) then
    raise exception using
      errcode = '22023',
      message = 'value does not match the setting''s type';
  end if;

  if p_expected_value is not null and v_setting.value is distinct from p_expected_value then
    raise exception using errcode = '40001', message = 'setting changed since it was read';
  end if;

  update public.site_settings
  set value = p_value,
      updated_by = v_actor_id,
      updated_at = now()
  where site_settings.key = v_clean_key;

  perform private.write_audit_log(
    v_actor_id,
    'site_setting.update',
    'site_setting',
    null,
    v_clean_reason,
    jsonb_build_object('key', v_clean_key, 'value', v_setting.value),
    jsonb_build_object('key', v_clean_key, 'value', p_value)
  );

  return query select v_clean_key;
end;
$$;

-- ── Search ──────────────────────────────────────────────────────────────────

-- One permission-aware RPC across posts, comments and Codex articles.
-- `p_entity_type` is 'post', 'comment', 'article' or null for all; the other
-- filters apply where they mean something (plaza and tag to content, author to
-- everything). Every row passes through the same visibility helpers the pages
-- use, so deleted, hidden, quarantined and private content never surfaces.
create or replace function public.search_content(
  p_query text,
  p_entity_type text default null,
  p_plaza_id uuid default null,
  p_tag_slug text default null,
  p_author_id uuid default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  entity_type text,
  entity_id uuid,
  plaza_id uuid,
  plaza_slug text,
  author_id uuid,
  author_display_name text,
  title text,
  excerpt text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 50
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_escaped text;
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_entity_type is not null and p_entity_type not in ('post', 'comment', 'article') then
    raise exception using errcode = '22023', message = 'entity type must be post, comment or article';
  end if;

  if v_query = '' or char_length(v_query) > 200 then
    raise exception using errcode = '22023', message = 'query must contain between 1 and 200 characters';
  end if;

  if v_offset > 100000 then
    raise exception using errcode = '22023', message = 'offset is too large';
  end if;

  v_escaped := private.like_escape(v_query);
  v_pattern := '%' || v_escaped || '%';

  return query
  with results as (
    select
      'post'::text as entity_type,
      posts.id as entity_id,
      plazas.id,
      plazas.slug,
      posts.author_id,
      profiles.display_name,
      posts.title,
      left(posts.body, 280),
      posts.created_at
    from public.posts
    join public.plazas on plazas.id = posts.plaza_id
    join public.profiles on profiles.id = posts.author_id
    where (p_entity_type is null or p_entity_type = 'post')
      and posts.status in ('published', 'closed', 'archived')
      and private.plaza_is_visible_to_caller(posts.plaza_id)
      and (p_plaza_id is null or posts.plaza_id = p_plaza_id)
      and (p_author_id is null or posts.author_id = p_author_id)
      and (
        p_tag_slug is null
        or exists (
          select 1
          from public.post_tags
          join public.tags on tags.id = post_tags.tag_id
          where post_tags.post_id = posts.id
            and tags.slug = p_tag_slug
        )
      )
      and (posts.title ilike v_pattern or posts.body ilike v_pattern)

    union all

    select
      'comment'::text,
      comments.id,
      plazas.id,
      plazas.slug,
      comments.author_id,
      profiles.display_name,
      posts.title,
      left(comments.body, 280),
      comments.created_at
    from public.comments
    join public.posts on posts.id = comments.post_id
    join public.plazas on plazas.id = posts.plaza_id
    join public.profiles on profiles.id = comments.author_id
    where (p_entity_type is null or p_entity_type = 'comment')
      and comments.status = 'published'
      and posts.status in ('published', 'closed', 'archived')
      and private.plaza_is_visible_to_caller(posts.plaza_id)
      and (p_plaza_id is null or posts.plaza_id = p_plaza_id)
      and (p_author_id is null or comments.author_id = p_author_id)
      and comments.body ilike v_pattern

    union all

    select
      'article'::text,
      codex_articles.id,
      null,
      null,
      codex_articles.author_id,
      profiles.display_name,
      codex_articles.title,
      coalesce(codex_articles.excerpt, left(codex_articles.body, 280)),
      codex_articles.published_at
    from public.codex_articles
    join public.profiles on profiles.id = codex_articles.author_id
    where (p_entity_type is null or p_entity_type = 'article')
      and codex_articles.status in ('published', 'locked')
      and (p_author_id is null or codex_articles.author_id = p_author_id)
      and (
        codex_articles.title ilike v_pattern
        or codex_articles.body ilike v_pattern
        or codex_articles.excerpt ilike v_pattern
      )
  )
  select results.*
  from results
  order by results.created_at desc, results.entity_id desc
  limit v_limit
  offset v_offset;
end;
$$;

-- ── The Phase-2 open item: per-plaza posting permission ────────────────────

drop function public.admin_create_plaza(text, text, text, public.plaza_visibility, integer);
create or replace function public.admin_create_plaza(
  p_slug text,
  p_name text,
  p_description text default null,
  p_visibility public.plaza_visibility default 'public',
  p_sort_order integer default 0,
  p_required_post_permission text default null
)
returns table (plaza_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  new_plaza_id uuid;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(coalesce(p_name, ''));
begin
  actor_id := private.require_permission('admin.manage_plazas');

  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  if p_required_post_permission is not null
     and not exists (
       select 1 from public.permissions where permissions.name = p_required_post_permission
     ) then
    raise exception using errcode = '22023', message = 'post permission does not exist';
  end if;

  insert into public.plazas (slug, name, description, visibility, sort_order, required_post_permission)
  values (
    clean_slug,
    clean_name,
    nullif(btrim(p_description), ''),
    p_visibility,
    coalesce(p_sort_order, 0),
    nullif(p_required_post_permission, '')
  )
  returning plazas.id into new_plaza_id;

  perform private.write_audit_log(
    actor_id,
    'plaza.create',
    'plaza',
    new_plaza_id,
    null,
    null,
    jsonb_build_object(
      'slug', clean_slug,
      'name', clean_name,
      'visibility', p_visibility,
      'required_post_permission', p_required_post_permission
    )
  );

  return query select new_plaza_id;
end;
$$;

drop function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer
);
create or replace function public.admin_update_plaza(
  p_plaza_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_rules text,
  p_visibility public.plaza_visibility,
  p_sort_order integer,
  p_required_post_permission text default null
)
returns table (plaza_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  plaza_row public.plazas;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(coalesce(p_name, ''));
begin
  actor_id := private.require_permission('admin.manage_plazas');

  select * into plaza_row from public.plazas where plazas.id = p_plaza_id for update;

  if plaza_row.id is null then
    raise exception using errcode = 'P0002', message = 'plaza not found';
  end if;

  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  if p_required_post_permission is not null
     and not exists (
       select 1 from public.permissions where permissions.name = p_required_post_permission
     ) then
    raise exception using errcode = '22023', message = 'post permission does not exist';
  end if;

  update public.plazas
  set slug = clean_slug,
      name = clean_name,
      description = nullif(btrim(p_description), ''),
      rules = nullif(btrim(p_rules), ''),
      visibility = p_visibility,
      sort_order = coalesce(p_sort_order, plaza_row.sort_order),
      -- A null (or cleared) argument leaves the current permission alone, so
      -- re-saving the same value never silently removes it.
      required_post_permission = coalesce(nullif(p_required_post_permission, ''), plaza_row.required_post_permission)
  where plazas.id = plaza_row.id;

  perform private.write_audit_log(
    actor_id,
    'plaza.update',
    'plaza',
    plaza_row.id,
    null,
    jsonb_build_object(
      'slug', plaza_row.slug,
      'name', plaza_row.name,
      'visibility', plaza_row.visibility,
      'required_post_permission', plaza_row.required_post_permission
    ),
    jsonb_build_object(
      'slug', clean_slug,
      'name', clean_name,
      'visibility', p_visibility,
      'required_post_permission', p_required_post_permission
    )
  );

  return query select plaza_row.id;
end;
$$;

-- ── Attachment hardening: clan emblems ─────────────────────────────────────

-- The same shape the avatars use: a fixed private bucket, a strict path, and a
-- CAS pointer on the clan row. Paths are `<clan id>/<object id>.(webp|png)`.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'clan-emblems',
  'clan-emblems',
  false,
  5242880,
  array['image/webp', 'image/png']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.clan_emblem_path_is_valid(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|png)$';
$$;

create or replace function private.clan_emblem_path_clan_id(p_path text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(p_path, '/', 1), '')::uuid;
$$;

create or replace function private.clan_emblem_object_is_readable(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_clan_id uuid;
begin
  v_clan_id := private.clan_emblem_path_clan_id(p_path);

  if v_clan_id is null then
    return false;
  end if;

  -- Readable only when the clan itself is visible and points at this object.
  return exists (
    select 1
    from public.clans
    where clans.id = v_clan_id
      and clans.emblem_path = p_path
      and private.clan_is_visible_to_caller(clans.id)
  );
end;
$$;

revoke all on function private.clan_emblem_path_is_valid(text)
  from public, anon, authenticated;
revoke all on function private.clan_emblem_path_clan_id(text)
  from public, anon, authenticated;
revoke all on function private.clan_emblem_object_is_readable(text)
  from public, anon, authenticated;

drop policy if exists "Clan emblems are readable with their clan"
  on storage.objects;
drop policy if exists "Clan leaders upload emblems"
  on storage.objects;
drop policy if exists "Clan leaders update emblems"
  on storage.objects;
drop policy if exists "Clan leaders delete emblems"
  on storage.objects;

-- Reading follows the clan's visibility, exactly as avatar reads follow the
-- profile's.
create policy "Clan emblems are readable with their clan"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'clan-emblems'
    and private.clan_emblem_object_is_readable(name)
  );

-- Mutation is a server-only boundary, exactly as avatars are: migration 0002
-- revokes object DML from the Data API roles, so these restrictive policies are
-- the second line that keeps the bucket server-only even if a future permissive
-- policy grants mutation for another bucket.
create policy "Clan emblems are server-only insert"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (bucket_id <> 'clan-emblems');

create policy "Clan emblems are server-only update"
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (bucket_id <> 'clan-emblems')
  with check (bucket_id <> 'clan-emblems');

create policy "Clan emblems are server-only delete"
  on storage.objects
  as restrictive
  for delete
  to authenticated
  using (bucket_id <> 'clan-emblems');

-- The read policy calls the visibility helper directly, so it gets the same
-- narrow grant the avatar read helper received in 0001.
grant usage on schema private to anon, authenticated;
grant execute on function private.clan_emblem_object_is_readable(text)
  to anon, authenticated;

-- The compare-and-swap pointer, mirroring `set_profile_avatar`.
create or replace function public.set_clan_emblem(
  p_clan_id uuid,
  p_expected_path text,
  p_new_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if not private.clan_emblem_path_is_valid(p_new_path)
     or private.clan_emblem_path_clan_id(p_new_path) <> p_clan_id then
    raise exception using errcode = '22023', message = 'invalid emblem object path';
  end if;

  if not exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'clan-emblems'
      and objects.name = p_new_path
  ) then
    raise exception using errcode = '22023', message = 'emblem object does not exist';
  end if;

  update public.clans
  set emblem_path = p_new_path
  where clans.id = p_clan_id
    and clans.emblem_path is not distinct from p_expected_path;

  return found;
end;
$$;

create or replace function public.reset_clan_emblem(
  p_clan_id uuid,
  p_expected_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  update public.clans
  set emblem_path = null
  where clans.id = p_clan_id
    and clans.emblem_path is not distinct from p_expected_path;

  return found;
end;
$$;

-- ── Seed settings ───────────────────────────────────────────────────────────

insert into public.site_settings (key, value, value_type, description, is_public)
values
  ('site.name', '"Mandaloria"', 'string', 'The community''s name.', true),
  ('site.description', '"A community and free-knowledge network."', 'string', 'One-line description.', true),
  ('site.navigation', '[]', 'array', 'Canonical navigation items.', true),
  ('site.registration_open', 'true', 'boolean', 'Whether new accounts can register.', false),
  ('theme.initial', '"dark"', 'string', 'Default visual theme for new visitors.', true),
  ('features.reactions', '{}', 'json', 'Feature flags for reaction behaviour.', false),
  ('features.codex_public', 'true', 'boolean', 'Whether the Codex Libre is publicly readable.', false)
on conflict (key) do nothing;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.get_site_settings() from public, anon, authenticated;
revoke all on function public.admin_get_site_settings() from public, anon, authenticated;
revoke all on function public.admin_set_site_setting(text, jsonb, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.search_content(text, text, uuid, text, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.admin_create_plaza(
  text, text, text, public.plaza_visibility, integer, text
) from public, anon, authenticated;
revoke all on function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer, text
) from public, anon, authenticated;
revoke all on function public.set_clan_emblem(uuid, text, text) from public, anon, authenticated;
revoke all on function public.reset_clan_emblem(uuid, text) from public, anon, authenticated;

-- Visitors read the public settings and search the public surface; search is
-- permission-aware inside.
grant execute on function public.get_site_settings() to anon, authenticated;
grant execute on function public.search_content(text, text, uuid, text, uuid, integer, integer)
  to anon, authenticated;

grant execute on function public.admin_get_site_settings() to authenticated;
grant execute on function public.admin_set_site_setting(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.admin_create_plaza(
  text, text, text, public.plaza_visibility, integer, text
) to authenticated;
grant execute on function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer, text
) to authenticated;
grant execute on function public.set_clan_emblem(uuid, text, text) to authenticated;
grant execute on function public.reset_clan_emblem(uuid, text) to authenticated;

comment on table public.site_settings is
  'Community configuration as typed key/value pairs. Public settings ship to visitors; writes are compare-and-swap, type-checked and audited.';
comment on function public.search_content(text, text, uuid, text, uuid, integer, integer) is
  'Permission-aware search across posts, comments and Codex articles, with plaza, tag and author filters. Deleted, hidden, quarantined and private content never appears.';
comment on function public.admin_set_site_setting(text, jsonb, jsonb, text) is
  'Update one site setting. Compare-and-swap against the shown value, type-checked, bounds-checked for numbers, and audited with both values.';
