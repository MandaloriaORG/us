-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — Appeals, and how long evidence is kept
--
-- Two halves of the same idea: a moderation system that cannot be argued with
-- and never forgets is not reversible, it is just permanent.
--
--   * An **appeal** is a member's argument against one recorded action. It is
--     linked to the audit row for that action, not to the content, so a member
--     appeals *what was done to them* and a reviewer always sees which decision
--     is under argument. Granting an appeal is a judgement, not a rollback: the
--     reviewer still has to undo the action through the RPC that owns it, which
--     writes its own audit row. Two records, both true.
--   * **Retention** bounds the evidence. Closed reports and decided appeals are
--     working material and are purged 180 days after they close. Audit rows are
--     deliberately not purged: they are the record that an action happened, and
--     losing them would make an old account impossible to explain.
--
-- A suspended or banned member may file an appeal. This is the one write path
-- in the system that survives losing your account status, because the alternative
-- is a ban nobody can contest. Every other rule still applies: rate limits, one
-- live appeal per action, and no reading of anyone else's.
--
-- `moderation_appeals` has RLS enabled with no policies and no grants, so it is
-- unreachable from the Data API; every path below is a SECURITY DEFINER RPC.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enum ───────────────────────────────────────────────────────────────────

-- 'under_review' is a reviewer claiming the appeal, exactly as with reports.
create type public.appeal_status as enum (
  'open',
  'under_review',
  'granted',
  'denied'
);

-- ── Table ──────────────────────────────────────────────────────────────────

create table public.moderation_appeals (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- The action being argued with. Cascades: if the record of the action is
  -- gone, an appeal against it has nothing left to mean.
  audit_log_id uuid not null references public.audit_logs (id) on delete cascade,
  appellant_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    constraint moderation_appeals_body_length
    check (char_length(btrim(body)) between 20 and 2000),
  status public.appeal_status not null default 'open',
  decision text
    constraint moderation_appeals_decision_length
    check (decision is null or char_length(decision) between 3 and 500),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A decided appeal always says when it was decided; an open one never does.
  -- Keyed on the timestamp, not the reviewer, whose profile may later go.
  constraint moderation_appeals_decision_matches_status check (
    (status in ('granted', 'denied')) = (decided_at is not null)
  ),
  constraint moderation_appeals_decision_present check (
    (status in ('granted', 'denied')) = (decision is not null)
  )
);

create index moderation_appeals_queue_idx
  on public.moderation_appeals (status, created_at desc, id desc);
create index moderation_appeals_appellant_idx
  on public.moderation_appeals (appellant_id, created_at desc, id desc);
create index moderation_appeals_action_idx
  on public.moderation_appeals (audit_log_id);

-- One live appeal per member per action. Arguing the same decision twice at
-- once is noise; arguing it again after it was decided is not allowed at all,
-- which `create_appeal` enforces below — a decided appeal is the end of that
-- argument.
create unique index moderation_appeals_one_live_per_action_idx
  on public.moderation_appeals (appellant_id, audit_log_id)
  where status in ('open', 'under_review');

create trigger moderation_appeals_set_updated_at
  before update on public.moderation_appeals
  for each row execute function public.update_updated_at();

alter table public.moderation_appeals enable row level security;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- Which recorded actions a member may argue with. Deliberately only the ones
-- taken *against* someone: a role assignment or an internal note is not a
-- sanction, and moving a post between Plazas is housekeeping.
create or replace function private.appealable_actions()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'user.warned',
    'user.suspended',
    'user.banned',
    'post.status',
    'comment.status',
    'post.flags',
    'comment.flags'
  ]::text[];
$$;

-- Who an audit row was written about. For a user action that is the target; for
-- a content action it is the content's author, who is the person sanctioned.
-- Returns null when the row is not appealable at all.
create or replace function private.audit_log_subject(p_audit_log_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_log public.audit_logs;
begin
  select * into v_log from public.audit_logs where audit_logs.id = p_audit_log_id;

  if v_log.id is null or not (v_log.action = any (private.appealable_actions())) then
    return null;
  end if;

  if v_log.target_type = 'user' then
    return v_log.target_id;
  end if;

  if v_log.target_type = 'post' then
    return (select posts.author_id from public.posts where posts.id = v_log.target_id);
  end if;

  if v_log.target_type = 'comment' then
    return (select comments.author_id from public.comments where comments.id = v_log.target_id);
  end if;

  return null;
end;
$$;

-- Counted from the appeals themselves, like every other limit in this schema,
-- so it cannot drift from what was actually filed.
create or replace function private.enforce_appeal_rate_limit(p_appellant_id uuid)
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
  from public.moderation_appeals
  where moderation_appeals.appellant_id = p_appellant_id
    and moderation_appeals.created_at > now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception using
      errcode = '53400',
      message = 'appeal rate limit reached, try again later';
  end if;
end;
$$;

-- ── The member's side ──────────────────────────────────────────────────────

-- What was done to me, and can I still argue with it. This is the only read of
-- `audit_logs` a member has, and it is filtered to rows about themselves.
create or replace function public.list_own_moderation_actions(p_limit integer default 50)
returns table (
  audit_log_id uuid,
  action text,
  reason text,
  created_at timestamptz,
  appeal_id uuid,
  appeal_status public.appeal_status
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    logs.id,
    logs.action,
    logs.reason,
    logs.created_at,
    appeals.id,
    appeals.status
  from public.audit_logs logs
  left join public.posts target_post
    on logs.target_type = 'post' and target_post.id = logs.target_id
  left join public.comments target_comment
    on logs.target_type = 'comment' and target_comment.id = logs.target_id
  left join public.moderation_appeals appeals
    on appeals.audit_log_id = logs.id
    and appeals.appellant_id = v_actor_id
  -- The same subject rule as `private.audit_log_subject`, expressed as joins so
  -- one query answers the whole list instead of one call per audit row.
  where logs.action = any (private.appealable_actions())
    and case logs.target_type
      when 'user' then logs.target_id
      when 'post' then target_post.author_id
      when 'comment' then target_comment.author_id
    end = v_actor_id
  order by logs.created_at desc, logs.id desc
  limit v_limit;
end;
$$;

-- Filing an appeal. Note what is *not* required: an active account. A banned
-- member is exactly the person who needs this path.
create or replace function public.create_appeal(
  p_audit_log_id uuid,
  p_body text
)
returns table (appeal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_subject_id uuid;
  v_clean_body text;
  v_existing public.appeal_status;
  v_new_appeal_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (select 1 from public.profiles where profiles.id = v_actor_id) then
    raise exception using errcode = '42501', message = 'account required';
  end if;

  v_clean_body := nullif(
    btrim(regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')),
    ''
  );

  if v_clean_body is null or char_length(v_clean_body) not between 20 and 2000 then
    raise exception using
      errcode = '22023',
      message = 'an appeal must contain between 20 and 2000 characters';
  end if;

  v_subject_id := private.audit_log_subject(p_audit_log_id);

  -- An action that is not appealable, does not exist, or was taken against
  -- somebody else is all the same answer: there is nothing here for you. Saying
  -- "forbidden" would turn an id into a probe for other people's sanctions.
  if v_subject_id is null or v_subject_id <> v_actor_id then
    raise exception using errcode = 'P0002', message = 'action not found';
  end if;

  select moderation_appeals.status into v_existing
  from public.moderation_appeals
  where moderation_appeals.audit_log_id = p_audit_log_id
    and moderation_appeals.appellant_id = v_actor_id
  order by moderation_appeals.created_at desc
  limit 1;

  if v_existing in ('open', 'under_review') then
    raise exception using errcode = '22023', message = 'this action is already under appeal';
  end if;

  -- One argument per decision. Re-filing after a decision would make the
  -- decision meaningless and hand a determined appellant an unbounded queue.
  if v_existing in ('granted', 'denied') then
    raise exception using errcode = '22023', message = 'this action has already been appealed';
  end if;

  perform private.enforce_appeal_rate_limit(v_actor_id);

  insert into public.moderation_appeals (audit_log_id, appellant_id, body)
  values (p_audit_log_id, v_actor_id, v_clean_body)
  returning moderation_appeals.id into v_new_appeal_id;

  -- The body is the member's own argument and stays on the row. The audit entry
  -- records that an appeal was filed against a specific earlier action.
  perform private.write_audit_log(
    v_actor_id,
    'appeal.created',
    'appeal',
    v_new_appeal_id,
    null,
    null,
    null,
    jsonb_build_object('audit_log_id', p_audit_log_id)
  );

  return query select v_new_appeal_id;
end;
$$;

create or replace function public.list_own_appeals()
returns table (
  appeal_id uuid,
  audit_log_id uuid,
  action text,
  body text,
  status public.appeal_status,
  decision text,
  decided_at timestamptz,
  created_at timestamptz
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
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    appeals.id,
    appeals.audit_log_id,
    logs.action,
    appeals.body,
    appeals.status,
    appeals.decision,
    appeals.decided_at,
    appeals.created_at
  from public.moderation_appeals appeals
  join public.audit_logs logs on logs.id = appeals.audit_log_id
  where appeals.appellant_id = v_actor_id
  order by appeals.created_at desc, appeals.id desc
  limit 100;
end;
$$;

-- ── The reviewer's side ────────────────────────────────────────────────────

create or replace function public.moderation_list_appeals(
  p_status public.appeal_status default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  appeal_id uuid,
  audit_log_id uuid,
  action text,
  appellant_id uuid,
  appellant_display_name text,
  status public.appeal_status,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1000
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  perform private.require_permission('moderation.hide');

  return query
  select
    appeals.id,
    appeals.audit_log_id,
    logs.action,
    appeals.appellant_id,
    appellant.display_name,
    appeals.status,
    appeals.created_at
  from public.moderation_appeals appeals
  join public.audit_logs logs on logs.id = appeals.audit_log_id
  left join public.profiles appellant on appellant.id = appeals.appellant_id
  where (p_status is null or appeals.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (appeals.created_at, appeals.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by appeals.created_at desc, appeals.id desc
  limit v_limit;
end;
$$;

create or replace function public.moderation_get_appeal(p_appeal_id uuid)
returns table (
  appeal_id uuid,
  audit_log_id uuid,
  action text,
  action_reason text,
  action_actor_id uuid,
  action_actor_display_name text,
  action_created_at timestamptz,
  appellant_id uuid,
  appellant_display_name text,
  body text,
  status public.appeal_status,
  decision text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_permission('moderation.hide');

  return query
  select
    appeals.id,
    appeals.audit_log_id,
    logs.action,
    logs.reason,
    logs.actor_id,
    actor.display_name,
    logs.created_at,
    appeals.appellant_id,
    appellant.display_name,
    appeals.body,
    appeals.status,
    appeals.decision,
    appeals.decided_by,
    appeals.decided_at,
    appeals.created_at
  from public.moderation_appeals appeals
  join public.audit_logs logs on logs.id = appeals.audit_log_id
  left join public.profiles actor on actor.id = logs.actor_id
  left join public.profiles appellant on appellant.id = appeals.appellant_id
  where appeals.id = p_appeal_id;
end;
$$;

-- Claiming, so two reviewers do not argue the same appeal. Compare-and-swap
-- against the status the caller was shown.
create or replace function public.moderation_claim_appeal(
  p_appeal_id uuid,
  p_expected_status public.appeal_status
)
returns table (appeal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_appeal public.moderation_appeals;
begin
  v_actor_id := private.require_permission('moderation.hide');

  select * into v_appeal
  from public.moderation_appeals
  where moderation_appeals.id = p_appeal_id
  for update;

  if v_appeal.id is null then
    raise exception using errcode = 'P0002', message = 'appeal not found';
  end if;

  if v_appeal.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'appeal changed since it was read';
  end if;

  if v_appeal.status <> 'open' then
    raise exception using errcode = '22023', message = 'only an open appeal can be claimed';
  end if;

  update public.moderation_appeals
  set status = 'under_review'
  where moderation_appeals.id = v_appeal.id;

  return query select v_appeal.id;
end;
$$;

-- Deciding. Granting an appeal does not itself restore anything: the reviewer
-- undoes the original action through the RPC that owns it, which writes its own
-- audit row. The appeal records the judgement; the action records the change.
create or replace function public.moderation_resolve_appeal(
  p_appeal_id uuid,
  p_expected_status public.appeal_status,
  p_status public.appeal_status,
  p_decision text
)
returns table (appeal_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_appeal public.moderation_appeals;
  v_clean_decision text;
  v_original_actor uuid;
begin
  v_actor_id := private.require_permission('moderation.hide');
  v_clean_decision := private.validated_reason(p_decision);

  if p_status not in ('granted', 'denied') then
    raise exception using
      errcode = '22023',
      message = 'an appeal can only be granted or denied';
  end if;

  select * into v_appeal
  from public.moderation_appeals
  where moderation_appeals.id = p_appeal_id
  for update;

  if v_appeal.id is null then
    raise exception using errcode = 'P0002', message = 'appeal not found';
  end if;

  if v_appeal.status <> p_expected_status then
    raise exception using errcode = '40001', message = 'appeal changed since it was read';
  end if;

  if v_appeal.status in ('granted', 'denied') then
    raise exception using errcode = '22023', message = 'this appeal is already decided';
  end if;

  -- Nobody reviews an argument against their own decision.
  select audit_logs.actor_id into v_original_actor
  from public.audit_logs where audit_logs.id = v_appeal.audit_log_id;

  if v_original_actor = v_actor_id then
    raise exception using
      errcode = '42501',
      message = 'the actor of an action cannot decide the appeal against it';
  end if;

  update public.moderation_appeals
  set status = p_status,
      decision = v_clean_decision,
      decided_by = v_actor_id,
      decided_at = now()
  where moderation_appeals.id = v_appeal.id;

  perform private.write_audit_log(
    v_actor_id,
    'appeal.decided',
    'appeal',
    v_appeal.id,
    v_clean_decision,
    jsonb_build_object('status', v_appeal.status),
    jsonb_build_object('status', p_status),
    jsonb_build_object('audit_log_id', v_appeal.audit_log_id)
  );

  return query select v_appeal.id;
end;
$$;

-- ── Retention ──────────────────────────────────────────────────────────────

-- What is purged, and what deliberately is not.
--
-- Purged 180 days after it closes: a resolved or dismissed report, and a
-- decided appeal. Both are working material — the argument is over, the record
-- that an action was taken lives in `audit_logs`, and keeping the reporter's
-- and appellant's own words indefinitely is the part that is hard to justify.
--
-- Never purged here: audit rows, and warnings. An audit row is the record that
-- something happened, and an account with a purged history is an account nobody
-- can explain. Content revisions are already bounded to the 50 most recent per
-- item by migration 0012, and disappear with their content.
--
-- Returns what it removed so a scheduled run can be read back from its log.
create or replace function private.purge_expired_moderation_evidence(
  p_retention interval default interval '180 days'
)
returns table (reports_removed integer, appeals_removed integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reports integer;
  v_appeals integer;
begin
  delete from public.content_reports
  where content_reports.status in ('resolved', 'dismissed')
    and content_reports.resolved_at < now() - p_retention;
  get diagnostics v_reports = row_count;

  delete from public.moderation_appeals
  where moderation_appeals.status in ('granted', 'denied')
    and moderation_appeals.decided_at < now() - p_retention;
  get diagnostics v_appeals = row_count;

  return query select v_reports, v_appeals;
end;
$$;

-- The schedule lives in the repository with the function it runs, so a restored
-- project is not one Dashboard click away from keeping evidence forever. Guarded
-- because `pg_cron` is not installed in every environment this replays in (a
-- disposable PostgreSQL used to run the contract suites, for one); where it is
-- absent, the function above is still callable by hand.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-expired-moderation-evidence',
      '30 3 * * *',
      $cron$select private.purge_expired_moderation_evidence();$cron$
    );
  end if;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function private.appealable_actions() from public, anon, authenticated;
revoke all on function private.audit_log_subject(uuid) from public, anon, authenticated;
revoke all on function private.enforce_appeal_rate_limit(uuid) from public, anon, authenticated;
revoke all on function private.purge_expired_moderation_evidence(interval)
  from public, anon, authenticated;

revoke all on function public.list_own_moderation_actions(integer)
  from public, anon, authenticated;
revoke all on function public.create_appeal(uuid, text) from public, anon, authenticated;
revoke all on function public.list_own_appeals() from public, anon, authenticated;
revoke all on function public.moderation_list_appeals(
  public.appeal_status, timestamptz, uuid, integer
) from public, anon, authenticated;
revoke all on function public.moderation_get_appeal(uuid) from public, anon, authenticated;
revoke all on function public.moderation_claim_appeal(uuid, public.appeal_status)
  from public, anon, authenticated;
revoke all on function public.moderation_resolve_appeal(
  uuid, public.appeal_status, public.appeal_status, text
) from public, anon, authenticated;

-- Every path here requires an account and re-checks its own rule. Nothing is
-- reachable anonymously, and nothing is reachable from the Data API tables.
grant execute on function public.list_own_moderation_actions(integer) to authenticated;
grant execute on function public.create_appeal(uuid, text) to authenticated;
grant execute on function public.list_own_appeals() to authenticated;
grant execute on function public.moderation_list_appeals(
  public.appeal_status, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.moderation_get_appeal(uuid) to authenticated;
grant execute on function public.moderation_claim_appeal(uuid, public.appeal_status)
  to authenticated;
grant execute on function public.moderation_resolve_appeal(
  uuid, public.appeal_status, public.appeal_status, text
) to authenticated;

comment on table public.moderation_appeals is
  'A member''s argument against one recorded moderation action, linked to its audit row. Filing survives suspension and banning; reading is limited to the appellant and moderation.hide.';
comment on function public.create_appeal(uuid, text) is
  'File an appeal against an appealable action taken against you. One per action, rate limited, and allowed while suspended or banned.';
comment on function private.purge_expired_moderation_evidence(interval) is
  'Retention: removes closed reports and decided appeals past the retention window. Audit rows are deliberately never purged.';
