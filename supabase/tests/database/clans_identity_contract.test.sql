begin;

-- Clans, Casas and identity contract.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pgtap;
select extensions.plan(70);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f-leader@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Clan Leader"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Clan Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f-nosy@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Clan Nosy"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'f-guardian@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Clan Guardian"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'f-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Clan Admin"}', now(), now(), '', '', '', '');

insert into public.user_roles (user_id, role_id)
select 'f0000000-0000-0000-0000-000000000004', id from public.roles where name = 'Guardian';
insert into public.user_roles (user_id, role_id)
select 'f0000000-0000-0000-0000-000000000005', id from public.roles where name = 'Administrator';

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

create or replace function pg_temp.clan(p_slug text)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.clans where clans.slug = p_slug;
$$;

create or replace function pg_temp.clan_member_status(p_clan_id uuid, p_member_id uuid)
returns text language sql security definer set search_path = '' as $$
  select status::text from public.clan_members
  where clan_members.clan_id = p_clan_id and clan_members.member_id = p_member_id;
$$;

create or replace function pg_temp.clan_member_role(p_clan_id uuid, p_member_id uuid)
returns text language sql security definer set search_path = '' as $$
  select role::text from public.clan_members
  where clan_members.clan_id = p_clan_id and clan_members.member_id = p_member_id;
$$;

create or replace function pg_temp.clan_member_count(p_clan_id uuid)
returns integer language sql security definer set search_path = '' as $$
  select member_count from public.clans where clans.id = p_clan_id;
$$;

create or replace function pg_temp.membership_id(p_clan_id uuid, p_member_id uuid)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.clan_members
  where clan_members.clan_id = p_clan_id and clan_members.member_id = p_member_id;
$$;

create or replace function pg_temp.friendship_id(p_a uuid, p_b uuid)
returns uuid language sql security definer set search_path = '' as $$
  select id from public.friendships
  where (requester_id = p_a and addressee_id = p_b) or (requester_id = p_b and addressee_id = p_a);
$$;

-- ── Schema and exposure ────────────────────────────────────────────────────

select ok(to_regclass('public.clans') is not null, 'clans exists');
select ok(to_regclass('public.clan_members') is not null, 'clan_members exists');
select ok(to_regclass('public.clan_internal_roles') is not null, 'clan_internal_roles exists');
select ok(to_regclass('public.ranks') is not null, 'ranks exists');
select ok(to_regclass('public.user_ranks') is not null, 'user_ranks exists');
select ok(to_regclass('public.badges') is not null, 'badges exists');
select ok(to_regclass('public.user_badges') is not null, 'user_badges exists');
select ok(to_regclass('public.friendships') is not null, 'friendships exists');
select ok(to_regclass('public.blocks') is not null, 'blocks exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.clan_members'::regclass),
  'clan_members has RLS'
);
select is(
  (select count(*) from pg_policies where tablename = 'clan_members'),
  0::bigint,
  'clan_members carries no policy'
);
select is(has_table_privilege('authenticated', 'public.clans', 'select'), false, 'members cannot select clans directly');
select is(
  has_function_privilege('anon', 'public.admin_create_clan(text, text, uuid, text, public.clan_privacy, text)', 'execute'),
  false,
  'anon cannot create clans'
);

-- ── Clan creation and membership ───────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000005');
create temp table t_clan as
select clan_id from public.admin_create_clan(
  'forge-clan', 'Forge Clan', 'f0000000-0000-0000-0000-000000000001',
  'Those who forge.', 'open', 'To keep the forge alive.'
);

select is(
  pg_temp.clan_member_role((select clan_id from t_clan), 'f0000000-0000-0000-0000-000000000001'),
  'leader',
  'the named leader is the clan leader'
);
select is(
  pg_temp.clan_member_status((select clan_id from t_clan), 'f0000000-0000-0000-0000-000000000001'),
  'active',
  'the leader is an active member'
);
select is(
  pg_temp.clan_member_count((select clan_id from t_clan)),
  1,
  'the member counter starts at one'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_create_clan('forge-clan', 'Again', 'f0000000-0000-0000-0000-000000000001')$sql$),
  '23505',
  'a duplicate clan slug is refused'
);

-- A member joins an open clan directly.
set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select is(
  (select status from public.request_clan_membership((select clan_id from t_clan))),
  'active',
  'an open clan admits a member directly'
);
select is(
  pg_temp.clan_member_count((select clan_id from t_clan)),
  2,
  'the counter grows'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.request_clan_membership((select clan_id from t_clan))$sql$),
  '22023',
  'no double membership'
);

-- A stranger sees an open clan; the leader alone manages it.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select is(
  (select count(*) from public.list_clans()),
  1::bigint,
  'a stranger lists the open clan'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.expel_clan_member((select clan_id from t_clan), 'f0000000-0000-0000-0000-000000000002', 'Not allowed')$sql$),
  '42501',
  'only the leader manages the clan'
);

-- ── Invite-only clans ──────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000005');
create temp table t_invite_clan as
select clan_id from public.admin_create_clan(
  'circles', 'Circles', 'f0000000-0000-0000-0000-000000000001',
  'Closed study group.', 'invite'
);

select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select is(
  (select status from public.request_clan_membership((select clan_id from t_invite_clan))),
  'pending',
  'an invite-only clan queues the request'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.request_clan_membership((select clan_id from t_invite_clan))$sql$),
  '22023',
  'a second request is refused'
);

select pg_temp.act_as('f0000000-0000-0000-0000-000000000001');
select ok(
  public.review_clan_request(pg_temp.membership_id((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000003'), true) is not null,
  'the leader accepts the request'
);
select is(
  pg_temp.clan_member_status((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000003'),
  'active',
  'the requester becomes an active member'
);

-- Invitation flow.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000001');
create temp table t_invite as
select membership_id from public.invite_to_clan((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.clan_member_status((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000002'),
  'invited',
  'an invitation is a membership row in invited state'
);

select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select is(
  (select status from public.respond_to_clan_invite((select membership_id from t_invite), true)),
  'active',
  'the invitee accepts'
);

-- ── Leaving, expelling and leadership ──────────────────────────────────────

select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select ok(
  public.leave_clan((select clan_id from t_invite_clan)) is not null,
  'a member leaves'
);
select is(
  pg_temp.clan_member_status((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000003'),
  'left',
  'leaving is a recorded status'
);
select pg_temp.act_as('f0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.leave_clan((select clan_id from t_clan))$sql$),
  '42501',
  'the leader cannot walk out without transferring'
);

select is(
  pg_temp.capture_sqlstate($sql$select * from public.expel_clan_member((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000001', 'Fiat')$sql$),
  '42501',
  'the leader cannot expel themselves'
);
select ok(
  public.expel_clan_member((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000002', 'Broke the creed') is not null,
  'the leader expels a member'
);
select is(
  pg_temp.clan_member_status((select clan_id from t_invite_clan), 'f0000000-0000-0000-0000-000000000002'),
  'expelled',
  'the expelled status is recorded'
);

-- Transfer leadership. Clan creation is an admin act.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000005');
create temp table t_transfer as
select clan_id from public.admin_create_clan('alt-clan', 'Alt Clan', 'f0000000-0000-0000-0000-000000000001');

select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select ok(
  public.request_clan_membership((select clan_id from t_transfer)) is not null,
  'a member joins the transfer clan'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.transfer_clan_leadership((select clan_id from t_transfer), pg_temp.membership_id((select clan_id from t_transfer), 'f0000000-0000-0000-0000-000000000002'), 'Not the leader')$sql$),
  '42501',
  'only the leader transfers leadership'
);
select pg_temp.act_as('f0000000-0000-0000-0000-000000000001');
select ok(
  public.transfer_clan_leadership((select clan_id from t_transfer), pg_temp.membership_id((select clan_id from t_transfer), 'f0000000-0000-0000-0000-000000000002'), 'Time to pass the forge') is not null,
  'the leader transfers leadership'
);
select is(
  pg_temp.clan_member_role((select clan_id from t_transfer), 'f0000000-0000-0000-0000-000000000002'),
  'leader',
  'the successor is leader'
);

-- ── Internal roles ─────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000001');
create temp table t_role as
select internal_role_id from public.upsert_clan_internal_role(
  (select clan_id from t_clan), 'Armorer', 'Cares for the forge', array['manage_forge', 'announce']
);
select is(
  (select permissions from public.list_clan_internal_roles((select clan_id from t_clan)) limit 1),
  array['announce', 'manage_forge']::text[],
  'the internal role carries its permissions'
);
select ok(
  public.assign_clan_internal_role((select clan_id from t_clan), 'f0000000-0000-0000-0000-000000000002', (select internal_role_id from t_role)) is not null,
  'the leader assigns the internal role'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.assign_clan_internal_role((select clan_id from t_clan), 'f0000000-0000-0000-0000-000000000002', (select internal_role_id from t_role))$sql$),
  '22023',
  'a member cannot hold the same internal role twice'
);

-- ── Ranks: display only, never a permission ────────────────────────────────

set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000005');
select ok(
  public.admin_upsert_rank('rookie', 'Rookie', 'Newest member', '#aabbcc', 10) is not null,
  'an administrator creates a rank'
);
select ok(
  public.assign_rank('f0000000-0000-0000-0000-000000000002', 'rookie', 'First assignment') is not null,
  'the rank is assigned'
);
select is(
  (select name from public.get_profile_rank('f0000000-0000-0000-0000-000000000002')),
  'Rookie',
  'the profile shows its rank'
);

-- A rank grants nothing by itself.
set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.admin_upsert_rank('pretender', 'Pretender')$sql$),
  '42501',
  'holding a rank does not grant rank management'
);

-- ── Badges: issuers, revocation, private evidence ──────────────────────────

set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000005');
select ok(
  public.admin_upsert_badge('scholar', 'Scholar', 'Knows the texts', null, 10) is not null,
  'an administrator creates a badge'
);
select ok(
  public.admin_upsert_badge('veritas', 'Veritas', 'Verified a source', 'moderation.hide', 20) is not null,
  'a badge can require an issuer permission'
);

-- The Guardian holds badge.award and moderation.hide, so may award `veritas`.
set local role authenticated;
select pg_temp.act_as('f0000000-0000-0000-0000-000000000004');
create temp table t_badge as
select user_badge_id from public.award_badge(
  'f0000000-0000-0000-0000-000000000002',
  'scholar',
  'Consistently thorough',
  'private-evidence-ref',
  'private'
);
select ok((select user_badge_id from t_badge) is not null, 'a badge.award holder awards a badge');

-- The plain member holds no issuer rule for `veritas`.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.award_badge('f0000000-0000-0000-0000-000000000003', 'veritas', 'Not authorized')$sql$),
  '42501',
  'an unauthorized issuer cannot award a badge with an issuer rule'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.award_badge('f0000000-0000-0000-0000-000000000003', 'scholar', 'Member cannot issue')$sql$),
  '42501',
  'badge.award is required even without an issuer rule'
);

-- Private evidence stays private.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select is(
  (select evidence_ref from public.list_profile_badges('f0000000-0000-0000-0000-000000000002', true)),
  'private-evidence-ref',
  'the holder sees their own private evidence'
);
select is(
  (select evidence_ref from public.list_profile_badges('f0000000-0000-0000-0000-000000000002')),
  null,
  'a public viewer does not see private evidence'
);
select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select is(
  (select evidence_ref from public.list_profile_badges('f0000000-0000-0000-0000-000000000002', true)),
  null,
  'a stranger asking for private evidence still gets none'
);

-- Revocation keeps history and allows re-award.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000004');
select ok(
  public.revoke_badge((select user_badge_id from t_badge), 'Evidence did not hold up') is not null,
  'the issuer revokes the badge'
);
select is(
  (select status from public.list_profile_badges('f0000000-0000-0000-0000-000000000002', true) limit 1),
  'revoked',
  'the revoked badge stays on record'
);
select is(
  (select count(*) from public.list_profile_badges('f0000000-0000-0000-0000-000000000002', true) where status = 'awarded'),
  0::bigint,
  'the revoked badge leaves the live set'
);
select ok(
  public.award_badge('f0000000-0000-0000-0000-000000000002', 'scholar', 'Re-awarded after appeal') is not null,
  'the badge can be awarded again after revocation'
);

-- ── Friends and blocks ─────────────────────────────────────────────────────

select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
create temp table t_friend as
select friendship_id from public.send_friend_request('f0000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_friend_request('f0000000-0000-0000-0000-000000000003')$sql$),
  '22023',
  'a duplicate request in either direction is refused'
);

-- A block stops a request in both directions.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_friend_request('f0000000-0000-0000-0000-000000000001')$sql$),
  '00000',
  'a request to the leader is fine'
);
select ok(
  public.block_user('f0000000-0000-0000-0000-000000000001') is not null,
  'the nosy member blocks the leader'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_friend_request('f0000000-0000-0000-0000-000000000001')$sql$),
  '42501',
  'a blocked member cannot send a request'
);

select pg_temp.act_as('f0000000-0000-0000-0000-000000000001');
select is(
  pg_temp.capture_sqlstate($sql$select * from public.send_friend_request('f0000000-0000-0000-0000-000000000003')$sql$),
  '42501',
  'the blocker is also walled from sending requests'
);

-- Accepting a pending request.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select is(
  (select status from public.respond_friend_request((select friendship_id from t_friend), true)),
  'accepted',
  'the addressee accepts the request'
);
select is(
  (select count(*) from public.list_friends('f0000000-0000-0000-0000-000000000002')),
  1::bigint,
  'the accepted friendship shows on both friend lists'
);

-- Removing a friendship.
select ok(
  public.remove_friend((select friendship_id from t_friend)) is not null,
  'either party removes the friendship'
);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.remove_friend((select friendship_id from t_friend))$sql$),
  '22023',
  'a removed friendship cannot be removed again'
);

-- Blocking ends an existing friendship; unblocking restores nothing silently.
select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
create temp table t_again as
select friendship_id from public.send_friend_request('f0000000-0000-0000-0000-000000000003');
select pg_temp.act_as('f0000000-0000-0000-0000-000000000003');
select ok(
  public.respond_friend_request((select friendship_id from t_again), true) is not null,
  'the pair is friends again'
);
select pg_temp.act_as('f0000000-0000-0000-0000-000000000002');
select ok(
  public.block_user('f0000000-0000-0000-0000-000000000003') is not null,
  'a member blocks their friend'
);
select is(
  (select count(*) from public.list_friends('f0000000-0000-0000-0000-000000000002')),
  0::bigint,
  'the block removed the friendship'
);
select ok(
  public.unblock_user('f0000000-0000-0000-0000-000000000003') is not null,
  'unblocking works'
);

select * from extensions.finish();
rollback;
