-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Reports and the moderation queue
--
-- A report is a member's claim about a post, a comment or a profile. It is not
-- a moderation action: nothing about the reported content changes when one is
-- filed. Acting on the claim is migration 0010's contract.
--
-- Like every content table, `content_reports` has RLS enabled with no policies
-- and no grants, so it is unreachable from the Data API. All access is through
-- the SECURITY DEFINER RPCs at the bottom of this file, and a report is
-- readable only by someone holding `moderation.hide`. A reporter cannot read
-- back the queue, by design: knowing whether a report was seen is exactly the
-- signal an abusive reporter uses to calibrate.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────────────

create type public.report_reason as enum (
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'sexual_content',
  'misinformation',
  'impersonation',
  'off_topic',
  'other'
);

-- 'under_review' is a moderator claiming the report so two moderators do not
-- work the same queue item; it is not a state the reporter ever sees.
create type public.report_status as enum (
  'open',
  'under_review',
  'resolved',
  'dismissed'
);

-- ── Table ──────────────────────────────────────────────────────────────────

create table public.content_reports (
  id uuid primary key default extensions.uuid_generate_v4(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text
    constraint content_reports_details_length
    check (details is null or char_length(details) between 1 and 1000),
  status public.report_status not null default 'open',
  -- What the moderator concluded, written when the report leaves the queue.
  resolution text
    constraint content_reports_resolution_length
    check (resolution is null or char_length(resolution) between 3 and 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_reports_single_target check (
    (post_id is not null)::integer
      + (comment_id is not null)::integer
      + (profile_id is not null)::integer = 1
  ),
  -- A closed report always says who closed it and when; an open one never does.
  -- `resolved_by` may later become null if that moderator's profile is deleted,
  -- so the timestamp, not the actor, is what the constraint keys on.
  constraint content_reports_resolution_matches_status check (
    (status in ('resolved', 'dismissed')) = (resolved_at is not null)
  )
);

-- The queue is read newest-first with a keyset cursor, filtered by status.
create index content_reports_queue_idx
  on public.content_reports (status, created_at desc, id desc);
create index content_reports_reporter_idx
  on public.content_reports (reporter_id, created_at desc);
create index content_reports_post_idx
  on public.content_reports (post_id) where post_id is not null;
create index content_reports_comment_idx
  on public.content_reports (comment_id) where comment_id is not null;
create index content_reports_profile_idx
  on public.content_reports (profile_id) where profile_id is not null;

-- One live report per reporter per target. Filing again after a moderator has
-- closed the first one is allowed — the content may have changed since — but
-- piling onto an unresolved one is not.
create unique index content_reports_one_open_per_post_idx
  on public.content_reports (reporter_id, post_id)
  where post_id is not null and status in ('open', 'under_review');
create unique index content_reports_one_open_per_comment_idx
  on public.content_reports (reporter_id, comment_id)
  where comment_id is not null and status in ('open', 'under_review');
create unique index content_reports_one_open_per_profile_idx
  on public.content_reports (reporter_id, profile_id)
  where profile_id is not null and status in ('open', 'under_review');

create trigger content_reports_set_updated_at
  before update on public.content_reports
  for each row execute function public.update_updated_at();

alter table public.content_reports enable row level security;

-- ── Internal helpers ───────────────────────────────────────────────────────

-- Counted from the reports themselves rather than a separate hit log, so the
-- limit cannot drift from what was actually filed.
create or replace function private.enforce_report_rate_limit(p_reporter_id uuid)
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
  from public.content_reports
  where content_reports.reporter_id = p_reporter_id
    and content_reports.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception using
      errcode = '53400',
      message = 'report rate limit reached, try again later';
  end if;
end;
$$;

-- True when the caller may work the report queue.
create or replace function private.caller_reviews_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.user_has_permission(auth.uid(), 'moderation.hide');
$$;

-- ── Filing a report ────────────────────────────────────────────────────────

create or replace function public.create_report(
  p_reason public.report_reason,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_profile_id uuid default null,
  p_details text default null
)
returns table (report_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_target_count integer;
  v_target_author uuid;
  v_clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_new_report_id uuid;
begin
  v_actor_id := private.require_permission('report.create');

  v_target_count := (p_post_id is not null)::integer
    + (p_comment_id is not null)::integer
    + (p_profile_id is not null)::integer;

  if v_target_count <> 1 then
    raise exception using errcode = '22023', message = 'report exactly one target';
  end if;

  if v_clean_details is not null and char_length(v_clean_details) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'details must contain at most 1000 characters';
  end if;

  -- The target is resolved through the same visibility rules the reader used,
  -- so a report cannot be used to probe for content the caller cannot see: an
  -- invisible target is reported as missing, not as forbidden.
  if p_post_id is not null then
    if not private.post_is_visible_to_caller(p_post_id) then
      raise exception using errcode = 'P0002', message = 'post not found';
    end if;

    select posts.author_id into v_target_author
    from public.posts where posts.id = p_post_id;
  elsif p_comment_id is not null then
    select comments.author_id into v_target_author
    from public.comments
    where comments.id = p_comment_id
      and comments.status = 'published'
      and private.post_is_visible_to_caller(comments.post_id);

    if v_target_author is null then
      raise exception using errcode = 'P0002', message = 'comment not found';
    end if;
  else
    select profiles.id into v_target_author
    from public.profiles where profiles.id = p_profile_id;

    if v_target_author is null then
      raise exception using errcode = 'P0002', message = 'profile not found';
    end if;
  end if;

  if v_target_author = v_actor_id then
    raise exception using errcode = '22023', message = 'cannot report your own content';
  end if;

  perform private.enforce_report_rate_limit(v_actor_id);

  insert into public.content_reports (
    reporter_id, post_id, comment_id, profile_id, reason, details
  )
  values (v_actor_id, p_post_id, p_comment_id, p_profile_id, p_reason, v_clean_details)
  returning content_reports.id into v_new_report_id;

  return query select v_new_report_id;
end;
$$;

-- ── Working the queue ──────────────────────────────────────────────────────

-- Keyset pagination over (created_at desc, id desc), matching every other list
-- RPC. `p_status` null means every state, which is what an audit view wants.
create or replace function public.moderation_list_reports(
  p_status public.report_status default 'open',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  reason public.report_reason,
  details text,
  status public.report_status,
  reporter_id uuid,
  reporter_display_name text,
  target_author_id uuid,
  target_author_display_name text,
  target_excerpt text,
  open_report_count integer,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
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
  if not private.caller_reviews_reports() then
    raise exception using errcode = '42501', message = 'cannot review reports';
  end if;

  return query
  select
    r.id,
    case
      when r.post_id is not null then 'post'
      when r.comment_id is not null then 'comment'
      else 'profile'
    end,
    coalesce(r.post_id, r.comment_id, r.profile_id),
    r.reason,
    r.details,
    r.status,
    r.reporter_id,
    reporter.display_name,
    target_author.id,
    target_author.display_name,
    -- Enough of the target to triage without opening it. Deliberately short:
    -- the queue is a list, and the full body is one click away.
    left(coalesce(p.title, c.body, target_author.display_name), 160),
    -- How many other live reports name the same target, so a brigaded item
    -- surfaces without a moderator opening every row.
    (
      select count(*)::integer
      from public.content_reports peer
      where peer.status in ('open', 'under_review')
        and (
          (r.post_id is not null and peer.post_id = r.post_id)
          or (r.comment_id is not null and peer.comment_id = r.comment_id)
          or (r.profile_id is not null and peer.profile_id = r.profile_id)
        )
    ),
    r.resolution,
    r.resolved_by,
    r.resolved_at,
    r.created_at
  from public.content_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.profiles target_author
    on target_author.id = coalesce(p.author_id, c.author_id, r.profile_id)
  where (p_status is null or r.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit v_limit;
end;
$$;

create or replace function public.moderation_get_report(p_report_id uuid)
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  reason public.report_reason,
  details text,
  status public.report_status,
  reporter_id uuid,
  reporter_display_name text,
  target_author_id uuid,
  target_author_display_name text,
  target_body text,
  target_status text,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
-- Not `rows 1`: the planner hint makes type generation emit a scalar instead
-- of a row set, the same trap migration 0002 documents.
rows 1000
as $$
begin
  if not private.caller_reviews_reports() then
    raise exception using errcode = '42501', message = 'cannot review reports';
  end if;

  return query
  select
    r.id,
    case
      when r.post_id is not null then 'post'
      when r.comment_id is not null then 'comment'
      else 'profile'
    end,
    coalesce(r.post_id, r.comment_id, r.profile_id),
    r.reason,
    r.details,
    r.status,
    r.reporter_id,
    reporter.display_name,
    target_author.id,
    target_author.display_name,
    -- A moderator needs the evidence even once the content is hidden; that is
    -- the point of hiding rather than deleting.
    coalesce(p.body, c.body),
    coalesce(p.status::text, c.status::text),
    r.resolution,
    r.resolved_by,
    r.resolved_at,
    r.created_at
  from public.content_reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.profiles target_author
    on target_author.id = coalesce(p.author_id, c.author_id, r.profile_id)
  where r.id = p_report_id;
end;
$$;

-- Claiming, resolving and dismissing all move the same column, so they are one
-- compare-and-swap RPC: two moderators on a stale queue cannot both act.
create or replace function public.moderation_set_report_status(
  p_report_id uuid,
  p_expected_status public.report_status,
  p_status public.report_status,
  p_resolution text default null
)
returns table (report_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_report public.content_reports;
  v_clean_resolution text;
  v_closing boolean := p_status in ('resolved', 'dismissed');
begin
  v_actor_id := private.require_permission('moderation.hide');

  -- Closing a report is a decision that must survive the moderator who made
  -- it, so it carries a reason; claiming one does not.
  if v_closing then
    v_clean_resolution := private.validated_reason(p_resolution);
  elsif nullif(btrim(coalesce(p_resolution, '')), '') is not null then
    raise exception using
      errcode = '22023',
      message = 'a resolution belongs only to a resolved or dismissed report';
  end if;

  select * into v_report
  from public.content_reports
  where content_reports.id = p_report_id
  for update;

  if v_report.id is null then
    raise exception using errcode = 'P0002', message = 'report not found';
  end if;

  if v_report.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'report status changed since it was read';
  end if;

  if v_report.status = p_status then
    raise exception using errcode = '22023', message = 'report already has that status';
  end if;

  -- A closed report stays closed. Reopening would erase who decided what and
  -- when; the reporter files again instead, which leaves both records.
  if v_report.status in ('resolved', 'dismissed') then
    raise exception using errcode = '22023', message = 'a closed report cannot be reopened';
  end if;

  update public.content_reports
  set
    status = p_status,
    resolution = case when v_closing then v_clean_resolution else null end,
    resolved_by = case when v_closing then v_actor_id else null end,
    resolved_at = case when v_closing then now() else null end
  where content_reports.id = v_report.id;

  perform private.write_audit_log(
    v_actor_id,
    'report.status',
    'report',
    v_report.id,
    v_clean_resolution,
    jsonb_build_object('status', v_report.status),
    jsonb_build_object('status', p_status),
    jsonb_build_object(
      'target_type',
      case
        when v_report.post_id is not null then 'post'
        when v_report.comment_id is not null then 'comment'
        else 'profile'
      end,
      'target_id',
      coalesce(v_report.post_id, v_report.comment_id, v_report.profile_id)
    )
  );

  return query select v_report.id;
end;
$$;

-- ── Function exposure ──────────────────────────────────────────────────────

revoke all on function private.enforce_report_rate_limit(uuid)
  from public, anon, authenticated;
revoke all on function private.caller_reviews_reports()
  from public, anon, authenticated;

revoke all on function public.create_report(
  public.report_reason, uuid, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.moderation_list_reports(
  public.report_status, timestamptz, uuid, integer
) from public, anon, authenticated;
revoke all on function public.moderation_get_report(uuid)
  from public, anon, authenticated;
revoke all on function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
) from public, anon, authenticated;

-- Reporting requires an account; reading the queue additionally requires
-- `moderation.hide`, which the RPCs re-check.
grant execute on function public.create_report(
  public.report_reason, uuid, uuid, uuid, text
) to authenticated;
grant execute on function public.moderation_list_reports(
  public.report_status, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.moderation_get_report(uuid) to authenticated;
grant execute on function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
) to authenticated;

comment on table public.content_reports is
  'Member claims about a post, comment or profile. Filing one changes nothing about the target; acting on it is a separate moderation action.';
comment on function public.moderation_list_reports(
  public.report_status, timestamptz, uuid, integer
) is
  'Report queue, newest first, keyset paginated. Requires moderation.hide.';
comment on function public.moderation_set_report_status(
  uuid, public.report_status, public.report_status, text
) is
  'Claim, resolve or dismiss a report. Compare-and-swap on status; closing requires a reason and is audited.';
