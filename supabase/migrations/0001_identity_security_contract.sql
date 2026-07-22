-- Migration: 0001_identity_security_contract
-- Secure, auditable Auth/Profile/Permissions/Council contract.

-- Internal helpers are deliberately outside the Data API schemas.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Audit records retain actor/target identifiers even if the related Auth user is
-- later deleted. They are append-only to Data API callers.
create table public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  actor_id uuid not null,
  action text not null check (char_length(action) between 3 and 100),
  target_type text not null check (char_length(target_type) between 2 and 50),
  target_id uuid,
  reason text check (reason is null or char_length(reason) between 3 and 500),
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor_created
  on public.audit_logs(actor_id, created_at desc);
create index idx_audit_logs_target_created
  on public.audit_logs(target_id, created_at desc)
  where target_id is not null;
create index idx_audit_logs_action_created
  on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

-- AVATAR-V3: retain the legacy column only as an enforced NULL. Portable avatar
-- identity is the object path inside the fixed private `avatars` bucket.
update public.profiles
set avatar_url = null
where avatar_url is not null;

alter table public.profiles
  add column avatar_path text,
  add column profile_visibility text not null default 'public'
    check (profile_visibility in ('public', 'members', 'private')),
  add constraint profiles_avatar_url_legacy_null
    check (avatar_url is null),
  add constraint profiles_avatar_path_format
    check (
      avatar_path is null
      or avatar_path ~ (
        '^' || id::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
      )
    );

-- Separate visibility from administration. These permissions are checked by
-- exact name inside SECURITY DEFINER functions; role names are never authority.
insert into public.permissions (name, description)
values
  ('admin.view_users', 'View Council user profiles and role assignments'),
  (
    'admin.manage_protected_roles',
    'Assign or remove protected roles and administer protected users'
  )
on conflict (name) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name = 'admin.view_users'
where roles.name in ('Guardian', 'Administrator')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name = 'admin.manage_protected_roles'
where roles.name = 'Administrator'
on conflict (role_id, permission_id) do nothing;

-- Harden trigger functions created by the foundation migration. Auth metadata
-- supplies a display-name suggestion only; constraints remain authoritative.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text;
begin
  candidate_name := left(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    50
  );

  if candidate_name is null or char_length(candidate_name) < 2 then
    candidate_name := 'Member';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, candidate_name);

  return new;
end;
$$;

create or replace function public.assign_default_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role_id)
  select new.id, roles.id
  from public.roles
  where roles.name = 'User'
  on conflict (user_id, role_id) do nothing;

  return new;
end;
$$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.assign_default_role() from public, anon, authenticated;
revoke all on function public.update_updated_at() from public, anon, authenticated;

-- Replace permissive foundation policies with deny-by-default policies.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Roles are viewable by everyone" on public.roles;
drop policy if exists "User roles are viewable by everyone" on public.user_roles;
drop policy if exists "Permissions are viewable by everyone" on public.permissions;
drop policy if exists "Role permissions are viewable by everyone"
  on public.role_permissions;

create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Active users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id and status = 'active')
  with check (auth.uid() = id and status = 'active');

create policy "Roles are publicly viewable"
  on public.roles
  for select
  to anon, authenticated
  using (true);

create policy "Users can view own role assignments"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

-- Explicit table grants. Permission mappings and audit data have no direct Data
-- API grants: authenticated callers must use the narrow functions below.
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.roles from public, anon, authenticated;
revoke all on table public.user_roles from public, anon, authenticated;
revoke all on table public.permissions from public, anon, authenticated;
revoke all on table public.role_permissions from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, bio, website, profile_visibility, updated_at)
  on table public.profiles to authenticated;
grant select on table public.roles to anon, authenticated;
grant select (user_id, role_id)
  on table public.user_roles to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.roles to service_role;
grant all on table public.user_roles to service_role;
grant all on table public.permissions to service_role;
grant all on table public.role_permissions to service_role;
grant all on table public.audit_logs to service_role;

-- Permission helpers are not exposed through the Data API. Public RPCs call
-- them while running with the migration owner's privileges.
create or replace function private.user_has_permission(
  p_user_id uuid,
  p_permission_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    join public.role_permissions
      on role_permissions.role_id = user_roles.role_id
    join public.permissions
      on permissions.id = role_permissions.permission_id
    where user_roles.user_id = p_user_id
      and permissions.name = p_permission_name
  );
$$;

create or replace function private.require_active_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = actor_id
      and profiles.status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'active account required';
  end if;

  return actor_id;
end;
$$;

create or replace function private.require_permission(p_permission_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := private.require_active_actor();

  if not private.user_has_permission(actor_id, p_permission_name) then
    raise exception using
      errcode = '42501',
      message = 'permission denied';
  end if;

  return actor_id;
end;
$$;

create or replace function private.require_any_permission(
  p_permission_names text[]
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  permission_name text;
begin
  actor_id := private.require_active_actor();

  foreach permission_name in array p_permission_names loop
    if private.user_has_permission(actor_id, permission_name) then
      return actor_id;
    end if;
  end loop;

  raise exception using
    errcode = '42501',
    message = 'permission denied';
end;
$$;

create or replace function private.validated_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  clean_reason text := nullif(btrim(p_reason), '');
begin
  if clean_reason is null or char_length(clean_reason) not between 3 and 500 then
    raise exception using
      errcode = '22023',
      message = 'reason must contain between 3 and 500 characters';
  end if;

  return clean_reason;
end;
$$;

create or replace function private.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_old_values jsonb,
  p_new_values jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  insert into public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    old_values,
    new_values,
    metadata
  )
  values (
    p_actor_id,
    p_action,
    p_target_type,
    p_target_id,
    p_reason,
    p_old_values,
    p_new_values,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function private.user_has_permission(uuid, text)
  from public, anon, authenticated;
revoke all on function private.require_active_actor()
  from public, anon, authenticated;
revoke all on function private.require_permission(text)
  from public, anon, authenticated;
revoke all on function private.require_any_permission(text[])
  from public, anon, authenticated;
revoke all on function private.validated_reason(text)
  from public, anon, authenticated;
revoke all on function private.write_audit_log(
  uuid, text, text, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

-- Secure permission lookup for the current active user. It returns names only;
-- role IDs and the permission graph remain private.
create or replace function public.current_user_permissions()
returns table (permission_name text)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  actor_id uuid;
begin
  actor_id := private.require_active_actor();

  return query
  select distinct permissions.name
  from public.user_roles
  join public.role_permissions
    on role_permissions.role_id = user_roles.role_id
  join public.permissions
    on permissions.id = role_permissions.permission_id
  where user_roles.user_id = actor_id
  order by permissions.name;
end;
$$;

-- Visibility is evaluated with caller JWT context but table-owner access, so
-- public RPCs and Storage policies do not depend on broad profiles SELECT.
create or replace function private.profile_is_visible_to_caller(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as target_profile
    where target_profile.id = p_profile_id
      and target_profile.status = 'active'
      and (
        target_profile.profile_visibility = 'public'
        or target_profile.id = auth.uid()
        or (
          target_profile.profile_visibility = 'members'
          and exists (
            select 1
            from public.profiles as caller_profile
            where caller_profile.id = auth.uid()
              and caller_profile.status = 'active'
          )
        )
      )
  );
$$;

create or replace function private.avatar_path_is_valid(
  p_user_id uuid,
  p_path text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_user_id is not null
    and p_path is not null
    and p_path ~ (
      '^' || p_user_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    );
$$;

create or replace function private.avatar_object_is_readable(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.avatar_path = p_path
      and (
        profiles.id = auth.uid()
        or private.profile_is_visible_to_caller(profiles.id)
      )
  );
$$;

revoke all on function private.profile_is_visible_to_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.avatar_path_is_valid(uuid, text)
  from public, anon, authenticated;
revoke all on function private.avatar_object_is_readable(text)
  from public, anon, authenticated;

-- Public member reads expose only the fixed profile projection. Invisible,
-- inactive and missing targets all yield zero rows.
create or replace function public.list_member_profiles(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  bio text,
  website text,
  created_at timestamptz,
  role_names text[],
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  search_term text := nullif(btrim(p_search), '');
  escaped_search text;
begin
  if search_term is not null and char_length(search_term) > 50 then
    raise exception using
      errcode = '22023',
      message = 'search must not exceed 50 characters';
  end if;

  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'limit must be between 1 and 100';
  end if;

  if p_offset is null or p_offset < 0 or p_offset > 1000000 then
    raise exception using
      errcode = '22023',
      message = 'offset must be between 0 and 1000000';
  end if;

  escaped_search := replace(search_term, chr(92), chr(92) || chr(92));
  escaped_search := replace(escaped_search, '%', chr(92) || '%');
  escaped_search := replace(escaped_search, '_', chr(92) || '_');

  return query
  with filtered as (
    select
      profiles.id,
      profiles.display_name,
      profiles.avatar_path,
      profiles.bio,
      profiles.website,
      profiles.created_at
    from public.profiles
    where private.profile_is_visible_to_caller(profiles.id)
      and (
        search_term is null
        or profiles.display_name ilike '%' || escaped_search || '%' escape E'\\'
      )
  ),
  paged as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered
    order by filtered.created_at desc, filtered.id desc
    limit p_limit
    offset p_offset
  )
  select
    paged.id,
    paged.display_name,
    paged.avatar_path,
    paged.bio,
    paged.website,
    paged.created_at,
    role_data.role_names,
    paged.total_count
  from paged
  left join lateral (
    select coalesce(
      array_agg(roles.name order by roles.name),
      array[]::text[]
    ) as role_names
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = paged.id
  ) as role_data on true
  order by paged.created_at desc, paged.id desc;
end;
$$;

create or replace function public.get_member_profile(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  bio text,
  website text,
  created_at timestamptz,
  updated_at timestamptz,
  role_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
rows 1
as $$
begin
  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'user id is required';
  end if;

  return query
  select
    profiles.id,
    profiles.display_name,
    profiles.avatar_path,
    profiles.bio,
    profiles.website,
    profiles.created_at,
    profiles.updated_at,
    coalesce(
      array_agg(roles.name order by roles.name)
        filter (where roles.id is not null),
      array[]::text[]
    ) as role_names
  from public.profiles
  left join public.user_roles on user_roles.user_id = profiles.id
  left join public.roles on roles.id = user_roles.role_id
  where profiles.id = p_user_id
    and private.profile_is_visible_to_caller(profiles.id)
  group by profiles.id;
end;
$$;

-- Compare-and-swap protects upload/reset races. Upload new -> CAS -> delete the
-- losing object on false; delete the previous object only after true.
create or replace function public.set_profile_avatar(
  p_expected_path text,
  p_new_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := private.require_active_actor();

  if not private.avatar_path_is_valid(actor_id, p_new_path) then
    raise exception using
      errcode = '22023',
      message = 'invalid avatar object path';
  end if;

  if not exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'avatars'
      and objects.name = p_new_path
  ) then
    raise exception using
      errcode = '22023',
      message = 'avatar object does not exist';
  end if;

  update public.profiles
  set avatar_path = p_new_path
  where profiles.id = actor_id
    and profiles.avatar_path is not distinct from p_expected_path;

  return found;
end;
$$;

create or replace function public.reset_profile_avatar(p_expected_path text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := private.require_active_actor();

  update public.profiles
  set avatar_path = null
  where profiles.id = actor_id
    and profiles.avatar_path is not distinct from p_expected_path;

  return found;
end;
$$;

-- Private Storage bucket. The bucket-level limit is a second line behind C2's
-- pre-decode 5 MiB validation; stored output is always generated WebP.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Visible avatar objects are readable"
  on storage.objects;
drop policy if exists "Active users can upload own avatars"
  on storage.objects;
drop policy if exists "Active users can update own avatars"
  on storage.objects;
drop policy if exists "Active users can delete own avatars"
  on storage.objects;

create policy "Visible avatar objects are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'avatars'
    and private.avatar_object_is_readable(name)
  );

create policy "Active users can upload own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and private.avatar_path_is_valid(auth.uid(), name)
    and lower(coalesce(metadata ->> 'mimetype', '')) = 'image/webp'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
    )
  );

create policy "Active users can update own avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and private.avatar_path_is_valid(auth.uid(), name)
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
    )
  )
  with check (
    bucket_id = 'avatars'
    and private.avatar_path_is_valid(auth.uid(), name)
    and lower(coalesce(metadata ->> 'mimetype', '')) = 'image/webp'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
    )
  );

create policy "Active users can delete own avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and private.avatar_path_is_valid(auth.uid(), name)
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
    )
  );

grant select on table storage.objects to anon, authenticated;
grant insert, update, delete on table storage.objects to authenticated;

-- Storage policies are the only callers granted access to these private helper
-- functions; the private schema is not exposed by the Data API configuration.
grant usage on schema private to anon, authenticated;
grant execute on function private.avatar_path_is_valid(uuid, text)
  to authenticated;
grant execute on function private.avatar_object_is_readable(text)
  to anon, authenticated;

revoke all on function public.list_member_profiles(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_member_profile(uuid)
  from public, anon, authenticated;
revoke all on function public.set_profile_avatar(text, text)
  from public, anon, authenticated;
revoke all on function public.reset_profile_avatar(text)
  from public, anon, authenticated;

grant execute on function public.list_member_profiles(text, integer, integer)
  to anon, authenticated;
grant execute on function public.get_member_profile(uuid)
  to anon, authenticated;
grant execute on function public.set_profile_avatar(text, text)
  to authenticated;
grant execute on function public.reset_profile_avatar(text)
  to authenticated;

-- Council user list. Search/filter/page bounds are enforced inside the database,
-- and authorization is independent of any preceding page/layout check.
create or replace function public.council_list_users(
  p_search text default null,
  p_status text default null,
  p_sort text default 'created_desc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  status text,
  created_at timestamptz,
  role_names text[],
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  search_term text := nullif(btrim(p_search), '');
  escaped_search text;
begin
  perform private.require_permission('admin.view_users');

  if search_term is not null and char_length(search_term) > 50 then
    raise exception using
      errcode = '22023',
      message = 'search must not exceed 50 characters';
  end if;

  if p_status is not null
    and p_status not in ('active', 'suspended', 'banned') then
    raise exception using
      errcode = '22023',
      message = 'invalid profile status';
  end if;

  if p_sort is null or p_sort not in (
    'created_desc',
    'created_asc',
    'name_asc',
    'name_desc'
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid user-list sort';
  end if;

  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'limit must be between 1 and 100';
  end if;

  if p_offset is null or p_offset < 0 or p_offset > 1000000 then
    raise exception using
      errcode = '22023',
      message = 'offset must be between 0 and 1000000';
  end if;

  escaped_search := replace(search_term, chr(92), chr(92) || chr(92));
  escaped_search := replace(escaped_search, '%', chr(92) || '%');
  escaped_search := replace(escaped_search, '_', chr(92) || '_');

  return query
  with filtered as (
    select
      profiles.id,
      profiles.display_name,
      profiles.avatar_path,
      profiles.status,
      profiles.created_at
    from public.profiles
    where (p_status is null or profiles.status = p_status)
      and (
        search_term is null
        or profiles.display_name ilike '%' || escaped_search || '%' escape E'\\'
      )
  ),
  paged as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered
    order by
      case when p_sort = 'created_desc' then filtered.created_at end desc,
      case when p_sort = 'created_desc' then filtered.id end desc,
      case when p_sort = 'created_asc' then filtered.created_at end asc,
      case when p_sort = 'created_asc' then filtered.id end asc,
      case when p_sort = 'name_asc' then lower(filtered.display_name) end asc,
      case when p_sort = 'name_asc' then filtered.display_name end asc,
      case when p_sort = 'name_asc' then filtered.id end asc,
      case when p_sort = 'name_desc' then lower(filtered.display_name) end desc,
      case when p_sort = 'name_desc' then filtered.display_name end desc,
      case when p_sort = 'name_desc' then filtered.id end desc
    limit p_limit
    offset p_offset
  )
  select
    paged.id,
    paged.display_name,
    paged.avatar_path,
    paged.status,
    paged.created_at,
    role_data.role_names,
    paged.total_count
  from paged
  left join lateral (
    select coalesce(
      array_agg(roles.name order by roles.name),
      array[]::text[]
    ) as role_names
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = paged.id
  ) as role_data on true
  order by
    case when p_sort = 'created_desc' then paged.created_at end desc,
    case when p_sort = 'created_desc' then paged.id end desc,
    case when p_sort = 'created_asc' then paged.created_at end asc,
    case when p_sort = 'created_asc' then paged.id end asc,
    case when p_sort = 'name_asc' then lower(paged.display_name) end asc,
    case when p_sort = 'name_asc' then paged.display_name end asc,
    case when p_sort = 'name_asc' then paged.id end asc,
    case when p_sort = 'name_desc' then lower(paged.display_name) end desc,
    case when p_sort = 'name_desc' then paged.display_name end desc,
    case when p_sort = 'name_desc' then paged.id end desc;
end;
$$;

create or replace function public.council_get_user(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  bio text,
  website text,
  status text,
  created_at timestamptz,
  roles jsonb
)
language plpgsql
stable
security definer
set search_path = ''
rows 1
as $$
begin
  perform private.require_permission('admin.view_users');

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'user id is required';
  end if;

  return query
  select
    profiles.id,
    profiles.display_name,
    profiles.avatar_path,
    profiles.bio,
    profiles.website,
    profiles.status,
    profiles.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', roles.id,
          'name', roles.name,
          'description', roles.description,
          'is_protected', roles.is_protected
        ) order by roles.name
      ) filter (where roles.id is not null),
      '[]'::jsonb
    ) as roles
  from public.profiles
  left join public.user_roles on user_roles.user_id = profiles.id
  left join public.roles on roles.id = user_roles.role_id
  where profiles.id = p_user_id
  group by profiles.id;
end;
$$;

create or replace function public.council_list_audit_logs(
  p_action text default null,
  p_actor_id uuid default null,
  p_target_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_id uuid,
  actor_display_name text,
  action text,
  target_type text,
  target_id uuid,
  target_display_name text,
  reason text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
begin
  perform private.require_permission('admin.view_audit_logs');

  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'limit must be between 1 and 100';
  end if;

  if p_offset is null or p_offset < 0 or p_offset > 1000000 then
    raise exception using
      errcode = '22023',
      message = 'offset must be between 0 and 1000000';
  end if;

  return query
  select
    audit_logs.id,
    audit_logs.actor_id,
    actor_profile.display_name as actor_display_name,
    audit_logs.action,
    audit_logs.target_type,
    audit_logs.target_id,
    target_profile.display_name as target_display_name,
    audit_logs.reason,
    audit_logs.old_values,
    audit_logs.new_values,
    audit_logs.metadata,
    audit_logs.created_at,
    count(*) over ()::bigint as total_count
  from public.audit_logs
  left join public.profiles as actor_profile
    on actor_profile.id = audit_logs.actor_id
  left join public.profiles as target_profile
    on target_profile.id = audit_logs.target_id
  where (p_action is null or audit_logs.action = p_action)
    and (p_actor_id is null or audit_logs.actor_id = p_actor_id)
    and (p_target_id is null or audit_logs.target_id = p_target_id)
  order by audit_logs.created_at desc, audit_logs.id desc
  limit p_limit
  offset p_offset;
end;
$$;

-- Status changes are serialized per target, enforce explicit transitions, block
-- self-action, protect privileged targets and write the audit record atomically.
create or replace function public.council_set_user_status(
  p_user_id uuid,
  p_status text,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  old_status text;
  clean_reason text;
  audit_action text;
begin
  clean_reason := private.validated_reason(p_reason);

  if p_status is null or p_status not in ('active', 'suspended', 'banned') then
    raise exception using
      errcode = '22023',
      message = 'invalid profile status';
  end if;

  if p_status = 'suspended' then
    actor_id := private.require_permission('moderation.suspend');
  elsif p_status = 'banned' then
    actor_id := private.require_permission('moderation.ban');
  else
    actor_id := private.require_any_permission(
      array['moderation.suspend', 'moderation.ban']::text[]
    );
  end if;

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'user id is required';
  end if;

  if actor_id = p_user_id then
    raise exception using
      errcode = '42501',
      message = 'self status changes are not allowed';
  end if;

  select profiles.status
  into old_status
  from public.profiles
  where profiles.id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'target user does not exist';
  end if;

  if old_status = p_status then
    raise exception using
      errcode = '22023',
      message = 'status transition must change the current status';
  end if;

  if not (
    (old_status = 'active' and p_status in ('suspended', 'banned'))
    or (old_status = 'suspended' and p_status in ('active', 'banned'))
    or (old_status = 'banned' and p_status = 'active')
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid profile status transition';
  end if;

  if old_status = 'suspended' and p_status = 'active' then
    actor_id := private.require_permission('moderation.suspend');
    audit_action := 'user.unsuspended';
  elsif old_status = 'banned' and p_status = 'active' then
    actor_id := private.require_permission('moderation.ban');
    audit_action := 'user.unbanned';
  elsif p_status = 'suspended' then
    audit_action := 'user.suspended';
  else
    audit_action := 'user.banned';
  end if;

  if private.user_has_permission(
    p_user_id,
    'admin.manage_protected_roles'
  ) and not private.user_has_permission(
    actor_id,
    'admin.manage_protected_roles'
  ) then
    raise exception using
      errcode = '42501',
      message = 'permission denied for protected user';
  end if;

  update public.profiles
  set status = p_status
  where profiles.id = p_user_id;

  return private.write_audit_log(
    actor_id,
    audit_action,
    'user',
    p_user_id,
    clean_reason,
    jsonb_build_object('status', old_status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

create or replace function public.council_assign_user_role(
  p_user_id uuid,
  p_role_id uuid,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  clean_reason text;
  role_name text;
  role_is_protected boolean;
  assignment_id uuid;
begin
  actor_id := private.require_permission('admin.manage_roles');
  clean_reason := private.validated_reason(p_reason);

  if p_user_id is null or p_role_id is null then
    raise exception using
      errcode = '22023',
      message = 'user id and role id are required';
  end if;

  if actor_id = p_user_id then
    raise exception using
      errcode = '42501',
      message = 'self role changes are not allowed';
  end if;

  perform 1
  from public.profiles
  where profiles.id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'target user does not exist';
  end if;

  select roles.name, roles.is_protected
  into role_name, role_is_protected
  from public.roles
  where roles.id = p_role_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'role does not exist';
  end if;

  if (
    role_is_protected
    or private.user_has_permission(
      p_user_id,
      'admin.manage_protected_roles'
    )
  ) and not private.user_has_permission(
    actor_id,
    'admin.manage_protected_roles'
  ) then
    raise exception using
      errcode = '42501',
      message = 'permission denied for protected role change';
  end if;

  insert into public.user_roles (user_id, role_id, assigned_by)
  values (p_user_id, p_role_id, actor_id)
  on conflict (user_id, role_id) do nothing
  returning id into assignment_id;

  if assignment_id is null then
    raise exception using
      errcode = '22023',
      message = 'user already has this role';
  end if;

  return private.write_audit_log(
    actor_id,
    'user.role_assigned',
    'user',
    p_user_id,
    clean_reason,
    null,
    jsonb_build_object('role_id', p_role_id, 'role_name', role_name),
    jsonb_build_object('assignment_id', assignment_id)
  );
end;
$$;

create or replace function public.council_remove_user_role(
  p_user_id uuid,
  p_role_id uuid,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  clean_reason text;
  role_name text;
  role_is_protected boolean;
  assignment_id uuid;
begin
  actor_id := private.require_permission('admin.manage_roles');
  clean_reason := private.validated_reason(p_reason);

  if p_user_id is null or p_role_id is null then
    raise exception using
      errcode = '22023',
      message = 'user id and role id are required';
  end if;

  if actor_id = p_user_id then
    raise exception using
      errcode = '42501',
      message = 'self role changes are not allowed';
  end if;

  perform 1
  from public.profiles
  where profiles.id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'target user does not exist';
  end if;

  select roles.name, roles.is_protected
  into role_name, role_is_protected
  from public.roles
  where roles.id = p_role_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'role does not exist';
  end if;

  select user_roles.id
  into assignment_id
  from public.user_roles
  where user_roles.user_id = p_user_id
    and user_roles.role_id = p_role_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'user does not have this role';
  end if;

  if (
    role_is_protected
    or private.user_has_permission(
      p_user_id,
      'admin.manage_protected_roles'
    )
  ) and not private.user_has_permission(
    actor_id,
    'admin.manage_protected_roles'
  ) then
    raise exception using
      errcode = '42501',
      message = 'permission denied for protected role change';
  end if;

  if role_name = 'Administrator' and (
    select count(*)
    from public.user_roles
    where user_roles.role_id = p_role_id
  ) <= 1 then
    raise exception using
      errcode = '23514',
      message = 'last Administrator role cannot be removed';
  end if;

  delete from public.user_roles
  where user_roles.id = assignment_id;

  return private.write_audit_log(
    actor_id,
    'user.role_removed',
    'user',
    p_user_id,
    clean_reason,
    jsonb_build_object(
      'role_id', p_role_id,
      'role_name', role_name,
      'assignment_id', assignment_id
    ),
    null
  );
end;
$$;

-- SECURITY DEFINER functions are never executable by PUBLIC. Only authenticated
-- Data API callers receive the narrow entry points.
revoke all on function public.current_user_permissions()
  from public, anon, authenticated;
revoke all on function public.council_list_users(
  text, text, text, integer, integer
)
  from public, anon, authenticated;
revoke all on function public.council_get_user(uuid)
  from public, anon, authenticated;
revoke all on function public.council_list_audit_logs(
  text, uuid, uuid, integer, integer
) from public, anon, authenticated;
revoke all on function public.council_set_user_status(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.council_assign_user_role(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.council_remove_user_role(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.current_user_permissions()
  to authenticated;
grant execute on function public.council_list_users(
  text, text, text, integer, integer
) to authenticated;
grant execute on function public.council_get_user(uuid)
  to authenticated;
grant execute on function public.council_list_audit_logs(
  text, uuid, uuid, integer, integer
) to authenticated;
grant execute on function public.council_set_user_status(uuid, text, text)
  to authenticated;
grant execute on function public.council_assign_user_role(uuid, uuid, text)
  to authenticated;
grant execute on function public.council_remove_user_role(uuid, uuid, text)
  to authenticated;
