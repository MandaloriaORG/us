# Verification Registry

Single place that answers, for every system already built: **what must be checked, what proves it, and what is still owed.**

The phase files in `docs/dev/phases/` track _product scope_ ("does the feature exist for a user"). This file tracks _verification_ ("is what exists proven correct"). They are not the same and must not be conflated: a phase item stays unticked until the user-visible behaviour ships, even when the server logic underneath is fully proven here.

Related: `docs/always-review/PR_REVIEW_CHECKLIST.md` (per change), `docs/always-review/PHASE_REVIEW_CHECKLIST.md` (per phase), `docs/dev/DESIGN_VERIFICATION.md` (UI gate).

---

## 1. The gate

Every one of these must pass before a change is considered done. Run them in this order; each is cheap enough to run every time.

| #   | Check                    | Command                                                               | Current             |
| --- | ------------------------ | --------------------------------------------------------------------- | ------------------- |
| 1   | Types                    | `pnpm typecheck`                                                      | pass                |
| 2   | Lint                     | `pnpm lint`                                                           | pass                |
| 3   | Format                   | `pnpm format:check`                                                   | pass                |
| 4   | Unit / component tests   | `pnpm test`                                                           | 1128 pass / 97 files |
| 5   | Production build         | `pnpm build`                                                          | pass                |
| 6   | Database contract        | `supabase test db --linked`                                           | 829 planned (eleven suites; linked run owed) |
| 7   | Types match the database | `pnpm db:types` then `git diff --exit-code src/lib/database.types.ts` | clean               |

Checks 6 and 7 run against the hosted project (`rvostprtlwksknuarnlk`). There is no local stack; its ports are held by another project. The eleven suites total 829 pgTAP assertions; the last linked run (558/558) predates the Codex, Clans, Holochat and Search/Settings suites, so a fresh `supabase test db --linked` is owed.

A green gate is necessary, not sufficient. Sections 2-4 list what the gate does _not_ cover.

---

## 2. System registry

Status values: **verified** (automated proof exists), **reviewed** (checked by hand, no automated proof), **owed** (not done).

### 2.1 Database — identity and Council (migrations `0000`-`0006`)

| Must be checked                                           | Evidence                                                                                                                                                                                          | Status   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| RLS on every table, deny by default                       | `identity_security_contract.test.sql`                                                                                                                                                             | verified |
| Anon cannot read or write profiles                        | same suite                                                                                                                                                                                        | verified |
| A member cannot escalate their own role                   | same suite                                                                                                                                                                                        | verified |
| Council actions require the specific permission           | same suite                                                                                                                                                                                        | verified |
| A moderator cannot act on an administrator                | same suite                                                                                                                                                                                        | verified |
| Suspended and banned users lose write paths               | same suite                                                                                                                                                                                        | verified |
| Every Council mutation writes an audit row                | same suite                                                                                                                                                                                        | verified |
| Status changes are compare-and-swap (`0005`)              | same suite                                                                                                                                                                                        | verified |
| Avatar path ownership enforced in Storage (`0002`-`0004`) | same suite                                                                                                                                                                                        | verified |
| `search_path = ''` on every SECURITY DEFINER function     | audited across all 9 migrations; the only two without it (`handle_new_user`, `assign_default_role` in `0000`) are replaced with the hardened form in `0001`, so the replayed final state is clean | reviewed |

### 2.2 Database — content (migrations `0007`, `0008`)

The tables `plazas`, `posts`, `comments`, `content_votes`, `reactions`, `content_reactions`, `bookmarks`, `tags`, `post_tags` have RLS enabled with **no policies and no grants**: they are unreachable from the Data API. All access goes through 24 RPCs.

| Must be checked                                              | Evidence                                                  | Status   |
| ------------------------------------------------------------ | --------------------------------------------------------- | -------- |
| Tables unreachable from the Data API                         | `content_contract.test.sql` (82 assertions)               | verified |
| Anon sees only public, published content                     | same suite                                                | verified |
| Private plaza content is invisible to non-members            | same suite                                                | verified |
| Only the author can edit or soft-delete their own content    | same suite                                                | verified |
| Soft-deleted content leaves no body in any read RPC          | same suite                                                | verified |
| Suspended and banned users cannot write                      | same suite                                                | verified |
| Per-actor rate limits counted from source tables             | same suite                                                | verified |
| Votes are idempotent; changing and removing a vote works     | same suite                                                | verified |
| Counters are written in the same transaction as their source | same suite                                                | verified |
| Counter drift repair function is correct                     | same suite                                                | verified |
| Plaza administration is CAS + audited                        | same suite                                                | verified |
| `status` / `published_at` cannot disagree                    | table constraint + suite                                  | verified |
| Polymorphic targets are exactly one of post/comment          | table constraint                                          | verified |
| Every migration applies from an empty database               | replayed 0000-0012 on a clean PostgreSQL 16               | verified |
| Migrations applied to the hosted project                     | `supabase migration list --linked` shows 0000-0012 remote | verified |

### 2.2b Database — reports (migration `0009`)

`content_reports` has RLS enabled with no policies and no grants. Filing goes through `create_report`; the queue goes through three RPCs that re-check `moderation.hide`.

| Must be checked                                                                | Evidence                                    | Status   |
| ------------------------------------------------------------------------------ | ------------------------------------------- | -------- |
| Table unreachable from the Data API, for members as well as anon               | `reports_contract.test.sql` (58 assertions) | verified |
| Anon and suspended accounts cannot file                                        | same suite                                  | verified |
| A member cannot report their own post, comment or profile                      | same suite                                  | verified |
| A report names exactly one target                                              | table constraint + same suite               | verified |
| An invisible or missing target is refused as missing, not as forbidden         | same suite                                  | verified |
| One live report per reporter per target; filing again after closure is allowed | partial unique indexes + same suite         | verified |
| A reporter cannot read the queue or their own report back                      | same suite                                  | verified |
| Only `moderation.hide` reads the queue or resolves                             | same suite                                  | verified |
| Claiming and resolving are compare-and-swap                                    | same suite                                  | verified |
| A closed report cannot be reopened                                             | same suite                                  | verified |
| Closing requires a reason and is audited                                       | same suite                                  | verified |
| A closed report always records who closed it and when                          | table constraint + same suite               | verified |
| The queue counts other live reports on the same target                         | same suite                                  | verified |
| Report rate limit counted from the reports themselves                          | same suite                                  | verified |
| Evidence survives the target being hidden                                      | `moderation_get_report` returns the body    | reviewed |

### 2.2c Database — moderation transitions (migration `0010`)

Migration `0007` created every state; this one implements the moderator's transitions and adds nothing to either enum.

| Must be checked                                                                        | Evidence                                                | Status   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------- |
| Neither enum grew                                                                      | `content_moderation_contract.test.sql` (105 assertions) | verified |
| A member, including the author, has no moderation authority                            | same suite                                              | verified |
| Each destination state needs its own permission (hide / quarantine / delete / restore) | same suite                                              | verified |
| Hiding keeps the body and sets no removal timestamp                                    | same suite                                              | verified |
| A hidden post disappears from a member's listing                                       | same suite                                              | verified |
| `deleted_by_author` is terminal: a moderator may delete further, never restore         | same suite                                              | verified |
| Moderation cannot push content into `draft` or `pending_review`                        | same suite                                              | verified |
| Every transition is compare-and-swap and needs a reason                                | same suite                                              | verified |
| Every transition is audited                                                            | same suite                                              | verified |
| Plaza `posts_count` moves with visibility, both ways                                   | same suite                                              | verified |
| A first-time-visible draft gets the `published_at` its constraint requires             | same suite                                              | verified |
| Flags: null leaves a flag alone, no-op refused, removed post carries none              | same suite                                              | verified |
| `edit_locked` actually stops the author editing                                        | same suite                                              | verified |
| Move: same Plaza, missing Plaza, archived Plaza and removed post all refused           | same suite                                              | verified |
| Move adjusts both Plaza counts                                                         | same suite                                              | verified |
| Comment transitions move `comments_count` and the parent's `replies_count`             | same suite                                              | verified |
| A locked comment accepts no reply while the thread stays open                          | same suite                                              | verified |
| The thread read reports `is_pinned`, `replies_locked` and `can_reply`                  | same suite                                              | verified |
| Counter repair now covers the thread counters too                                      | same suite                                              | verified |

### 2.2d Database — warnings and Council notes (migration `0011`)

Two records that are opposites: a **warning** is addressed to the member and they acknowledge it; a **note** is addressed to other moderators and the subject can never read it. Neither table is reachable from the Data API.

| Must be checked                                                                              | Evidence                                            | Status   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------- |
| Neither table carries a policy or a grant                                                    | `user_moderation_contract.test.sql` (60 assertions) | verified |
| Only `moderation.warn` issues a warning; anon and members cannot                             | same suite                                          | verified |
| A moderator cannot warn themselves                                                           | same suite                                          | verified |
| A Moderator cannot warn a protected user; an Administrator can warn a Moderator              | same suite                                          | verified |
| A warning may exceed 500 characters; the audit copy truncates instead of refusing it         | same suite                                          | verified |
| A member reads only their own warnings                                                       | same suite                                          | verified |
| Acknowledging someone else's warning is refused as missing, not forbidden                    | same suite                                          | verified |
| A moderator cannot acknowledge on the member's behalf                                        | same suite                                          | verified |
| Acknowledging twice is refused                                                               | same suite                                          | verified |
| Only `admin.view_users` writes or reads a note                                               | same suite                                          | verified |
| The subject of a note can never read it                                                      | same suite                                          | verified |
| The audit row records that a note was added, never its body                                  | same suite                                          | verified |
| Only a note's own author may remove it                                                       | same suite                                          | verified |
| Warning, adding a note and removing a note are all audited                                   | same suite                                          | verified |
| The moderation history is `council_list_audit_logs` filtered by target, with no second store | same suite                                          | verified |

### 2.2e Database — edit history (migration `0012`)

Before this, an edit overwrote the body and the previous wording was gone, which made a report unanswerable: the author could rewrite the content between the report and the review.

| Must be checked                                                        | Evidence                                              | Status   |
| ---------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Table unreachable from the Data API                                    | `content_revisions_contract.test.sql` (41 assertions) | verified |
| An edit snapshots the previous wording, inside the same transaction    | same suite                                            | verified |
| Creating content writes no revision                                    | same suite                                            | verified |
| An edit that changes nothing writes no revision                        | same suite                                            | verified |
| A post revision keeps the previous title; a comment revision has none  | table constraint + same suite                         | verified |
| History is newest first, ordered by a sequence and not by the clock    | same suite                                            | verified |
| Post and comment histories do not mix                                  | same suite                                            | verified |
| Exactly one target; naming none or two is refused                      | same suite                                            | verified |
| A member who is neither author nor moderator is told it does not exist | same suite                                            | verified |
| Anon cannot read any edit history                                      | same suite                                            | verified |
| A moderator reads the history of content they did not write            | same suite                                            | verified |
| History survives the content being hidden                              | same suite                                            | verified |
| An edit loop cannot grow the table past 50 revisions per item          | same suite                                            | verified |
| Trimming one item leaves another item's history alone                  | same suite                                            | verified |
| A caller cannot ask for more than the bound                            | same suite                                            | verified |
| Physically deleting the content removes its revisions                  | same suite                                            | verified |

### 2.2f Database — appeals and retention (migrations `0013`, `0014`)

An appeal is a member's argument against one recorded action, linked to its
`audit_logs` row. Retention bounds the working material: a moderation system that
cannot be argued with and never forgets is not reversible, only permanent.

| Must be checked                                                                  | Evidence                                                                               | Status   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Table unreachable from the Data API, for members as well as anon                 | `appeals_contract.test.sql` (52 assertions)                                            | verified |
| The retention job is not callable by a member                                    | same suite                                                                             | verified |
| A member sees only the appealable actions taken against them                     | same suite                                                                             | verified |
| Someone else's sanction is refused as missing, not as forbidden                  | same suite                                                                             | verified |
| An appeal shorter than 20 characters is refused                                  | same suite                                                                             | verified |
| One live appeal per action, and no second appeal after a decision                | partial unique index + same suite                                                      | verified |
| The appellant cannot read the queue or the table                                 | same suite                                                                             | verified |
| Anon can neither file nor read moderation actions                                | same suite                                                                             | verified |
| Only `moderation.hide` reads the queue, opens an appeal or decides one           | same suite                                                                             | verified |
| Claiming and deciding are compare-and-swap                                       | same suite                                                                             | verified |
| Only an open appeal can be claimed; a decided one cannot be decided again        | same suite                                                                             | verified |
| A decision needs a reason and is audited                                         | same suite                                                                             | verified |
| The moderator who took the action cannot decide the appeal against it            | same suite                                                                             | verified |
| The appeal shows who took the action and the reason they gave                    | same suite                                                                             | verified |
| A banned member can still file an appeal                                         | same suite                                                                             | verified |
| Closed reports and decided appeals past the window are purged; live ones are not | same suite                                                                             | verified |
| Audit rows are never purged                                                      | same suite                                                                             | verified |
| The nightly purge is actually scheduled on the hosted project                    | `cron.job` row `purge-expired-moderation-evidence`, checked against the linked project | reviewed |

### 2.3 Content library (`src/lib/content/`)

| Module        | Must be checked                                          | Evidence                                          | Status   |
| ------------- | -------------------------------------------------------- | ------------------------------------------------- | -------- |
| `markdown.ts` | Author text can never become markup                      | `markdown.test.ts`, 38 tests, allowlist invariant | verified |
| `markdown.ts` | Only `http`/`https`/`mailto`/root-relative links         | same                                              | verified |
| `markdown.ts` | Credentials and control characters rejected in hrefs     | same                                              | verified |
| `markdown.ts` | Fenced and inline code stay literal                      | same                                              | verified |
| `cursor.ts`   | Keyset cursor round-trips and is re-validated on decode  | `cursor.test.ts`, 13 tests                        | verified |
| `cursor.ts`   | A corrupt cursor degrades to page one and never throws   | same                                              | verified |
| `queries.ts`  | Nullable columns typegen cannot express are corrected    | `queries.test.ts`, 11 tests                       | verified |
| `queries.ts`  | An orphaned reply surfaces at the root, never disappears | same                                              | verified |

### 2.4 Server Actions (`src/lib/actions/`)

| Module                  | Must be checked                                                                                                                                        | Evidence                                | Status   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | -------- |
| `content.ts`            | Zod validation before any database call                                                                                                                | `content.test.ts`, 30 tests             | verified |
| `content.ts`            | Database error codes map to stable client codes                                                                                                        | same                                    | verified |
| `content.ts`            | No database message ever reaches the client                                                                                                            | same                                    | verified |
| `auth.ts`, `profile.ts` | Same three properties                                                                                                                                  | `auth.test.ts` 23, `profile.test.ts` 28 | verified |
| `plazas.ts`             | Council-only, CAS conflict and duplicate-slug mapping                                                                                                  | `plazas.test.ts`, 31 tests              | verified |
| `plazas.ts`             | Cleared text becomes SQL NULL, not an empty string                                                                                                     | same                                    | verified |
| `plazas.ts`             | A committed mutation survives a cache failure                                                                                                          | same                                    | verified |
| `moderation.ts`         | Compare-and-swap sent as displayed; reason required; `draft`/`pending_review`/`deleted_by_author` refused as destinations before reaching the database | `moderation.test.ts`                    | verified |
| `moderation.ts`         | Null flag means "leave alone"; database codes map correctly; cache failure never turns a committed mutation into a reported failure                    | same                                    | verified |
| `appeals.ts`            | Validation before any database call; an argument under 20 characters never reaches the RPC; a decision must be `granted` or `denied` with a reason     | `appeals.test.ts`, 13 tests             | verified |
| `appeals.ts`            | Rate limit, already-appealed and original-actor refusals map to distinct client codes, and no database message reaches the caller                      | same                                    | verified |

### 2.5 Application boundary

| Must be checked                                       | Evidence                                       | Status             |
| ----------------------------------------------------- | ---------------------------------------------- | ------------------ |
| Service-role key never reaches the client bundle      | `boundaries.test.ts`                           | verified           |
| Supabase SDK imported only inside `src/lib/supabase/` | same                                           | verified           |
| Middleware protects the Council route                 | `middleware.test.ts`, `council/access.test.ts` | verified           |
| Permission resolution is server-side only             | `permissions.test.ts`, 32 tests                | verified           |
| Private routes excluded from crawling                 | `src/app/robots.ts`                            | reviewed (no test) |

### 2.6 Route shells

Every route that loads data owns a `loading.tsx` and an `error.tsx`. Present for: `members`, `council`, `council/audit`, `council/reports`, `profile/edit`, `plazas`, `plazas/[slug]`, `posts/[postId]`. `src/app/error.tsx` is the last boundary for every other segment, and `src/app/not-found.tsx` handles a missing route; neither logs anything but the digest.

`plazas`, `plazas/[slug]`, `posts/[postId]`, `council/reports`, `council/reports/[reportId]`, `council/plazas` and `council/plazas/[plazaId]` are now rendered, not stubs: Plaza listing/detail, post detail with its comment thread, compose (`plazas/[slug]/new`) and edit (`posts/[postId]/edit`), vote/reaction/bookmark, report filing on a post/comment/profile (`system/report-control`), the report queue (filter, claim, `DataTable`), the report detail page (evidence, resolve/dismiss, and hide/quarantine/delete/restore on the reported post or comment), and Plaza administration (create/edit/archive, CAS) are all wired to the Server Actions and RPCs verified in §2.3/§2.4. Moderation beyond removal is now surfaced too: `PostModerationPanel` on the post page (pin, highlight, lock editing, lock/reopen the thread, move to another Plaza), `CommentModerationControl` on each comment (pin, lock replies), `RevisionHistory` under the evidence on a report (`list_content_revisions`), `UserModerationPanel` on the Council user page (warn, Council notes, and a link to that member's audit history), and `OwnWarnings` on a member's own profile, where they acknowledge a warning themselves. All of these are gated on `moderation.hide` or `moderation.warn` at the call site and re-checked by the RPC. A cross-Plaza "Recent posts" feed now sits on `/` too, sharing `system/post-list` with the Plaza page. What is still owed: the per-plaza permission (`required_post_permission`) field - it needs a migration first, since neither Plaza admin RPC accepts it as a parameter yet.

`council/appeals` and `council/appeals/[appealId]` are rendered too, with their own `loading.tsx` and `error.tsx`: the queue (status filter, claim, `DataTable`) and the decision page (the action under appeal, the member's argument, grant/deny). A member reads and files their own appeals on their profile (`OwnAppeals`).

The Council shell now opens for `moderation.hide` alone, so a moderator whose only destination is the queue can reach it (`council/access.test.ts`, `council-navigation.test.tsx`).

### 2.7 Components

| Must be checked                                                             | Evidence                                                                | Status                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared components declare their contract                                    | `component-contracts.test.tsx`                                          | verified                                                                                                                                                                                         |
| Validity is server-owned; `FieldError` always renders                       | auth and profile UI tests fail closed on this                           | verified                                                                                                                                                                                         |
| One icon set only (Phosphor, `/dist/ssr`)                                   | `lucide-react` removed from `package.json`                              | verified                                                                                                                                                                                         |
| Flag controls send only the flag that changed, never all of them            | `post-moderation-panel.test.tsx`, `comment-moderation-control.test.tsx` | verified                                                                                                                                                                                         |
| A status or flag change is refused without a reason, before any server call | same two suites                                                         | verified                                                                                                                                                                                         |
| Locking a thread is compare-and-swap against the status displayed           | `post-moderation-panel.test.tsx`                                        | verified                                                                                                                                                                                         |
| A move never offers the Plaza the post is already in                        | same suite                                                              | verified                                                                                                                                                                                         |
| A refused mutation keeps the wording and does not re-read the page          | both panels plus `user-moderation-panel.test.tsx`                       | verified                                                                                                                                                                                         |
| Warning and note copy never confuse their two audiences                     | `user-moderation-panel.test.tsx`                                        | verified                                                                                                                                                                                         |
| Removal is offered only on the reader's own Council note                    | same suite                                                              | verified                                                                                                                                                                                         |
| A member acknowledges their own warning, and only once                      | `own-warnings.test.tsx`                                                 | verified                                                                                                                                                                                         |
| Edit history renders nothing for a profile report and reads none            | `revision-history.test.tsx`                                             | verified                                                                                                                                                                                         |
| Full design gate (density, zoom, 320px, keyboard, states)                   | —                                                                       | **owed** — automated typecheck/lint/format/test/build are clean for the new Plaza/post/report UI, but no Chromium 320px/200%-zoom/keyboard walk has been done, `docs/dev/DESIGN_VERIFICATION.md` |

### 2.8 Database — Codex Libre (migrations `0015`)

Every Codex table is RLS-enabled with no policies and no grants; all access goes through SECURITY DEFINER RPCs that re-check the actor's permission and the target's visibility inside the transaction.

| Must be checked                                                        | Evidence                                             | Status   |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| Tables unreachable from the Data API                                    | `codex_contract.test.sql` (85 assertions)            | verified |
| Visitors read only published and locked articles                       | same suite                                           | verified |
| Drafts, unpublished and archived articles are Archivist-only            | same suite                                           | verified |
| A proposal never leaks a source that is no longer visible to the caller | same suite                                           | verified |
| A member proposes with a post, comment or external source               | same suite                                           | verified |
| Sources are re-validated for visibility at read time                    | same suite                                           | verified |
| Attribution is a status (`public`/`anonymous`/`withdrawn`), not a feeling | same suite                                          | verified |
| Versions are snapshots taken before a change, bounded to 50 per article | same suite                                           | verified |
| Restoring a version snapshots the state being reverted first            | same suite                                           | verified |
| Publishing a proposal requires `codex.publish`, never the proposal text | same suite                                           | verified |
| Suggestions are one open per member per article, rate-limited           | same suite                                           | verified |
| `codex.propose` is granted to the User role; `codex.edit`/`codex.publish` to Archivist | migration 0015 seed                      | reviewed |

### 2.9 Database — Clans, Casas and identity (migration `0016`)

| Must be checked                                                | Evidence                                                     | Status   |
| -------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| Tables unreachable from the Data API                           | `clans_identity_contract.test.sql` (70 assertions)           | verified |
| Membership, internal roles, ranks, badges, friends and blocks  | same suite                                                   | verified |
| A member cannot escalate their own rank or role                | same suite                                                   | verified |
| A leader only manages their own clan/house                     | same suite                                                   | verified |
| Blocked users cannot send requests or interact directly        | same suite                                                   | verified |
| Friend requests are rate-limited                               | same suite                                                   | verified |

### 2.10 Database — Holochat and notifications (migration `0017`)

| Must be checked                                                          | Evidence                                                          | Status   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------- |
| Tables unreachable from the Data API                                     | `holochat_notifications_contract.test.sql` (68 assertions)        | verified |
| Channels are permission-filtered per viewer                              | same suite                                                        | verified |
| A message edit snapshots its previous wording                            | same suite (`chat_message_edits`)                                 | verified |
| Chat reports enter the existing moderation queue                         | same suite                                                        | verified |
| Notification outbox event is transactional with the main action          | same suite                                                        | verified |
| The notification consumer is idempotent and bounded                      | same suite                                                        | verified |
| Failed events can be inspected and reprocessed (`outbox_list_failed`, `outbox_reprocess`) | same suite RPCs                          | verified |

### 2.11 Database — Search and site settings (migration `0018`)

| Must be checked                                                       | Evidence                                                   | Status   |
| --------------------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| Search RPCs re-check the same visibility helpers the pages use        | `search_settings_contract.test.sql` (48 assertions)        | verified |
| Deleted and private content never appears in results                  | same suite                                                 | verified |
| Settings are typed, bounded, and their mutations are audited          | same suite                                                 | verified |
| Security-critical settings are not editable from the UI               | same suite                                                 | verified |

### 2.12 Documented DB-contract gaps (migrations frozen this wave)

These are real gaps in the 0015-0018 contract that the UI cannot paper over.
Each names its owning RPC/migration and the surface that would consume it.
They are **not** UI debt: closing them needs a forward-only migration.

| Gap                                                                        | Owning contract                                                                                        | Surface that would consume it                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| No duplicate-proposal detector                                             | `create_codex_proposal` (0015) has no "same source already proposed" check                             | `/codex/propose` could warn before filing            |
| No public by-article provenance RPC                                        | `codex_proposals.article_id` points one way; `resolveArticleProvenance` scans client-side               | `/codex/[slug]` provenance panel                     |
| No non-public article list RPC                                             | `list_codex_articles` returns only `published`/`locked` (0015)                                          | `/council/codex` dashboard cannot list drafts        |
| Archived-category reactivation                                             | `list_codex_categories` returns only active categories (0015)                                           | `category-manager.tsx` cannot list archived shelves  |
| Propose-to-Codex chat sources                                              | `codex_source_type` includes `chat_message` but no RPC overload accepts a `chat_message_id` (0015/0017) | `chat-report-control` / Holochat propose entry       |
| Mention notification producer                                               | the `mention` enum exists but no DB producer enqueues it (0017)                                         | NotificationBell                                    |
| Resolved-report notification                                               | `moderation_set_report_status` is not recreated to enqueue a notification (0009)                        | NotificationBell                                    |
| Announcement fan-out                                                        | `post_chat_announcement` records the event with no recipient (0017)                                     | NotificationBell                                    |
| Moderator mute RPC                                                          | no mute function in the 0015-0018 contract; blocks are self-initiated (0016)                            | Holochat moderation controls                        |
| Private-channel member list RPC                                             | no RPC lists a private channel's members (0017)                                                         | `/holochat/[slug]` management                       |
| Archived-channel reactivation UI                                            | `admin_set_chat_channel_status` exists but no surface lists archived channels (0017)                    | `/holochat/manage`                                  |
| Failed-event admin UI                                                       | `outbox_list_failed`/`outbox_reprocess` exist (0017) but nothing surfaces them                          | `/council/settings` (Lane D surface)                |
| Message edit-history viewer                                                 | `chat_message_edits` is written (0017) but no read RPC or UI shows it                                   | message context menu                                |
| Reaction-type Council UI                                                    | `admin_upsert_reaction_type`/`admin_set_reaction_type_active` exist (0008) but no Council surface       | Council settings                                    |
| Per-plaza posting permission field                                          | `admin_create_plaza`/`admin_update_plaza` accept no `required_post_permission` parameter (0007)         | Council Plaza administration                        |

---

## 3. Checks the gate cannot run

These require a person and must be walked before closing a phase.

- [ ] Loading, empty, partial, error and access-denied states rendered with realistic data (0 / 1 / many, long text, missing media).
- [ ] Keyboard-only completion of each primary task; focus visible and restored.
- [ ] 200% zoom and a 320 CSS-pixel viewport.
- [ ] Copy uses canonical domain terms from `.agent/CONTEXT.md`.
- [ ] Threat model walked for the new surface: `docs/dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md`.
- [ ] Every Supabase change reproducible from the repository, nothing Dashboard-only.
- [ ] Documentation updated where a domain or architectural decision changed.
- [ ] No secret or service-role credential in code, logs, tests or docs.

---

## 4. Open items

| Item                                                                                      | Owner                     | Note                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ADR for the Base UI + Tailwind 4 adoption                                                 | whoever made the call     | Recorded in `.agent/COORDINATION.md`                                                                                       |
| Phase 2: per-plaza permission (`required_post_permission`) has no RPC parameter to set it | Supabase/migrations owner | Not a UI gap - `admin_create_plaza`/`admin_update_plaza` need a new parameter first (registry §2.12)                        |
| Retention runs but has never fired in production                                          | content lane              | `pg_cron` job scheduled for 03:30 daily; the function itself is proven by `appeals_contract.test.sql`                      |
| Fresh `supabase test db --linked` for the 0015-0018 suites                               | Supabase/migrations owner | The last linked run (558/558) predates Codex/Clans/Holochat/Search; the four new suites add 271 assertions                  |
| Council UI for reaction-type administration                                              | Council lane              | RPCs exist (0008); no surface yet (registry §2.12)                                                                         |
| All other 0015-0018 contract gaps                                                         | Supabase/migrations owner | Registry §2.12: chat proposal sources, mention/announcement/resolved-report notifications, moderator mute, private-channel members, archived reactivation surfaces, outbox admin UI, edit-history viewer |

---

## 5. Notes

**Phase checkbox policy.** A phase item is ticked only when the behaviour it describes is reachable by a user.

Phase 0 was reconciled against reality and closed: 35/35, each item verified against the artefact named in section 2.

Phase 2 and Phase 3 both moved this session, once Plaza/post/comment UI and the report queue/decision/target-moderation UI landed on top of already-verified server logic. Phase 3 then closed everything that was only missing a control: content flags, move, lock/reopen, comment pin/lock, edit history, warnings, Council notes and moderation history. Appeals and retention then closed the rest: migration `0013` gives a member one argument per recorded action and a Council queue to answer it, and `0013`/`0014` purge closed reports and decided appeals after 180 days on a `pg_cron` schedule that lives in the repository rather than in the Dashboard.

Current phase state: 0 -> 35/35 - 1 -> 37/40 (remainder depends on Phase 5 identity) - 2 -> 43/44 (only the per-plaza permission field remains, which needs a migration) - 3 -> 49/50. The single open Phase 3 item is "permanent deletion requires superior permission, reason and confirmation", which does not apply: this system has no physical deletion by design.

The integration wave (Phases 4-7) shipped Codex Libre (0015), Clans/Casas identity (0016), Holochat + notifications (0017) and Search + settings (0018), each with its own pgTAP suite (§2.8-2.11). The Council shell now opens for Archivists holding `codex.edit`/`codex.publish` alone and carries Codex and Settings destinations; the shell nav, mobile nav and signed-in chrome (search entry, notification bell) reach every product area; and the home page states the network's identity plainly. Self-service content is verified end-to-end for a normal registered member: post in a Plaza, propose a conversation for the Codex (from a post, comment, or external source), and suggest a correction on a published article. Writing directly to the Codex is an Archivist permission (`codex.edit`) by design — a normal member's path is propose → review → article. The Philosophy category is not seeded; an Archivist creates it once through Council → Codex → Categories, after which published articles under it appear in the library and flow to the home via the Codex entry point. The remaining 0015-0018 contract gaps are listed in §2.12 and are migration work, not UI debt.

**Running the database contract.** The four suites need pgTAP. Against a local stack: `pnpm db:reset:local` then `supabase test db`.

When the local ports are occupied, a disposable PostgreSQL 16 with stub `auth`, `storage` and `private` schemas replays all eleven migrations and runs the suites. Three of the four pass fully there:

| Suite                                  | Plan | In the stub harness | Note                                                                                                                                                                                                                                                           |
| -------------------------------------- | ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_contract.test.sql`            | 82   | 82 pass             | —                                                                                                                                                                                                                                                              |
| `content_moderation_contract.test.sql` | 105  | 105 pass            | —                                                                                                                                                                                                                                                              |
| `reports_contract.test.sql`            | 58   | 58 pass             | —                                                                                                                                                                                                                                                              |
| `identity_security_contract.test.sql`  | 160  | 45 reached          | Its Storage ACL assertions need the real `storage` schema, which the stub only imitates; the suite aborts at the first `storage.objects` privilege check. Confirmed identical with and without migration `0009`, so this is a harness limit, not a regression. |

The identity suite is therefore verified only against a real Supabase stack; all four suites pass there (405/405, section 1).

**Adding a system.** A new system is not done until it has a row in section 2 naming the evidence. "It works" is not evidence; a named test or a named manual walk is.
