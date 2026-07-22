-- Replace the broad audit-log RPC with a scalar, allowlisted projection for
-- Council UI. Raw JSON payloads and metadata remain internal to the database.

create index idx_audit_logs_created_id
  on public.audit_logs(created_at desc, id desc);

revoke all on function public.council_list_audit_logs(
  text, uuid, uuid, integer, integer
) from public, anon, authenticated;

drop function public.council_list_audit_logs(
  text, uuid, uuid, integer, integer
);

create function public.council_list_audit_logs(
  p_action text default null,
  p_actor_id uuid default null,
  p_target_id uuid default null,
  p_created_from timestamptz default null,
  p_created_before timestamptz default null,
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
  old_status text,
  new_status text,
  role_name text,
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

  if p_action is not null and (
    char_length(p_action) not between 3 and 100
    or left(p_action, 1) ~ '[[:space:]]'
    or right(p_action, 1) ~ '[[:space:]]'
  ) then
    raise exception using
      errcode = '22023',
      message = 'action filter must contain between 3 and 100 unpadded characters';
  end if;

  if p_created_from is not null
    and p_created_before is not null
    and p_created_from >= p_created_before then
    raise exception using
      errcode = '22023',
      message = 'created_from must be earlier than created_before';
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
    case
      when audit_logs.action in (
        'user.suspended',
        'user.unsuspended',
        'user.banned',
        'user.unbanned'
      )
        and jsonb_typeof(audit_logs.old_values -> 'status') = 'string'
        and audit_logs.old_values ->> 'status'
          in ('active', 'suspended', 'banned')
      then audit_logs.old_values ->> 'status'
      else null
    end as old_status,
    case
      when audit_logs.action in (
        'user.suspended',
        'user.unsuspended',
        'user.banned',
        'user.unbanned'
      )
        and jsonb_typeof(audit_logs.new_values -> 'status') = 'string'
        and audit_logs.new_values ->> 'status'
          in ('active', 'suspended', 'banned')
      then audit_logs.new_values ->> 'status'
      else null
    end as new_status,
    case
      when audit_logs.action = 'user.role_assigned'
        and jsonb_typeof(audit_logs.new_values -> 'role_name') = 'string'
      then audit_logs.new_values ->> 'role_name'
      when audit_logs.action = 'user.role_removed'
        and jsonb_typeof(audit_logs.old_values -> 'role_name') = 'string'
      then audit_logs.old_values ->> 'role_name'
      else null
    end as role_name,
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
    and (p_created_from is null or audit_logs.created_at >= p_created_from)
    and (p_created_before is null or audit_logs.created_at < p_created_before)
  order by audit_logs.created_at desc, audit_logs.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.council_list_audit_logs(
  text, uuid, uuid, timestamptz, timestamptz, integer, integer
) from public, anon, authenticated;

grant execute on function public.council_list_audit_logs(
  text, uuid, uuid, timestamptz, timestamptz, integer, integer
) to authenticated;

comment on function public.council_list_audit_logs(
  text, uuid, uuid, timestamptz, timestamptz, integer, integer
) is 'Lists filtered Council audit events without exposing raw JSON or metadata.';
