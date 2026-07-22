-- Migration: 0002_avatar_contract_hardening
-- Forward-only corrections for profile RPC typing, website integrity and the
-- server-only avatar object mutation boundary.

-- ROWS is a planner/PostgREST cardinality hint, not a row-count constraint.
-- Values greater than one keep generated RPC return types set-shaped. The
-- functions still return at most one row by primary-key equality; pgTAP proves
-- that runtime invariant.
alter function public.get_member_profile(uuid) rows 1000;
alter function public.council_get_user(uuid) rows 1000;

-- Match the server validation at the database boundary. The expression accepts
-- case-insensitive HTTP(S), including paths, query strings and fragments, while
-- rejecting missing authorities, credentials, whitespace and control bytes.
alter table public.profiles
  add constraint profiles_website_safe
  check (
    website is null
    or (
      char_length(website) between 1 and 2048
      and website ~* '^https?://[^/?#]+([/?#].*)?$'
      and website !~ '[[:space:][:cntrl:]]'
      and strpos(
        split_part(
          split_part(
            split_part(
              regexp_replace(website, '^[^:]+://', '', 'i'),
              '/',
              1
            ),
            '?',
            1
          ),
          '#',
          1
        ),
        '@'
      ) = 0
    )
  ) not valid;

alter table public.profiles
  validate constraint profiles_website_safe;

-- Besides preventing accidental aliasing, this index serves the Storage read
-- policy helper that resolves a published object path back to its profile.
create unique index profiles_avatar_path_unique
  on public.profiles(avatar_path)
  where avatar_path is not null;

-- Authenticated users retain authorized reads, including signed-URL creation,
-- but raw object mutation is a server-only boundary. The trusted server uploads
-- generated WebP via service_role, calls CAS with the user's session, then
-- removes the losing/new or previous object according to the CAS result.
drop policy if exists "Active users can upload own avatars"
  on storage.objects;
drop policy if exists "Active users can update own avatars"
  on storage.objects;
drop policy if exists "Active users can delete own avatars"
  on storage.objects;

revoke insert, update, delete on table storage.objects
  from public, anon, authenticated;

revoke execute on function private.avatar_path_is_valid(uuid, text)
  from authenticated;

-- An empty expected path is the explicit first-upload sentinel. PostgreSQL
-- function arguments do not expose nullability to generated TypeScript, so SQL
-- NULL is rejected and the generated required string type is truthful.
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
  expected_path text;
begin
  actor_id := private.require_active_actor();

  if p_expected_path is null then
    raise exception using
      errcode = '22023',
      message = 'expected avatar path is required; use an empty string for no avatar';
  end if;

  expected_path := nullif(p_expected_path, '');

  if expected_path is not null
    and not private.avatar_path_is_valid(actor_id, expected_path) then
    raise exception using
      errcode = '22023',
      message = 'invalid expected avatar object path';
  end if;

  if not private.avatar_path_is_valid(actor_id, p_new_path) then
    raise exception using
      errcode = '22023',
      message = 'invalid avatar object path';
  end if;

  if expected_path is not distinct from p_new_path then
    raise exception using
      errcode = '22023',
      message = 'new avatar path must differ from the expected path';
  end if;

  if not exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'avatars'
      and objects.name = p_new_path
      and lower(coalesce(objects.metadata ->> 'mimetype', '')) = 'image/webp'
  ) then
    raise exception using
      errcode = '22023',
      message = 'generated WebP avatar object does not exist';
  end if;

  update public.profiles
  set avatar_path = p_new_path
  where profiles.id = actor_id
    and profiles.avatar_path is not distinct from expected_path;

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

  if not private.avatar_path_is_valid(actor_id, p_expected_path) then
    raise exception using
      errcode = '22023',
      message = 'invalid expected avatar object path';
  end if;

  update public.profiles
  set avatar_path = null
  where profiles.id = actor_id
    and profiles.avatar_path = p_expected_path;

  return found;
end;
$$;

-- CREATE OR REPLACE preserves the prior EXECUTE ACLs, but repeat the public
-- boundary explicitly so this migration remains reviewable in isolation.
revoke all on function public.set_profile_avatar(text, text)
  from public, anon;
revoke all on function public.reset_profile_avatar(text)
  from public, anon;

grant execute on function public.set_profile_avatar(text, text)
  to authenticated;
grant execute on function public.reset_profile_avatar(text)
  to authenticated;
