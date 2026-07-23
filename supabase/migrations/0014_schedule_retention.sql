-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — Actually run the retention job
--
-- Migration 0013 wrote `private.purge_expired_moderation_evidence()` and tried
-- to schedule it, but the guard found no `pg_cron` and skipped: the policy
-- existed and nothing ran it, which is the worst of both — a documented promise
-- with no mechanism behind it.
--
-- This installs the extension where the project allows it, then schedules the
-- job. Both steps are guarded: a disposable PostgreSQL used to replay the
-- migrations for the contract suites cannot install `pg_cron`, and that must not
-- fail the replay. Where the schedule cannot exist, the function is still
-- callable by hand and the retention window is still enforced by whoever calls
-- it — this file is about automation, not about the policy.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension pg_cron;
    exception when others then
      raise notice 'pg_cron is unavailable here (%), the retention job stays manual', sqlerrm;
    end;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- `cron.schedule` upserts by name, so replaying this migration is safe.
    perform cron.schedule(
      'purge-expired-moderation-evidence',
      '30 3 * * *',
      $cron$select private.purge_expired_moderation_evidence();$cron$
    );
  else
    raise notice 'no pg_cron: private.purge_expired_moderation_evidence() must be run manually';
  end if;
end;
$$;
