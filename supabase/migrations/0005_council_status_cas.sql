-- Make Council status transitions compare-and-swap operations. The expected
-- status is checked while holding the same target-row lock used by the update,
-- so stale moderation UI cannot apply a different transition than intended.

revoke all on function public.council_set_user_status(uuid, text, text)
from public, anon, authenticated;

drop function public.council_set_user_status(uuid, text, text);

create function public.council_set_user_status(
  p_user_id uuid,
  p_expected_status text,
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

  if p_expected_status is null
    or p_expected_status not in ('active', 'suspended', 'banned') then
    raise exception using
      errcode = '22023',
      message = 'invalid expected profile status';
  end if;

  if p_status is null or p_status not in ('active', 'suspended', 'banned') then
    raise exception using
      errcode = '22023',
      message = 'invalid profile status';
  end if;

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'user id is required';
  end if;

  -- Admission requires moderation authority, while the exact transition
  -- permission is deliberately chosen only after the locked CAS check.
  actor_id := private.require_any_permission(
    array['moderation.suspend', 'moderation.ban']::text[]
  );

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

  if old_status <> p_expected_status then
    raise exception using
      errcode = '22023',
      message = 'profile status changed; refresh and retry';
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
    actor_id := private.require_permission('moderation.suspend');
    audit_action := 'user.suspended';
  else
    actor_id := private.require_permission('moderation.ban');
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
  where profiles.id = p_user_id
    and profiles.status = old_status;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'profile status changed during transition';
  end if;

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

revoke all on function public.council_set_user_status(uuid, text, text, text)
from public, anon, authenticated;

grant execute on function public.council_set_user_status(uuid, text, text, text)
to authenticated;

comment on function public.council_set_user_status(uuid, text, text, text) is
  'Atomically changes a Council target status only when p_expected_status still matches.';
