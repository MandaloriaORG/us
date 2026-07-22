-- Migration: 0000_init_profiles
-- Identity foundation: profiles, roles, permissions, RLS

-- ── Extensions ──
create extension if not exists "uuid-ossp";

-- ── Profiles ──
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 50),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  website text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'banned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for member listing
create index idx_profiles_display_name on public.profiles(display_name);
create index idx_profiles_status on public.profiles(status);

-- ── Roles ──
create table public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique check (char_length(name) between 2 and 50),
  description text,
  is_protected boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Permissions ──
create table public.permissions (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique check (char_length(name) between 2 and 100),
  description text,
  created_at timestamptz not null default now()
);

-- ── User Roles (many-to-many) ──
create table public.user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  unique(user_id, role_id)
);

create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_role on public.user_roles(role_id);

-- ── Role Permissions (many-to-many) ──
create table public.role_permissions (
  id uuid primary key default uuid_generate_v4(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  unique(role_id, permission_id)
);

create index idx_role_permissions_role on public.role_permissions(role_id);

-- ── Seed Roles ──
insert into public.roles (name, description, is_protected) values
  ('User', 'Default role for all registered members', true),
  ('Verified Member', 'Member with verified email and minimum participation', true),
  ('Archivist', 'Authorized to care for and review Codex Libre content', true),
  ('Moderator', 'Authorized to moderate content and enforce community rules', true),
  ('Guardian', 'Senior moderator with quarantine and ban authority', true),
  ('Administrator', 'Full platform administration', true);

-- ── Seed Permissions ──
insert into public.permissions (name, description) values
  ('profile.edit.own', 'Edit own profile'),
  ('profile.view', 'View public profiles'),
  ('post.create', 'Create posts'),
  ('post.edit.own', 'Edit own posts'),
  ('post.delete.own', 'Delete own posts'),
  ('comment.create', 'Create comments'),
  ('comment.edit.own', 'Edit own comments'),
  ('comment.delete.own', 'Delete own comments'),
  ('react.create', 'Create reactions'),
  ('report.create', 'Create reports'),
  ('bookmark.create', 'Bookmark content'),
  ('codex.view', 'View published Codex articles'),
  ('codex.suggest', 'Suggest corrections to Codex articles'),
  ('moderation.hide', 'Hide content'),
  ('moderation.restore', 'Restore hidden content'),
  ('moderation.quarantine', 'Quarantine content'),
  ('moderation.delete', 'Permanently delete content'),
  ('moderation.warn', 'Issue warnings'),
  ('moderation.suspend', 'Suspend users'),
  ('moderation.ban', 'Ban users'),
  ('admin.manage_roles', 'Assign and remove roles'),
  ('admin.manage_plazas', 'Create and manage plazas'),
  ('admin.manage_codex', 'Manage Codex Libre articles'),
  ('admin.manage_settings', 'Manage site settings'),
  ('admin.view_audit_logs', 'View audit logs');

-- ── Assign permissions to roles ──
-- User (everyone gets these)
with
  user_role as (select id from public.roles where name = 'User'),
  perms as (select id from public.permissions where name in (
    'profile.edit.own', 'profile.view', 'post.create', 'post.edit.own',
    'post.delete.own', 'comment.create', 'comment.edit.own', 'comment.delete.own',
    'react.create', 'report.create', 'bookmark.create', 'codex.view', 'codex.suggest'
  ))
insert into public.role_permissions (role_id, permission_id)
select user_role.id, perms.id from user_role, perms;

-- Verified Member (User + nothing extra right now, but distinct tier)
with
  verified_role as (select id from public.roles where name = 'Verified Member'),
  perms as (select id from public.permissions where name in (
    'profile.edit.own', 'profile.view', 'post.create', 'post.edit.own',
    'post.delete.own', 'comment.create', 'comment.edit.own', 'comment.delete.own',
    'react.create', 'report.create', 'bookmark.create', 'codex.view', 'codex.suggest'
  ))
insert into public.role_permissions (role_id, permission_id)
select verified_role.id, perms.id from verified_role, perms;

-- Archivist
with
  archivist_role as (select id from public.roles where name = 'Archivist'),
  perms as (select id from public.permissions where name in (
    'admin.manage_codex'
  ))
insert into public.role_permissions (role_id, permission_id)
select archivist_role.id, perms.id from archivist_role, perms;

-- Moderator
with
  mod_role as (select id from public.roles where name = 'Moderator'),
  perms as (select id from public.permissions where name in (
    'moderation.hide', 'moderation.restore', 'moderation.warn'
  ))
insert into public.role_permissions (role_id, permission_id)
select mod_role.id, perms.id from mod_role, perms;

-- Guardian
with
  guardian_role as (select id from public.roles where name = 'Guardian'),
  perms as (select id from public.permissions where name in (
    'moderation.hide', 'moderation.restore', 'moderation.quarantine',
    'moderation.delete', 'moderation.warn', 'moderation.suspend', 'moderation.ban'
  ))
insert into public.role_permissions (role_id, permission_id)
select guardian_role.id, perms.id from guardian_role, perms;

-- Administrator (all permissions)
with
  admin_role as (select id from public.roles where name = 'Administrator')
insert into public.role_permissions (role_id, permission_id)
select admin_role.id, perms.id from admin_role, public.permissions perms;

-- ── Auto-create profile on signup ──
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Member'));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Auto-assign 'User' role on signup ──
create or replace function public.assign_default_role()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role_id)
  select new.id, roles.id from public.roles where name = 'User';
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.assign_default_role();

-- ── updated_at trigger ──
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ── RLS ──
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- Profiles: everyone can view, owner can update
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Roles: everyone can view
create policy "Roles are viewable by everyone"
  on public.roles for select
  using (true);

-- User roles: everyone can view
create policy "User roles are viewable by everyone"
  on public.user_roles for select
  using (true);

-- Permissions: everyone can view
create policy "Permissions are viewable by everyone"
  on public.permissions for select
  using (true);

-- Role permissions: everyone can view
create policy "Role permissions are viewable by everyone"
  on public.role_permissions for select
  using (true);
