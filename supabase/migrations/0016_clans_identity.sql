-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — Clans, Casas and identity
--
-- Belonging and visible identity. The product invariant that shapes the whole
-- file: **roles grant permissions, ranks show progression, badges verify
-- achievements, houses express belonging.** Nothing here grants a permission by
-- itself; every RPC checks a named permission or a membership role, and a rank
-- or badge is never consulted for authorization.
--
-- Rules:
--
-- 1. **The leader is a member row.** `clans.leader_id` mirrors the
--    `clan_members` row with role `leader`, and one partial unique index
--    guarantees there is at most one active leader per clan. Leadership changes
--    go through `transfer_clan_leadership`, which moves both in one transaction.
-- 2. **Membership is a status machine.** pending / invited / active / rejected /
--    left / expelled, with compare-and-swap transitions and no double
--    membership (`unique (clan_id, member_id)`).
-- 3. **A badge revocation is a status, not a delete.** `user_badges` keeps every
--    row; a revoked badge stays on record with who revoked it and why. Private
--    evidence is never exposed on a public profile.
-- 4. **A block is a wall, not a grudge.** Blocks are one-way and both directions
--    are checked before a friend request or a direct interaction; unblocking
--    deletes the wall.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Permissions ─────────────────────────────────────────────────────────────

insert into public.permissions (name, description)
values
  ('admin.manage_clans', 'Create, archive and intervene in any clan'),
  ('rank.manage', 'Create, edit and retire global ranks and assign them'),
  ('badge.manage', 'Create, edit and retire badges and define their issuers'),
  ('badge.award', 'Award and revoke badges whose issuer rule permits it')
on conflict (name) do update
set description = excluded.description;

-- Administrator holds everything new; Guardian may award badges; only the badge
-- definitions decide which permission an issuer needs for a given badge.
insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name in ('admin.manage_clans', 'rank.manage', 'badge.manage', 'badge.award')
where roles.name = 'Administrator'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.name = 'badge.award'
where roles.name = 'Guardian'
on conflict (role_id, permission_id) do nothing;

-- ── Enums ──────────────────────────────────────────────────────────────────

create type public.clan_privacy as enum ('open', 'invite', 'closed');

create type public.clan_status as enum ('active', 'archived');

create type public.clan_member_role as enum ('leader', 'officer', 'member');

-- `rejected` is an answered request or an answered invitation.
create type public.clan_member_status as enum (
  'pending',
  'active',
  'invited',
  'rejected',
  'left',
  'expelled'
);

create type public.rank_status as enum ('active', 'retired');

create type public.badge_status as enum ('active', 'retired');

create type public.user_badge_status as enum ('awarded', 'revoked');

create type public.evidence_visibility as enum ('public', 'private');

create type public.friendship_status as enum (
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'removed'
);

-- ── Clans ───────────────────────────────────────────────────────────────────

create table public.clans (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint clans_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  name text not null
    constraint clans_name_length check (char_length(btrim(name)) between 2 and 80),
  description text
    constraint clans_description_length
    check (description is null or char_length(description) <= 1000),
  emblem_path text,
  privacy public.clan_privacy not null default 'open',
  mission text
    constraint clans_mission_length check (mission is null or char_length(mission) <= 2000),
  status public.clan_status not null default 'active',
  -- Mirrors the active `clan_members` row with role `leader`. The RPCs that own
  -- membership keep the two in agreement in one transaction.
  leader_id uuid references public.profiles (id) on delete set null,
  member_count integer not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clans_emblem_path_format check (
    emblem_path is null
    or emblem_path ~ (
      '^' || id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|png)$'
    )
  )
);

create index clans_listing_idx on public.clans (status, privacy, name);

create table public.clan_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  clan_id uuid not null references public.clans (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  role public.clan_member_role not null default 'member',
  status public.clan_member_status not null default 'pending',
  -- What the member answered, when they left, or when they were expelled.
  resolution_note text
    constraint clan_members_note_length
    check (resolution_note is null or char_length(resolution_note) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No double membership, whatever the state.
  unique (clan_id, member_id),
  -- A member answers an invitation or a leader answers a request: the answer
  -- always says when it happened.
  constraint clan_members_resolution_matches_status check (
    (status in ('rejected', 'left', 'expelled')) = (resolved_at is not null)
  ),
  -- An active member must have joined. The reverse does not hold: a member who
  -- left or was expelled keeps the date they originally joined.
  constraint clan_members_active_has_joined check (
    status <> 'active' or joined_at is not null
  )
);

-- At most one active leader per clan. A clan with no active leader (after a
-- leader is expelled) is a decision the admin surface must resolve.
create unique index clan_members_one_active_leader_idx
  on public.clan_members (clan_id)
  where role = 'leader' and status = 'active';

create index clan_members_member_idx
  on public.clan_members (member_id, status, created_at desc);
create index clan_members_clan_idx
  on public.clan_members (clan_id, status, role);

create trigger clans_set_updated_at
  before update on public.clans
  for each row execute function public.update_updated_at();

create trigger clan_members_set_updated_at
  before update on public.clan_members
  for each row execute function public.update_updated_at();

-- ── Internal roles ─────────────────────────────────────────────────────────

create table public.clan_internal_roles (
  id uuid primary key default extensions.uuid_generate_v4(),
  clan_id uuid not null references public.clans (id) on delete cascade,
  name text not null
    constraint clan_internal_roles_name_length
    check (char_length(btrim(name)) between 2 and 60),
  description text
    constraint clan_internal_roles_description_length
    check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_id, name)
);

-- The basic internal permissions a role carries, as plain capability names
-- checked by the RPCs that care (announcements, expeditions, chat moderation).
create table public.clan_internal_permissions (
  internal_role_id uuid not null references public.clan_internal_roles (id) on delete cascade,
  permission text not null
    constraint clan_internal_permissions_format
    check (permission ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' and char_length(permission) between 3 and 60),
  primary key (internal_role_id, permission)
);

create table public.clan_role_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  internal_role_id uuid not null references public.clan_internal_roles (id) on delete cascade,
  clan_member_id uuid not null references public.clan_members (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (internal_role_id, clan_member_id)
);

create trigger clan_internal_roles_set_updated_at
  before update on public.clan_internal_roles
  for each row execute function public.update_updated_at();

-- ── Ranks ──────────────────────────────────────────────────────────────────

create table public.ranks (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint ranks_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  name text not null
    constraint ranks_name_length check (char_length(btrim(name)) between 2 and 60),
  description text
    constraint ranks_description_length
    check (description is null or char_length(description) <= 500),
  color text
    constraint ranks_color_format check (color is null or color ~ '^#[0-9a-fA-F]{3,8}$'),
  sort_order integer not null default 0,
  status public.rank_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ranks_listing_idx on public.ranks (status, sort_order, name);

-- A profile holds at most one rank; assigning another replaces it.
create table public.user_ranks (
  id uuid primary key default extensions.uuid_generate_v4(),
  rank_id uuid not null references public.ranks (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete set null,
  reason text not null
    constraint user_ranks_reason_length check (char_length(btrim(reason)) between 3 and 500),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger ranks_set_updated_at
  before update on public.ranks
  for each row execute function public.update_updated_at();

-- ── Badges ─────────────────────────────────────────────────────────────────

create table public.badges (
  id uuid primary key default extensions.uuid_generate_v4(),
  slug text not null unique
    constraint badges_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  name text not null
    constraint badges_name_length check (char_length(btrim(name)) between 2 and 60),
  description text
    constraint badges_description_length
    check (description is null or char_length(description) <= 500),
  -- Which permission an issuer must hold to award this badge. Null means any
  -- holder of `badge.award` may issue it. This is the authorized-issuers rule.
  required_issuer_permission text references public.permissions (name)
    on update cascade on delete restrict,
  status public.badge_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index badges_listing_idx on public.badges (status, sort_order, name);

create table public.user_badges (
  id uuid primary key default extensions.uuid_generate_v4(),
  badge_id uuid not null references public.badges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  issuer_id uuid not null references public.profiles (id) on delete set null,
  reason text not null
    constraint user_badges_reason_length check (char_length(btrim(reason)) between 3 and 500),
  evidence_ref text
    constraint user_badges_evidence_length
    check (evidence_ref is null or char_length(evidence_ref) <= 500),
  evidence_visibility public.evidence_visibility not null default 'public',
  status public.user_badge_status not null default 'awarded',
  revoked_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoked_reason text
    constraint user_badges_revoked_reason_length
    check (revoked_reason is null or char_length(revoked_reason) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Revocation is a status, never a delete, so the same badge can be re-awarded
  -- only after a revocation.
  constraint user_badges_revocation_matches_status check (
    (status = 'revoked') = (revoked_at is not null)
  ),
  constraint user_badges_revoked_has_reason check (
    (status = 'revoked') = (revoked_reason is not null)
  )
);

-- One live (awarded) instance per member per badge.
create unique index user_badges_one_awarded_idx
  on public.user_badges (user_id, badge_id)
  where status = 'awarded';

create index user_badges_user_idx on public.user_badges (user_id, created_at desc);
create index user_badges_badge_idx on public.user_badges (badge_id, status);

create trigger badges_set_updated_at
  before update on public.badges
  for each row execute function public.update_updated_at();

create trigger user_badges_set_updated_at
  before update on public.user_badges
  for each row execute function public.update_updated_at();

-- ── Friends and blocks ─────────────────────────────────────────────────────

create table public.friendships (
  id uuid primary key default extensions.uuid_generate_v4(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- One live friendship or request per unordered pair. After `removed` or
-- `rejected`, a new request is possible again.
create unique index friendships_live_pair_idx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  where status in ('pending', 'accepted');

create index friendships_requester_idx
  on public.friendships (requester_id, status, created_at desc);
create index friendships_addressee_idx
  on public.friendships (addressee_id, status, created_at desc);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.update_updated_at();

create table public.blocks (
  id uuid primary key default extensions.uuid_generate_v4(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

-- ── Deny-by-default exposure ────────────────────────────────────────────────

alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_internal_roles enable row level security;
alter table public.clan_internal_permissions enable row level security;
alter table public.clan_role_members enable row level security;
alter table public.ranks enable row level security;
alter table public.user_ranks enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

revoke all on table public.clans from public, anon, authenticated;
revoke all on table public.clan_members from public, anon, authenticated;
revoke all on table public.clan_internal_roles from public, anon, authenticated;
revoke all on table public.clan_internal_permissions from public, anon, authenticated;
revoke all on table public.clan_role_members from public, anon, authenticated;
revoke all on table public.ranks from public, anon, authenticated;
revoke all on table public.user_ranks from public, anon, authenticated;
revoke all on table public.badges from public, anon, authenticated;
revoke all on table public.user_badges from public, anon, authenticated;
revoke all on table public.friendships from public, anon, authenticated;
revoke all on table public.blocks from public, anon, authenticated;

grant all on table public.clans to service_role;
grant all on table public.clan_members to service_role;
grant all on table public.clan_internal_roles to service_role;
grant all on table public.clan_internal_permissions to service_role;
grant all on table public.clan_role_members to service_role;
grant all on table public.ranks to service_role;
grant all on table public.user_ranks to service_role;
grant all on table public.badges to service_role;
grant all on table public.user_badges to service_role;
grant all on table public.friendships to service_role;
grant all on table public.blocks to service_role;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- Privacy controls how a clan admits people, not whether it can be found.
-- Open and invite-only clans are visible so that entry can be requested;
-- closed clans are visible only to their members and to those who intervene.
create or replace function private.clan_is_visible_to_caller(p_clan_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_clan public.clans;
  v_actor_id uuid := auth.uid();
begin
  select * into v_clan from public.clans where clans.id = p_clan_id;

  if v_clan.id is null or v_clan.status <> 'active' then
    return false;
  end if;

  if v_clan.privacy in ('open', 'invite') then
    return true;
  end if;

  if v_actor_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.clan_members
    where clan_members.clan_id = p_clan_id
      and clan_members.member_id = v_actor_id
      and clan_members.status = 'active'
  ) then
    return true;
  end if;

  return private.user_has_permission(v_actor_id, 'admin.manage_clans');
end;
$$;

-- The caller's active membership row in a clan, or null.
create or replace function private.clan_membership_for_caller(p_clan_id uuid)
returns public.clan_members
language sql
stable
security definer
set search_path = ''
as $$
  select clan_members
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = auth.uid()
    and clan_members.status = 'active'
  limit 1;
$$;

-- True when the caller is the clan's active leader or an admin.
create or replace function private.clan_is_led_by_caller(p_clan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from public.clan_members
        where clan_members.clan_id = p_clan_id
          and clan_members.member_id = auth.uid()
          and clan_members.role = 'leader'
          and clan_members.status = 'active'
      )
      or private.user_has_permission(auth.uid(), 'admin.manage_clans')
    );
$$;

-- A block is a wall: either direction stops an interaction.
create or replace function private.users_are_blocked(p_actor_id uuid, p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocks
    where (blocks.blocker_id = p_actor_id and blocks.blocked_id = p_other_id)
       or (blocks.blocker_id = p_other_id and blocks.blocked_id = p_actor_id)
  );
$$;

create or replace function private.enforce_friend_request_rate_limit(p_actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.friendships
  where friendships.requester_id = p_actor_id
    and friendships.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception using
      errcode = '53400',
      message = 'friend request rate limit reached, try again later';
  end if;
end;
$$;

revoke all on function private.clan_is_visible_to_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.clan_membership_for_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.clan_is_led_by_caller(uuid)
  from public, anon, authenticated;
revoke all on function private.users_are_blocked(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_friend_request_rate_limit(uuid)
  from public, anon, authenticated;

-- ── Clan reads ──────────────────────────────────────────────────────────────

create or replace function public.list_clans()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  privacy public.clan_privacy,
  mission text,
  leader_id uuid,
  leader_display_name text,
  member_count integer,
  caller_is_member boolean,
  caller_role public.clan_member_role
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  return query
  select
    clans.id,
    clans.slug,
    clans.name,
    clans.description,
    clans.privacy,
    clans.mission,
    clans.leader_id,
    leader.display_name,
    clans.member_count,
    exists (
      select 1
      from public.clan_members
      where clan_members.clan_id = clans.id
        and clan_members.member_id = v_actor_id
        and clan_members.status = 'active'
    ),
    (
      select clan_members.role
      from public.clan_members
      where clan_members.clan_id = clans.id
        and clan_members.member_id = v_actor_id
        and clan_members.status = 'active'
      limit 1
    )
  from public.clans
  left join public.profiles leader on leader.id = clans.leader_id
  where private.clan_is_visible_to_caller(clans.id)
  order by clans.name;
end;
$$;

create or replace function public.get_clan(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  emblem_path text,
  privacy public.clan_privacy,
  mission text,
  status public.clan_status,
  leader_id uuid,
  leader_display_name text,
  member_count integer,
  caller_is_member boolean,
  caller_role public.clan_member_role,
  can_manage boolean
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_clan public.clans;
  v_actor_id uuid := auth.uid();
  v_membership public.clan_members;
begin
  select * into v_clan from public.clans where clans.slug = p_slug;

  if v_clan.id is null or not private.clan_is_visible_to_caller(v_clan.id) then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  v_membership := private.clan_membership_for_caller(v_clan.id);

  return query
  select
    v_clan.id,
    v_clan.slug,
    v_clan.name,
    v_clan.description,
    v_clan.emblem_path,
    v_clan.privacy,
    v_clan.mission,
    v_clan.status,
    v_clan.leader_id,
    leader.display_name,
    v_clan.member_count,
    v_membership.id is not null,
    v_membership.role,
    private.clan_is_led_by_caller(v_clan.id)
  from public.profiles leader
  where leader.id = v_clan.leader_id;
end;
$$;

create or replace function public.list_clan_members(
  p_clan_id uuid,
  p_limit integer default 50
)
returns table (
  member_id uuid,
  display_name text,
  role public.clan_member_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if not private.clan_is_visible_to_caller(p_clan_id) then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  return query
  select
    clan_members.member_id,
    profiles.display_name,
    clan_members.role,
    clan_members.joined_at
  from public.clan_members
  join public.profiles on profiles.id = clan_members.member_id
  where clan_members.clan_id = p_clan_id
    and clan_members.status = 'active'
  order by
    case clan_members.role when 'leader' then 0 when 'officer' then 1 else 2 end,
    clan_members.joined_at,
    clan_members.id
  limit v_limit;
end;
$$;

create or replace function public.list_clan_internal_roles(p_clan_id uuid)
returns table (
  internal_role_id uuid,
  name text,
  description text,
  permissions text[],
  member_count integer
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
begin
  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  return query
  select
    roles.id,
    roles.name,
    roles.description,
    coalesce(
      (
        select array_agg(perms.permission order by perms.permission)
        from public.clan_internal_permissions perms
        where perms.internal_role_id = roles.id
      ),
      '{}'::text[]
    ),
    (
      select count(*)::integer
      from public.clan_role_members
      where clan_role_members.internal_role_id = roles.id
    )
  from public.clan_internal_roles roles
  where roles.clan_id = p_clan_id
  order by roles.name;
end;
$$;

-- ── Rank and badge reads ────────────────────────────────────────────────────

create or replace function public.list_ranks()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  color text,
  sort_order integer,
  status public.rank_status
)
language sql
stable
security definer
set search_path = ''
rows 100
as $$
  select ranks.id, ranks.slug, ranks.name, ranks.description, ranks.color,
         ranks.sort_order, ranks.status
  from public.ranks
  order by ranks.status, ranks.sort_order, ranks.name;
$$;

create or replace function public.get_profile_rank(p_user_id uuid)
returns table (
  rank_id uuid,
  slug text,
  name text,
  color text,
  assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1
as $$
begin
  if p_user_id is null or not private.profile_is_visible_to_caller(p_user_id) then
    return;
  end if;

  return query
  select ranks.id, ranks.slug, ranks.name, ranks.color, user_ranks.assigned_at
  from public.user_ranks
  join public.ranks on ranks.id = user_ranks.rank_id
  where user_ranks.user_id = p_user_id;
end;
$$;

-- Public badge list with evidence filtered by its visibility. Private evidence
-- is visible only to the holder and to the Council; everyone else sees the
-- badge and its status without the reference.
create or replace function public.list_profile_badges(
  p_user_id uuid,
  p_include_private boolean default false
)
returns table (
  badge_id uuid,
  slug text,
  name text,
  description text,
  issuer_id uuid,
  issuer_display_name text,
  reason text,
  evidence_ref text,
  evidence_visibility public.evidence_visibility,
  status public.user_badge_status,
  awarded_at timestamptz,
  revoked_reason text,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid := auth.uid();
  v_see_private boolean := coalesce(p_include_private, false)
    and v_actor_id is not null
    and (
      v_actor_id = p_user_id
      or private.user_has_permission(v_actor_id, 'admin.view_users')
    );
begin
  if p_user_id is null or not private.profile_is_visible_to_caller(p_user_id) then
    return;
  end if;

  return query
  select
    badges.id,
    badges.slug,
    badges.name,
    badges.description,
    user_badges.issuer_id,
    issuer.display_name,
    user_badges.reason,
    case
      when user_badges.evidence_visibility = 'public' or v_see_private
        then user_badges.evidence_ref
      else null
    end,
    user_badges.evidence_visibility,
    user_badges.status,
    user_badges.created_at,
    user_badges.revoked_reason,
    user_badges.revoked_at
  from public.user_badges
  join public.badges on badges.id = user_badges.badge_id
  join public.profiles issuer on issuer.id = user_badges.issuer_id
  where user_badges.user_id = p_user_id
  order by user_badges.created_at desc, user_badges.id desc;
end;
$$;

-- ── Clan administration ─────────────────────────────────────────────────────

create or replace function public.admin_create_clan(
  p_slug text,
  p_name text,
  p_leader_id uuid,
  p_description text default null,
  p_privacy public.clan_privacy default 'open',
  p_mission text default null
)
returns table (clan_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_slug text := lower(btrim(coalesce(p_slug, '')));
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_clan_id uuid;
  v_leader_row_id uuid;
begin
  v_actor_id := private.require_permission('admin.manage_clans');

  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(v_clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_leader_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'leader not found';
  end if;

  -- The leader is the first member, so the counter starts at one.
  insert into public.clans (slug, name, description, privacy, mission, leader_id, member_count)
  values (
    v_clean_slug, v_clean_name, nullif(btrim(p_description), ''),
    coalesce(p_privacy, 'open'), nullif(btrim(p_mission), ''), p_leader_id, 1
  )
  returning clans.id into v_clan_id;

  -- `resolved_at` belongs to a rejection, a departure or an expulsion; the
  -- leader simply joined.
  insert into public.clan_members (clan_id, member_id, role, status, joined_at, resolved_at)
  values (v_clan_id, p_leader_id, 'leader', 'active', now(), null)
  returning clan_members.id into v_leader_row_id;

  perform private.write_audit_log(
    v_actor_id,
    'clan.create',
    'clan',
    v_clan_id,
    null,
    null,
    jsonb_build_object('slug', v_clean_slug, 'name', v_clean_name, 'leader_id', p_leader_id)
  );

  return query select v_clan_id;
end;
$$;

create or replace function public.admin_update_clan(
  p_clan_id uuid,
  p_name text,
  p_description text,
  p_privacy public.clan_privacy,
  p_mission text
)
returns table (clan_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clan public.clans;
  v_clean_name text := btrim(coalesce(p_name, ''));
begin
  v_actor_id := private.require_permission('admin.manage_clans');

  select * into v_clan from public.clans where clans.id = p_clan_id for update;

  if v_clan.id is null then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  if char_length(v_clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  update public.clans
  set name = v_clean_name,
      description = nullif(btrim(p_description), ''),
      privacy = p_privacy,
      mission = nullif(btrim(p_mission), '')
  where clans.id = v_clan.id;

  perform private.write_audit_log(
    v_actor_id,
    'clan.update',
    'clan',
    v_clan.id,
    null,
    jsonb_build_object(
      'name', v_clan.name,
      'privacy', v_clan.privacy
    ),
    jsonb_build_object(
      'name', v_clean_name,
      'privacy', p_privacy
    )
  );

  return query select v_clan.id;
end;
$$;

create or replace function public.admin_set_clan_status(
  p_clan_id uuid,
  p_expected_status public.clan_status,
  p_status public.clan_status,
  p_reason text
)
returns table (clan_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clan public.clans;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('admin.manage_clans');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_clan from public.clans where clans.id = p_clan_id for update;

  if v_clan.id is null then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  if v_clan.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'clan changed since it was read';
  end if;

  if v_clan.status = p_status then
    raise exception using errcode = '22023', message = 'clan already has that status';
  end if;

  update public.clans set status = p_status where clans.id = v_clan.id;

  perform private.write_audit_log(
    v_actor_id,
    'clan.status',
    'clan',
    v_clan.id,
    v_clean_reason,
    jsonb_build_object('status', v_clan.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_clan.id;
end;
$$;

-- ── Clan membership ─────────────────────────────────────────────────────────

create or replace function public.request_clan_membership(p_clan_id uuid)
returns table (membership_id uuid, status public.clan_member_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clan public.clans;
  v_membership_id uuid;
  v_status public.clan_member_status;
begin
  v_actor_id := private.require_active_actor();

  select * into v_clan from public.clans where clans.id = p_clan_id for update;

  if v_clan.id is null or v_clan.status <> 'active' or not private.clan_is_visible_to_caller(v_clan.id) then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  if v_clan.privacy = 'closed' then
    raise exception using errcode = '42501', message = 'this clan requires an invitation';
  end if;

  -- Open clans admit directly; invite-only clans put the request in a queue the
  -- leader answers.
  if v_clan.privacy = 'open' then
    v_status := 'active';
  else
    v_status := 'pending';
  end if;

  insert into public.clan_members (clan_id, member_id, status, joined_at, resolved_at)
  values (
    v_clan.id,
    v_actor_id,
    v_status,
    case when v_status = 'active' then now() else null end,
    null
  )
  on conflict (clan_id, member_id) do nothing
  returning clan_members.id into v_membership_id;

  if v_membership_id is null then
    raise exception using errcode = '22023', message = 'already a member or request pending';
  end if;

  if v_status = 'active' then
    update public.clans
    set member_count = clans.member_count + 1
    where clans.id = v_clan.id;
  end if;

  return query select v_membership_id, v_status;
end;
$$;

-- Sends an invitation. The recipient answers through `respond_to_clan_invite`.
-- Re-created in 0017 to enqueue a clan_invite notification.
create or replace function public.invite_to_clan(
  p_clan_id uuid,
  p_member_id uuid,
  p_note text default null
)
returns table (membership_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_clan public.clans;
  v_clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_membership_id uuid;
begin
  v_actor_id := private.require_active_actor();

  select * into v_clan from public.clans where clans.id = p_clan_id for update;

  if v_clan.id is null or v_clan.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'clan not found';
  end if;

  if not private.clan_is_led_by_caller(v_clan.id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_member_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  -- A block is a wall: nobody is invited by someone they block or who blocks
  -- them.
  if private.users_are_blocked(v_actor_id, p_member_id) then
    raise exception using errcode = '42501', message = 'cannot invite this member';
  end if;

  if v_clean_note is not null and char_length(v_clean_note) > 500 then
    raise exception using errcode = '22023', message = 'note must not exceed 500 characters';
  end if;

  -- An existing pending/active relationship stops a second invitation.
  select * into v_membership
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = p_member_id
  for update;

  if v_membership.id is not null then
    if v_membership.status in ('active', 'pending', 'invited') then
      raise exception using errcode = '22023', message = 'member already belongs or is invited';
    end if;
  end if;

  -- `resolved_at` records the answer to an invitation, not its sending.
  insert into public.clan_members (clan_id, member_id, role, status, resolution_note, resolved_by, resolved_at)
  values (p_clan_id, p_member_id, 'member', 'invited', v_clean_note, v_actor_id, null)
  on conflict (clan_id, member_id) do update
  set status = 'invited',
      resolution_note = excluded.resolution_note,
      resolved_by = v_actor_id,
      resolved_at = null
  returning clan_members.id into v_membership_id;

  return query select v_membership_id;
end;
$$;

create or replace function public.respond_to_clan_invite(
  p_membership_id uuid,
  p_accept boolean
)
returns table (membership_id uuid, status public.clan_member_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
begin
  v_actor_id := private.require_active_actor();

  select * into v_membership from public.clan_members where clan_members.id = p_membership_id for update;

  if v_membership.id is null or v_membership.member_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'invitation not found';
  end if;

  if v_membership.status <> 'invited' then
    raise exception using errcode = '22023', message = 'this invitation is no longer open';
  end if;

  if p_accept then
    update public.clan_members
    set status = 'active',
        joined_at = now()
    where clan_members.id = v_membership.id;

    update public.clans
    set member_count = clans.member_count + 1
    where clans.id = v_membership.clan_id;
  else
    update public.clan_members
    set status = 'rejected',
        resolved_by = v_actor_id,
        resolved_at = now()
    where clan_members.id = v_membership.id;
  end if;

  return query select v_membership.id,
    case when p_accept then 'active'::public.clan_member_status else 'rejected'::public.clan_member_status end;
end;
$$;

create or replace function public.review_clan_request(
  p_membership_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns table (membership_id uuid, status public.clan_member_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_clean_reason text;
begin
  v_actor_id := private.require_active_actor();

  select * into v_membership from public.clan_members where clan_members.id = p_membership_id for update;

  if v_membership.id is null then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;

  if not private.clan_is_led_by_caller(v_membership.clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if v_membership.status <> 'pending' then
    raise exception using errcode = '22023', message = 'this request is no longer open';
  end if;

  v_clean_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if p_accept then
    update public.clan_members
    set status = 'active',
        joined_at = now()
    where clan_members.id = v_membership.id;

    update public.clans
    set member_count = clans.member_count + 1
    where clans.id = v_membership.clan_id;
  else
    update public.clan_members
    set status = 'rejected',
        resolution_note = v_clean_reason,
        resolved_by = v_actor_id,
        resolved_at = now()
    where clan_members.id = v_membership.id;
  end if;

  return query select v_membership.id,
    case when p_accept then 'active'::public.clan_member_status else 'rejected'::public.clan_member_status end;
end;
$$;

create or replace function public.leave_clan(
  p_clan_id uuid,
  p_reason text default null
)
returns table (membership_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor_id := private.require_active_actor();

  select * into v_membership
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = v_actor_id
  for update;

  if v_membership.id is null then
    raise exception using errcode = 'P0002', message = 'not a member';
  end if;

  if v_membership.status <> 'active' then
    raise exception using errcode = '22023', message = 'only an active member can leave';
  end if;

  -- The leader cannot walk out; leadership changes first.
  if v_membership.role = 'leader' then
    raise exception using errcode = '42501', message = 'the leader must transfer leadership before leaving';
  end if;

  update public.clan_members
  set status = 'left',
      resolution_note = v_clean_reason,
      resolved_by = v_actor_id,
      resolved_at = now()
  where clan_members.id = v_membership.id;

  update public.clans
  set member_count = greatest(clans.member_count - 1, 0)
  where clans.id = p_clan_id;

  return query select v_membership.id;
end;
$$;

create or replace function public.expel_clan_member(
  p_clan_id uuid,
  p_member_id uuid,
  p_reason text
)
returns table (membership_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_clean_reason text;
begin
  v_actor_id := private.require_active_actor();
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_membership
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = p_member_id
  for update;

  if v_membership.id is null then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if v_membership.status <> 'active' then
    raise exception using errcode = '22023', message = 'only an active member can be expelled';
  end if;

  if v_membership.role = 'leader' then
    raise exception using errcode = '42501', message = 'the leader cannot expel themselves';
  end if;

  update public.clan_members
  set status = 'expelled',
      resolution_note = v_clean_reason,
      resolved_by = v_actor_id,
      resolved_at = now()
  where clan_members.id = v_membership.id;

  update public.clans
  set member_count = greatest(clans.member_count - 1, 0)
  where clans.id = p_clan_id;

  perform private.write_audit_log(
    v_actor_id,
    'clan.member_expelled',
    'clan',
    p_clan_id,
    v_clean_reason,
    jsonb_build_object('member_id', p_member_id),
    jsonb_build_object('member_id', p_member_id)
  );

  return query select v_membership.id;
end;
$$;

create or replace function public.transfer_clan_leadership(
  p_clan_id uuid,
  p_new_leader_member_id uuid,
  p_reason text
)
returns table (clan_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_current public.clan_members;
  v_new_leader public.clan_members;
  v_clean_reason text;
begin
  v_actor_id := private.require_active_actor();
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_current
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.role = 'leader'
    and clan_members.status = 'active'
  for update;

  if v_current.id is null then
    raise exception using errcode = 'P0002', message = 'clan has no active leader';
  end if;

  if not (v_current.member_id = v_actor_id or private.user_has_permission(v_actor_id, 'admin.manage_clans')) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  select * into v_new_leader
  from public.clan_members
  where clan_members.id = p_new_leader_member_id
    and clan_members.clan_id = p_clan_id
    and clan_members.status = 'active'
  for update;

  if v_new_leader.id is null then
    raise exception using errcode = 'P0002', message = 'new leader is not an active member';
  end if;

  if v_new_leader.id = v_current.id then
    raise exception using errcode = '22023', message = 'member already leads this clan';
  end if;

  update public.clan_members
  set role = 'member'
  where clan_members.id = v_current.id;

  update public.clan_members
  set role = 'leader'
  where clan_members.id = v_new_leader.id;

  update public.clans
  set leader_id = v_new_leader.member_id
  where clans.id = p_clan_id;

  perform private.write_audit_log(
    v_actor_id,
    'clan.leadership',
    'clan',
    p_clan_id,
    v_clean_reason,
    jsonb_build_object('leader_id', v_current.member_id),
    jsonb_build_object('leader_id', v_new_leader.member_id)
  );

  return query select p_clan_id;
end;
$$;

create or replace function public.set_clan_member_role(
  p_clan_id uuid,
  p_member_id uuid,
  p_role public.clan_member_role,
  p_reason text
)
returns table (membership_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_clean_reason text;
begin
  v_actor_id := private.require_active_actor();
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_membership
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = p_member_id
  for update;

  if v_membership.id is null then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if v_membership.role = 'leader' then
    raise exception using errcode = '42501', message = 'the leader changes only by transfer';
  end if;

  if p_role = 'leader' then
    raise exception using errcode = '22023', message = 'use transfer_clan_leadership to name a leader';
  end if;

  if v_membership.status <> 'active' then
    raise exception using errcode = '22023', message = 'only an active member can hold a role';
  end if;

  update public.clan_members
  set role = p_role
  where clan_members.id = v_membership.id;

  perform private.write_audit_log(
    v_actor_id,
    'clan.member_role',
    'clan',
    p_clan_id,
    v_clean_reason,
    jsonb_build_object('member_id', p_member_id, 'role', v_membership.role),
    jsonb_build_object('member_id', p_member_id, 'role', p_role)
  );

  return query select v_membership.id;
end;
$$;

-- ── Internal roles ──────────────────────────────────────────────────────────

create or replace function public.upsert_clan_internal_role(
  p_clan_id uuid,
  p_name text,
  p_description text default null,
  p_permissions text[] default '{}'
)
returns table (internal_role_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_role_id uuid;
begin
  v_actor_id := private.require_active_actor();

  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  if char_length(v_clean_name) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 60 characters';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_permissions, '{}'::text[])) as perm
    where perm !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' or char_length(perm) not between 3 and 60
  ) then
    raise exception using errcode = '22023', message = 'invalid internal permission name';
  end if;

  insert into public.clan_internal_roles (clan_id, name, description)
  values (p_clan_id, v_clean_name, nullif(btrim(p_description), ''))
  on conflict (clan_id, name) do update
  set description = excluded.description
  returning clan_internal_roles.id into v_role_id;

  delete from public.clan_internal_permissions
  where clan_internal_permissions.internal_role_id = v_role_id;

  insert into public.clan_internal_permissions (internal_role_id, permission)
  select v_role_id, perm
  from unnest(coalesce(p_permissions, '{}'::text[])) as perm;

  return query select v_role_id;
end;
$$;

create or replace function public.remove_clan_internal_role(
  p_clan_id uuid,
  p_internal_role_id uuid
)
returns table (internal_role_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_actor();

  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  delete from public.clan_internal_roles
  where clan_internal_roles.id = p_internal_role_id
    and clan_internal_roles.clan_id = p_clan_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'internal role not found';
  end if;

  return query select p_internal_role_id;
end;
$$;

create or replace function public.assign_clan_internal_role(
  p_clan_id uuid,
  p_member_id uuid,
  p_internal_role_id uuid,
  p_remove boolean default false
)
returns table (assignment_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_membership public.clan_members;
  v_assignment_id uuid;
begin
  v_actor_id := private.require_active_actor();

  if not private.clan_is_led_by_caller(p_clan_id) then
    raise exception using errcode = '42501', message = 'permission denied';
  end if;

  select * into v_membership
  from public.clan_members
  where clan_members.clan_id = p_clan_id
    and clan_members.member_id = p_member_id
    and clan_members.status = 'active';

  if v_membership.id is null then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if not exists (
    select 1 from public.clan_internal_roles
    where clan_internal_roles.id = p_internal_role_id
      and clan_internal_roles.clan_id = p_clan_id
  ) then
    raise exception using errcode = 'P0002', message = 'internal role not found';
  end if;

  if coalesce(p_remove, false) then
    delete from public.clan_role_members
    where clan_role_members.internal_role_id = p_internal_role_id
      and clan_role_members.clan_member_id = v_membership.id;
    return query select null::uuid;
    return;
  end if;

  insert into public.clan_role_members (internal_role_id, clan_member_id, assigned_by)
  values (p_internal_role_id, v_membership.id, v_actor_id)
  on conflict (internal_role_id, clan_member_id) do nothing
  returning clan_role_members.id into v_assignment_id;

  if v_assignment_id is null then
    raise exception using errcode = '22023', message = 'member already holds this internal role';
  end if;

  return query select v_assignment_id;
end;
$$;

-- ── Rank administration ─────────────────────────────────────────────────────

create or replace function public.admin_upsert_rank(
  p_slug text,
  p_name text,
  p_description text default null,
  p_color text default null,
  p_sort_order integer default 0
)
returns table (rank_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_slug text := lower(btrim(coalesce(p_slug, '')));
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_existing public.ranks;
begin
  v_actor_id := private.require_permission('rank.manage');

  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_clean_slug) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(v_clean_name) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 60 characters';
  end if;

  if p_color is not null and p_color !~ '^#[0-9a-fA-F]{3,8}$' then
    raise exception using errcode = '22023', message = 'color must be a hex value';
  end if;

  select * into v_existing from public.ranks where ranks.slug = v_clean_slug for update;

  insert into public.ranks (slug, name, description, color, sort_order)
  values (v_clean_slug, v_clean_name, nullif(btrim(p_description), ''), p_color, coalesce(p_sort_order, 0))
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      color = excluded.color,
      sort_order = excluded.sort_order;

  perform private.write_audit_log(
    v_actor_id,
    case when v_existing.id is null then 'rank.create' else 'rank.update' end,
    'rank',
    coalesce(v_existing.id, (select id from public.ranks where slug = v_clean_slug)),
    null,
    case when v_existing.id is null then null
      else jsonb_build_object('name', v_existing.name, 'sort_order', v_existing.sort_order)
    end,
    jsonb_build_object('slug', v_clean_slug, 'name', v_clean_name)
  );

  return query select v_clean_slug;
end;
$$;

create or replace function public.admin_set_rank_status(
  p_slug text,
  p_expected_status public.rank_status,
  p_status public.rank_status,
  p_reason text
)
returns table (rank_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_rank public.ranks;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('rank.manage');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_rank from public.ranks where ranks.slug = p_slug for update;

  if v_rank.id is null then
    raise exception using errcode = 'P0002', message = 'rank not found';
  end if;

  if v_rank.status is distinct from p_expected_status then
    raise exception using errcode = '40001', message = 'rank changed since it was read';
  end if;

  if v_rank.status = p_status then
    raise exception using errcode = '22023', message = 'rank already has that status';
  end if;

  update public.ranks set status = p_status where ranks.id = v_rank.id;

  perform private.write_audit_log(
    v_actor_id,
    'rank.status',
    'rank',
    v_rank.id,
    v_clean_reason,
    jsonb_build_object('status', v_rank.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_rank.slug;
end;
$$;

create or replace function public.assign_rank(
  p_user_id uuid,
  p_rank_slug text,
  p_reason text
)
returns table (user_rank_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_rank public.ranks;
  v_clean_reason text;
  v_assignment_id uuid;
begin
  v_actor_id := private.require_permission('rank.manage');
  v_clean_reason := private.validated_reason(p_reason);

  if not exists (
    select 1 from public.profiles where profiles.id = p_user_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  select * into v_rank from public.ranks where ranks.slug = p_rank_slug;

  if v_rank.id is null or v_rank.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'rank not found';
  end if;

  insert into public.user_ranks (rank_id, user_id, assigned_by, reason)
  values (v_rank.id, p_user_id, v_actor_id, v_clean_reason)
  on conflict (user_id) do update
  set rank_id = excluded.rank_id,
      assigned_by = excluded.assigned_by,
      reason = excluded.reason,
      assigned_at = now()
  returning user_ranks.id into v_assignment_id;

  perform private.write_audit_log(
    v_actor_id,
    'rank.assigned',
    'user',
    p_user_id,
    v_clean_reason,
    null,
    jsonb_build_object('rank_slug', v_rank.slug)
  );

  return query select v_assignment_id;
end;
$$;

create or replace function public.remove_rank(
  p_user_id uuid,
  p_reason text
)
returns table (removed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('rank.manage');
  v_clean_reason := private.validated_reason(p_reason);

  delete from public.user_ranks where user_ranks.user_id = p_user_id;

  perform private.write_audit_log(
    v_actor_id,
    'rank.removed',
    'user',
    p_user_id,
    v_clean_reason,
    jsonb_build_object('rank_removed', true),
    null
  );

  return query select found;
end;
$$;

-- ── Badge administration ────────────────────────────────────────────────────

create or replace function public.admin_upsert_badge(
  p_slug text,
  p_name text,
  p_description text default null,
  p_required_issuer_permission text default null,
  p_sort_order integer default 0
)
returns table (badge_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_slug text := lower(btrim(coalesce(p_slug, '')));
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_existing public.badges;
begin
  v_actor_id := private.require_permission('badge.manage');

  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_clean_slug) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(v_clean_name) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 60 characters';
  end if;

  if p_required_issuer_permission is not null
     and not exists (
       select 1 from public.permissions where permissions.name = p_required_issuer_permission
     ) then
    raise exception using errcode = '22023', message = 'issuer permission does not exist';
  end if;

  select * into v_existing from public.badges where badges.slug = v_clean_slug for update;

  insert into public.badges (slug, name, description, required_issuer_permission, sort_order)
  values (
    v_clean_slug, v_clean_name, nullif(btrim(p_description), ''),
    nullif(p_required_issuer_permission, ''), coalesce(p_sort_order, 0)
  )
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      required_issuer_permission = excluded.required_issuer_permission,
      sort_order = excluded.sort_order;

  perform private.write_audit_log(
    v_actor_id,
    case when v_existing.id is null then 'badge.create' else 'badge.update' end,
    'badge',
    coalesce(v_existing.id, (select id from public.badges where slug = v_clean_slug)),
    null,
    case when v_existing.id is null then null
      else jsonb_build_object('name', v_existing.name)
    end,
    jsonb_build_object('slug', v_clean_slug, 'name', v_clean_name)
  );

  return query select v_clean_slug;
end;
$$;

create or replace function public.admin_set_badge_status(
  p_slug text,
  p_expected_status public.badge_status,
  p_status public.badge_status,
  p_reason text
)
returns table (badge_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_badge public.badges;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('badge.manage');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_badge from public.badges where badges.slug = p_slug for update;

  if v_badge.id is null then
    raise exception using errcode = 'P0002', message = 'badge not found';
  end if;

  if v_badge.status is distinct from p_expected_status then
    raise exception using errcode = '40001', message = 'badge changed since it was read';
  end if;

  if v_badge.status = p_status then
    raise exception using errcode = '22023', message = 'badge already has that status';
  end if;

  update public.badges set status = p_status where badges.id = v_badge.id;

  perform private.write_audit_log(
    v_actor_id,
    'badge.status',
    'badge',
    v_badge.id,
    v_clean_reason,
    jsonb_build_object('status', v_badge.status),
    jsonb_build_object('status', p_status)
  );

  return query select v_badge.slug;
end;
$$;

-- The authorized-issuers rule: the issuer must hold `badge.award` and, when the
-- badge names one, its required issuer permission.
create or replace function public.award_badge(
  p_user_id uuid,
  p_badge_slug text,
  p_reason text,
  p_evidence_ref text default null,
  p_evidence_visibility public.evidence_visibility default 'public'
)
returns table (user_badge_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_badge public.badges;
  v_clean_reason text;
  v_clean_evidence text := nullif(btrim(coalesce(p_evidence_ref, '')), '');
  v_award_id uuid;
begin
  v_actor_id := private.require_permission('badge.award');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_badge from public.badges where badges.slug = p_badge_slug;

  if v_badge.id is null or v_badge.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'badge not found';
  end if;

  if v_badge.required_issuer_permission is not null
     and not private.user_has_permission(v_actor_id, v_badge.required_issuer_permission) then
    raise exception using errcode = '42501', message = 'not an authorized issuer for this badge';
  end if;

  if v_clean_evidence is not null and char_length(v_clean_evidence) > 500 then
    raise exception using errcode = '22023', message = 'evidence reference must not exceed 500 characters';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_user_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  insert into public.user_badges (
    badge_id, user_id, issuer_id, reason, evidence_ref, evidence_visibility
  )
  values (
    v_badge.id, p_user_id, v_actor_id, v_clean_reason, v_clean_evidence,
    coalesce(p_evidence_visibility, 'public')
  )
  returning user_badges.id into v_award_id;

  perform private.write_audit_log(
    v_actor_id,
    'badge.awarded',
    'user',
    p_user_id,
    v_clean_reason,
    null,
    jsonb_build_object('badge_slug', v_badge.slug, 'evidence_visibility', p_evidence_visibility)
  );

  return query select v_award_id;
end;
$$;

-- Revoking keeps the row and its history. The badge leaves the live set only.
create or replace function public.revoke_badge(
  p_user_badge_id uuid,
  p_reason text
)
returns table (user_badge_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_user_badge public.user_badges;
  v_badge public.badges;
  v_clean_reason text;
begin
  v_actor_id := private.require_permission('badge.award');
  v_clean_reason := private.validated_reason(p_reason);

  select * into v_user_badge from public.user_badges where user_badges.id = p_user_badge_id for update;

  if v_user_badge.id is null then
    raise exception using errcode = 'P0002', message = 'badge award not found';
  end if;

  select * into v_badge from public.badges where badges.id = v_user_badge.badge_id;

  if v_badge.required_issuer_permission is not null
     and not private.user_has_permission(v_actor_id, v_badge.required_issuer_permission) then
    raise exception using errcode = '42501', message = 'not an authorized issuer for this badge';
  end if;

  if v_user_badge.status = 'revoked' then
    raise exception using errcode = '22023', message = 'badge is already revoked';
  end if;

  update public.user_badges
  set status = 'revoked',
      revoked_by = v_actor_id,
      revoked_at = now(),
      revoked_reason = v_clean_reason
  where user_badges.id = v_user_badge.id;

  perform private.write_audit_log(
    v_actor_id,
    'badge.revoked',
    'user',
    v_user_badge.user_id,
    v_clean_reason,
    jsonb_build_object('badge_slug', v_badge.slug),
    jsonb_build_object('badge_slug', v_badge.slug, 'revoked', true)
  );

  return query select v_user_badge.id;
end;
$$;

-- ── Friends and blocks ──────────────────────────────────────────────────────

-- Sends a friend request. Blocks are checked in both directions. Re-created in
-- 0017 to enqueue a friend_request notification.
create or replace function public.send_friend_request(
  p_addressee_id uuid,
  p_note text default null
)
returns table (friendship_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_friendship_id uuid;
begin
  v_actor_id := private.require_active_actor();

  if v_actor_id = p_addressee_id then
    raise exception using errcode = '22023', message = 'cannot befriend yourself';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_addressee_id and profiles.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if private.users_are_blocked(v_actor_id, p_addressee_id) then
    raise exception using errcode = '42501', message = 'cannot send a request to this member';
  end if;

  if v_clean_note is not null and char_length(v_clean_note) > 500 then
    raise exception using errcode = '22023', message = 'note must not exceed 500 characters';
  end if;

  perform private.enforce_friend_request_rate_limit(v_actor_id);

  -- The partial unique index on live pairs turns a duplicate into a no-op row;
  -- detecting the conflict by catching the unique violation is the reliable way
  -- to answer "already requested or friends" for either direction.
  begin
    insert into public.friendships (requester_id, addressee_id)
    values (v_actor_id, p_addressee_id)
    returning friendships.id into v_friendship_id;
  exception when unique_violation then
    raise exception using errcode = '22023', message = 'a request already exists in one direction';
  end;

  return query select v_friendship_id;
end;
$$;

create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns table (friendship_id uuid, status public.friendship_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_friendship public.friendships;
begin
  v_actor_id := private.require_active_actor();

  select * into v_friendship from public.friendships where friendships.id = p_friendship_id for update;

  if v_friendship.id is null or v_friendship.addressee_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;

  if v_friendship.status <> 'pending' then
    raise exception using errcode = '22023', message = 'this request is no longer open';
  end if;

  -- A request answered by someone now blocked by either side ends as rejected.
  if not p_accept or private.users_are_blocked(v_actor_id, v_friendship.requester_id) then
    update public.friendships
    set status = 'rejected'
    where friendships.id = v_friendship.id;
    return query select v_friendship.id, 'rejected'::public.friendship_status;
    return;
  end if;

  update public.friendships
  set status = 'accepted'
  where friendships.id = v_friendship.id;

  return query select v_friendship.id, 'accepted'::public.friendship_status;
end;
$$;

create or replace function public.cancel_friend_request(p_friendship_id uuid)
returns table (friendship_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_friendship public.friendships;
begin
  v_actor_id := private.require_active_actor();

  select * into v_friendship from public.friendships where friendships.id = p_friendship_id for update;

  if v_friendship.id is null or v_friendship.requester_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;

  if v_friendship.status <> 'pending' then
    raise exception using errcode = '22023', message = 'only a pending request can be cancelled';
  end if;

  update public.friendships
  set status = 'cancelled'
  where friendships.id = v_friendship.id;

  return query select v_friendship.id;
end;
$$;

create or replace function public.remove_friend(p_friendship_id uuid)
returns table (friendship_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_friendship public.friendships;
begin
  v_actor_id := private.require_active_actor();

  select * into v_friendship from public.friendships where friendships.id = p_friendship_id for update;

  if v_friendship.id is null then
    raise exception using errcode = 'P0002', message = 'friendship not found';
  end if;

  if v_friendship.requester_id <> v_actor_id and v_friendship.addressee_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'friendship not found';
  end if;

  if v_friendship.status <> 'accepted' then
    raise exception using errcode = '22023', message = 'only an accepted friendship can be removed';
  end if;

  update public.friendships
  set status = 'removed'
  where friendships.id = v_friendship.id;

  return query select v_friendship.id;
end;
$$;

create or replace function public.block_user(
  p_blocked_id uuid,
  p_reason text default null
)
returns table (block_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_block_id uuid;
begin
  v_actor_id := private.require_active_actor();

  if v_actor_id = p_blocked_id then
    raise exception using errcode = '22023', message = 'cannot block yourself';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = p_blocked_id
  ) then
    raise exception using errcode = 'P0002', message = 'member not found';
  end if;

  if v_clean_reason is not null and char_length(v_clean_reason) > 500 then
    raise exception using errcode = '22023', message = 'reason must not exceed 500 characters';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_actor_id, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing
  returning blocks.id into v_block_id;

  if v_block_id is null then
    raise exception using errcode = '22023', message = 'this member is already blocked';
  end if;

  -- A block ends every live friendship or request with the blocked member, so
  -- no lingering accepted friendship survives a block.
  update public.friendships
  set status = case
      when friendships.status = 'accepted' then 'removed'::public.friendship_status
      else 'cancelled'::public.friendship_status
    end
  where (friendships.requester_id = v_actor_id and friendships.addressee_id = p_blocked_id)
     or (friendships.requester_id = p_blocked_id and friendships.addressee_id = v_actor_id);

  return query select v_block_id;
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns table (unblocked boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_actor();

  delete from public.blocks
  where blocks.blocker_id = v_actor_id
    and blocks.blocked_id = p_blocked_id;

  return query select found;
end;
$$;

create or replace function public.list_friends(
  p_user_id uuid default null,
  p_limit integer default 50
)
returns table (
  friend_id uuid,
  display_name text,
  avatar_path text,
  friends_since timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid := auth.uid();
  v_target_id uuid := coalesce(p_user_id, v_actor_id);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_target_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  -- Other people's friend lists are public only while their profile is visible.
  if p_user_id is not null and not private.profile_is_visible_to_caller(p_user_id) then
    return;
  end if;

  return query
  select
    peer.id,
    peer.display_name,
    peer.avatar_path,
    friendships.updated_at
  from public.friendships
  join public.profiles peer
    on peer.id = case
      when friendships.requester_id = v_target_id then friendships.addressee_id
      else friendships.requester_id
    end
  where friendships.status = 'accepted'
    and (friendships.requester_id = v_target_id or friendships.addressee_id = v_target_id)
    and private.profile_is_visible_to_caller(peer.id)
  order by friendships.updated_at desc
  limit v_limit;
end;
$$;

create or replace function public.list_own_friend_requests()
returns table (
  friendship_id uuid,
  peer_id uuid,
  peer_display_name text,
  direction text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_actor();

  return query
  select
    friendships.id,
    peer.id,
    peer.display_name,
    case when friendships.addressee_id = v_actor_id then 'incoming' else 'outgoing' end,
    friendships.created_at
  from public.friendships
  join public.profiles peer
    on peer.id = case
      when friendships.requester_id = v_actor_id then friendships.addressee_id
      else friendships.requester_id
    end
  where friendships.status = 'pending'
    and (friendships.requester_id = v_actor_id or friendships.addressee_id = v_actor_id)
  order by friendships.created_at desc, friendships.id desc;
end;
$$;

create or replace function public.list_own_blocks()
returns table (
  blocked_id uuid,
  display_name text,
  blocked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := private.require_active_actor();

  return query
  select blocks.blocked_id, profiles.display_name, blocks.created_at
  from public.blocks
  join public.profiles on profiles.id = blocks.blocked_id
  where blocks.blocker_id = v_actor_id
  order by blocks.created_at desc;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function public.list_clans() from public, anon, authenticated;
revoke all on function public.get_clan(text) from public, anon, authenticated;
revoke all on function public.list_clan_members(uuid, integer) from public, anon, authenticated;
revoke all on function public.list_clan_internal_roles(uuid) from public, anon, authenticated;
revoke all on function public.list_ranks() from public, anon, authenticated;
revoke all on function public.get_profile_rank(uuid) from public, anon, authenticated;
revoke all on function public.list_profile_badges(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_create_clan(text, text, uuid, text, public.clan_privacy, text)
  from public, anon, authenticated;
revoke all on function public.admin_update_clan(uuid, text, text, public.clan_privacy, text)
  from public, anon, authenticated;
revoke all on function public.admin_set_clan_status(
  uuid, public.clan_status, public.clan_status, text
) from public, anon, authenticated;
revoke all on function public.request_clan_membership(uuid) from public, anon, authenticated;
revoke all on function public.invite_to_clan(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.respond_to_clan_invite(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.review_clan_request(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.leave_clan(uuid, text) from public, anon, authenticated;
revoke all on function public.expel_clan_member(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.transfer_clan_leadership(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.set_clan_member_role(uuid, uuid, public.clan_member_role, text)
  from public, anon, authenticated;
revoke all on function public.upsert_clan_internal_role(uuid, text, text, text[])
  from public, anon, authenticated;
revoke all on function public.remove_clan_internal_role(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.assign_clan_internal_role(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_rank(text, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.admin_set_rank_status(text, public.rank_status, public.rank_status, text)
  from public, anon, authenticated;
revoke all on function public.assign_rank(uuid, text, text) from public, anon, authenticated;
revoke all on function public.remove_rank(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_upsert_badge(text, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.admin_set_badge_status(text, public.badge_status, public.badge_status, text)
  from public, anon, authenticated;
revoke all on function public.award_badge(
  uuid, text, text, text, public.evidence_visibility
) from public, anon, authenticated;
revoke all on function public.revoke_badge(uuid, text) from public, anon, authenticated;
revoke all on function public.send_friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.respond_friend_request(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.cancel_friend_request(uuid) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid) from public, anon, authenticated;
revoke all on function public.block_user(uuid, text) from public, anon, authenticated;
revoke all on function public.unblock_user(uuid) from public, anon, authenticated;
revoke all on function public.list_friends(uuid, integer) from public, anon, authenticated;
revoke all on function public.list_own_friend_requests() from public, anon, authenticated;
revoke all on function public.list_own_blocks() from public, anon, authenticated;

-- Visitors read public clans, ranks and badge lists.
grant execute on function public.list_clans() to anon, authenticated;
grant execute on function public.get_clan(text) to anon, authenticated;
grant execute on function public.list_clan_members(uuid, integer) to anon, authenticated;
grant execute on function public.list_ranks() to anon, authenticated;
grant execute on function public.get_profile_rank(uuid) to anon, authenticated;
grant execute on function public.list_profile_badges(uuid, boolean) to anon, authenticated;

-- Members manage membership, friends, blocks and their own surfaces.
grant execute on function public.request_clan_membership(uuid) to authenticated;
grant execute on function public.invite_to_clan(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_clan_invite(uuid, boolean) to authenticated;
grant execute on function public.review_clan_request(uuid, boolean, text) to authenticated;
grant execute on function public.leave_clan(uuid, text) to authenticated;
grant execute on function public.expel_clan_member(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_clan_leadership(uuid, uuid, text) to authenticated;
grant execute on function public.set_clan_member_role(uuid, uuid, public.clan_member_role, text)
  to authenticated;
grant execute on function public.upsert_clan_internal_role(uuid, text, text, text[])
  to authenticated;
grant execute on function public.remove_clan_internal_role(uuid, uuid) to authenticated;
grant execute on function public.assign_clan_internal_role(uuid, uuid, uuid, boolean)
  to authenticated;
grant execute on function public.list_clan_internal_roles(uuid) to authenticated;
grant execute on function public.send_friend_request(uuid, text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid, text) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_friends(uuid, integer) to authenticated;
grant execute on function public.list_own_friend_requests() to authenticated;
grant execute on function public.list_own_blocks() to authenticated;

-- Administration.
grant execute on function public.admin_create_clan(text, text, uuid, text, public.clan_privacy, text)
  to authenticated;
grant execute on function public.admin_update_clan(uuid, text, text, public.clan_privacy, text)
  to authenticated;
grant execute on function public.admin_set_clan_status(
  uuid, public.clan_status, public.clan_status, text
) to authenticated;
grant execute on function public.admin_upsert_rank(text, text, text, text, integer)
  to authenticated;
grant execute on function public.admin_set_rank_status(text, public.rank_status, public.rank_status, text)
  to authenticated;
grant execute on function public.assign_rank(uuid, text, text) to authenticated;
grant execute on function public.remove_rank(uuid, text) to authenticated;
grant execute on function public.admin_upsert_badge(text, text, text, text, integer)
  to authenticated;
grant execute on function public.admin_set_badge_status(text, public.badge_status, public.badge_status, text)
  to authenticated;
grant execute on function public.award_badge(
  uuid, text, text, text, public.evidence_visibility
) to authenticated;
grant execute on function public.revoke_badge(uuid, text) to authenticated;

comment on table public.clans is
  'A clan or house. The leader is a clan_members row; privacy controls who sees the clan and how people join.';
comment on table public.user_badges is
  'A badge award. Revocation is a status, never a delete, so the issuer, date, reason and evidence stay on record. Private evidence is not exposed on public profiles.';
comment on table public.blocks is
  'A one-way wall between two members. Both directions are checked before friend requests, clan invitations and direct chat interactions.';
comment on function public.list_profile_badges(uuid, boolean) is
  'A member''s badges with their evidence. Private evidence is shown only to the holder and to admin.view_users; everyone else sees the badge without the reference.';
