# Core System Rules

## Purpose

This document establishes the structural rules that must be maintained while building Mandaloria. They are design criteria and mandatory checks, not optional optimizations.

## 1. A complete community cycle

Conversation must be able to produce stable knowledge:

```text
Plazas / Holochat / Houses -> proposal -> review -> Codex Libre
```

- [ ] Implement the flow defined in `docs/KNOWLEDGE_LIFECYCLE.md`.
- [ ] Maintain links in both directions between source and article.
- [ ] Acknowledge contributions without turning recognition into permissions.
- [ ] Avoid publishing data from private spaces.

## 2. Five system families

Each feature should primarily belong to one of these families:

- identity: members, Houses, Council;
- space: Plazas, channels, Codex sections;
- content: posts, comments, messages, articles;
- relationship: friendship, membership, following, blocking;
- event: reaction, edit, report, sanction, notification.

- [ ] Name the primary family before designing a feature.
- [ ] Do not create a new entity if an existing one correctly expresses the concept.
- [ ] Do not force distinct concepts into a generic "things" table.
- [ ] Maintain common contracts without hiding type-specific rules.

## 3. One authority for permissions

Mental rule:

```text
can(actor, action, resource, context)
```

- [ ] Every sensitive action has an explicit name and permission.
- [ ] The server validates the action even if the UI hides the button.
- [ ] RLS additionally protects read or write in Postgres.
- [ ] Deny is the default behavior.
- [ ] Role, rank, badge, reputation and House are not confused.
- [ ] Tests attempt to execute the action without using the UI.

## 4. States and transitions

- [ ] Model lifecycles with a canonical state and valid transitions.
- [ ] Avoid contradictory boolean combinations.
- [ ] Define actor, permission, precondition and result for each transition.
- [ ] Use constraints when the database can protect the invariant.
- [ ] Log sensitive transitions.
- [ ] Make reversibility or irreversibility explicit.

## 5. Protected configuration

Values editable from the Council cannot weaken fundamental limits.

- [ ] Each setting has a type, default value, minimum, maximum and internal description.
- [ ] Changes are validated server-side.
- [ ] Critical settings require confirmation and specific permission.
- [ ] Save author, date, previous value and new value.
- [ ] Version configurations and allow restoring a valid version.
- [ ] Prevent an admin from accidentally removing the last emergency access.
- [ ] Maintain non-editable absolute limits from the interface.
- [ ] Rate limit changes do not affect already accepted requests.

## 6. Performance budgets

Initial budgets are design goals and must be measured under reproducible conditions. They are adjusted with evidence, not intuition.

- [ ] Initial feed: maximum 3 main database round trips.
- [ ] Open a post with first page of comments: maximum 3 main round trips.
- [ ] Create comment: one domain transactional operation.
- [ ] React: one idempotent domain operation.
- [ ] No list grows without cursor pagination or a defined limit.
- [ ] No public API uses `select *`.
- [ ] Avoid one query per list item.
- [ ] Define payload, query and latency budgets for each critical path.
- [ ] Log performance regressions in CI or phase review when infrastructure exists.

## 7. Exact source and fast views

- [ ] Reactions, memberships and contributions have exact records as source of truth.
- [ ] Denormalized counters only speed up reads.
- [ ] Update source and counter atomically or via a recoverable event.
- [ ] Have reconciliation to detect and repair drift.
- [ ] Do not use the aggregate counter as proof of authorization or ownership.

## 8. Reliable events

When an action requires side effects, the main action and its event are saved together.

```text
domain transaction -> outbox_events -> idempotent workers
```

- [ ] Record the event in the same transaction as the main change.
- [ ] Process notifications, search, reputation and statistics outside the critical path when applicable.
- [ ] Each consumer is idempotent.
- [ ] Retries use limit and backoff.
- [ ] Failed events can be inspected and reprocessed.
- [ ] A notification failure does not revert already correctly created content.
- [ ] The event payload contains identifiers and minimal data, not unnecessary private copies.

## 9. Structural privacy

- [ ] Separate public, private and internal data in queries and clear contracts.
- [ ] Store only what is necessary.
- [ ] Do not render private data only to hide it with CSS.
- [ ] Private files use temporary URLs.
- [ ] Images lose metadata by default.
- [ ] Search, feeds, sitemap, previews, exports and realtime apply the same visibility.
- [ ] Logs avoid tokens, secrets and unnecessary private content.
- [ ] Data export and deletion are designed with each feature that stores personal data.

## 10. Reversible moderation

Recommended cycle:

```text
visible -> hidden -> quarantined -> restored
                            \-> permanently_deleted
```

- [ ] Hiding removes content from public views without destroying evidence.
- [ ] Quarantine restricts content and attachments during an investigation.
- [ ] Restoring returns content to the previous allowed state.
- [ ] Permanent deletion requires higher permission, reason and confirmation.
- [ ] Every action saves the responsible party, reason, date and scope.
- [ ] Appeals and reviews can be linked to the original action.
- [ ] Evidence copies have restricted access and a retention policy.

## 11. Houses with responsibility

- [ ] Each House can declare a mission and Codex areas it helps maintain.
- [ ] It can organize research expeditions with a goal and status.
- [ ] It can propose knowledge to the Codex through the common flow.
- [ ] It has internal spaces and channels with contextual permissions.
- [ ] Its sensitive internal decisions are audited.
- [ ] Verifiable badges show issuer, date, reason, evidence and status.
- [ ] A badge can be revoked without deleting its internal history.
- [ ] A House cannot turn cultural responsibility into implicit global permissions.

## 12. Deliberately small architecture

Initial core:

- Next.js;
- Supabase Auth;
- PostgreSQL;
- Supabase Storage;
- RLS;
- outbox and small jobs when necessary.

- [ ] Do not introduce microservices without a demonstrable boundary and load.
- [ ] Do not execute arbitrary plugins on the server.
- [ ] Customize via validated configuration, themes and allowed components.
- [ ] Prefer native Postgres and Supabase capabilities before adding infrastructure.
- [ ] Each new dependency must justify security, maintenance and weight.
- [ ] The architecture must be explainable in full on one page.
- [ ] Every Supabase change complies with `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md`.

## Closing rule

A feature is not finished until verifying:

- [ ] domain and canonical name;
- [ ] data and source of truth;
- [ ] states and transitions;
- [ ] permissions and RLS;
- [ ] privacy;
- [ ] moderation and reversibility;
- [ ] audit;
- [ ] performance and limits;
- [ ] side effects and idempotency;
- [ ] interface states and tests.
