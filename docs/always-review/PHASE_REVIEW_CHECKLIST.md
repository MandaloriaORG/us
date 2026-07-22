# Phase Review Checklist

## Before starting a phase

- [ ] Read the corresponding phase in `docs/dev/phases/`.
- [ ] Read `docs/dev/MASTER_CHECKLIST.md`.
- [ ] Read `docs/dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md`.
- [ ] Read `docs/dev/SECURITY_PRIVACY_PERFORMANCE_GUARDRAILS.md`.
- [ ] Read `docs/dev/SYSTEM_SIMPLICITY_AND_PERFORMANCE.md`.
- [ ] Read `docs/dev/CORE_SYSTEM_RULES.md`.
- [ ] Read `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md` if the phase touches Supabase or infrastructure.
- [ ] Confirm vocabulary in `CONTEXT.md`.
- [ ] Confirm that pending decisions for that phase are resolved.

## During the phase

- [ ] Mark implemented checks.
- [ ] Add new checks if a new feature appears.
- [ ] Keep permissions centralized.
- [ ] Keep RLS updated.
- [ ] Keep admin/moderation updated.
- [ ] Keep logs for sensitive actions.
- [ ] Review data exposed in responses.
- [ ] Review query performance.
- [ ] Review states, transitions and reversibility.
- [ ] Review outbox/idempotency of side effects.
- [ ] Confirm that Supabase changes are captured in reproducible migrations/configuration.

## Before closing a phase

- [ ] All critical checks are complete.
- [ ] No routes left unprotected.
- [ ] No tables exposed without RLS.
- [ ] No sensitive actions without audit log.
- [ ] No endpoints returning excess data.
- [ ] No private content is indexable.
- [ ] No uploads left without validation.
- [ ] No rate limits pending for abusable actions.
- [ ] Tested as anon, user, mod and admin.
- [ ] Any accepted technical debt is documented.
- [ ] Critical routes measured against their budget.
- [ ] An empty database can apply all migrations from the phase.
