# Content Model

## Main Types

Mandaloria will have several types of content:

- posts;
- comments;
- library articles;
- chat messages;
- announcements;
- reports;
- profiles;
- clan/house pages.

## Posts

Posts are the main content of the plazas.

Conceptual fields:

- title;
- body;
- author;
- plaza;
- tags;
- status;
- comment count;
- reaction count;
- creation date;
- update date;
- last activity date.

Possible types:

- debate;
- question;
- reflection;
- guide;
- announcement;
- art/creation showcase.

## Comments

Comments respond to posts.

First version:

- linear comments or with simple replies;
- edit own comments;
- delete own comments;
- report comments.

Future version:

- nested comments;
- sorting by relevance;
- edit history;
- comments featured by moderators.

## Codex Libre

The Codex Libre stores more stable knowledge. Its purpose is to keep essential information free, open, and accessible to all.

Conceptual fields:

- title;
- slug;
- content;
- author;
- reviewers;
- category;
- status;
- version;
- publication date;
- last revision date.

Statuses:

- draft;
- under review;
- published;
- archived.

## Knowledge Cycle

A valuable conversation can become stable knowledge through a distillation:

```text
conversation -> proposal -> draft -> review -> Codex article
```

The proposal may use posts, comments, or permitted messages as sources. The article preserves provenance, recognizes confirmed contributions, and is linked to the original conversation in both directions.

Rules:

- a proposal does not publish content directly;
- private sources require permission and consent before becoming public;
- withdrawing a source or attribution does not erase the internal audit;
- proposals and articles have separate lifecycles;
- reputation, rank, and badges are never granted solely for appearing as a contributor;
- the full flow is defined in `docs/KNOWLEDGE_LIFECYCLE.md`.

## Announcements

Announcements are special posts by administrators or moderators.

They can be:

- pinned on the home page;
- pinned in a plaza;
- visible to all;
- visible only to certain roles;
- closed to comments.

## Chat

Chat consists of channels and messages.

Initial channels:

- welcome;
- general;
- questions;
- announcements.

Each message has:

- channel;
- author;
- content;
- date;
- status;
- optional reference to another message.

## Reactions

Reactions should have community meaning.

Initial reactions:

- Respect
- Wisdom
- Useful contribution
- Agree
- Needs revision

Later they can be configured from admin.

## Reports

Reports allow content moderation.

A report can target:

- post;
- comment;
- chat message;
- profile;
- clan/house.

Statuses:

- open;
- under review;
- resolved;
- rejected.

Chat message and clan/house targets are not implemented; they belong to Phases 5 and 6. Migration `0009` implements the post, comment and profile targets, and names the fourth status `dismissed` rather than `rejected` — a report is dismissed, the reporter is not.

## Edit History

Source of truth: `content_revisions`, defined in migration `0012`.

An edit does not overwrite silently. `update_own_post` and `update_own_comment` snapshot what the content said **before** the change, inside the same transaction, so no caller can skip it. Without this a report is unanswerable: a member reports a post, its author rewrites it, and the moderator opens evidence that no longer says what was reported.

- An edit that changes nothing writes no revision. A history of identical entries is noise, and it would let a member push real history past the bound by saving the same text repeatedly.
- Each item keeps at most its 50 most recent revisions, trimmed as they are written rather than by a scheduled job. Edit history is context, not an archive.
- Order comes from a sequence, never from the clock. Several edits in one transaction share the same `now()` and a v4 uuid carries no order, so ordering on `(created_at, id)` would shuffle them — and the trim would then drop whichever revisions happened to sort low.
- Reading requires being the item's author or holding `moderation.hide`. Anyone else is told the content does not exist rather than that it is forbidden, so an id cannot be used to probe for edits.
- A revision survives its author's account being removed, because it is evidence about the content. It does not survive the content itself being physically deleted.

## Deleted Content

Important content should not be physically deleted at first.

Logical deletion will be used:

- visible;
- hidden;
- quarantined;
- deleted by user;
- deleted by moderator;
- archived.

Quarantine removes content and attachments from circulation while being investigated. Hiding, quarantining, and restoring are reversible actions; physical deletion is exceptional, requires higher permission, and is audited.

## Implemented States and Transitions

Source of truth: `posts.status` (`public.post_status`) and `comments.status` (`public.comment_status`), defined in migration `0007`. Nothing else decides whether content is visible; there is no parallel boolean.

### Post states

| State                  | Publicly listed | Accepts comments | Author may edit |
| ---------------------- | --------------- | ---------------- | --------------- |
| `draft`                | no              | no               | yes             |
| `pending_review`       | no              | no               | yes             |
| `published`            | yes             | yes              | yes             |
| `closed`               | yes             | no               | no              |
| `archived`             | yes             | no               | no              |
| `hidden`               | no              | no               | no              |
| `quarantined`          | no              | no               | no              |
| `deleted_by_author`    | no              | no               | no              |
| `deleted_by_moderator` | no              | no               | no              |

Transitions implemented in Phase 2:

- (none) → `draft` or `published`, by `create_post`, depending on `p_publish`.
- `draft`, `pending_review`, `published` → same state with new content, by `update_own_post`, unless `edit_locked` is set.
- any state except the two removed ones → `deleted_by_author`, by `delete_own_post`.

Transitions implemented in Phase 3, all through `moderation_set_post_status` and all compare-and-swap, reason-carrying and audited:

- any visible state ↔ `hidden`, needs `moderation.hide`.
- any visible state ↔ `quarantined`, needs `moderation.quarantine`.
- any state → `deleted_by_moderator`, needs `moderation.delete`.
- back to `published`, `closed` or `archived`, needs `moderation.restore`.

Two transitions are refused by design. `deleted_by_author` is terminal for a moderator: a post its author withdrew can be deleted further but never brought back, because restoring it would republish what its author chose to remove. And nothing can be pushed into `draft` or `pending_review`, because that is the author's workflow and moderation must not hand anyone an edit of someone else's content.

A post that was never published gets its `published_at` when moderation first makes it visible, which is what the `posts_published_at_matches_status` constraint requires. A post enters or leaves its Plaza's `posts_count` in the same transaction as the transition, on the same definition the repair function uses.

`is_pinned`, `is_highlighted` and `edit_locked` are flags, not states. They are orthogonal to `status`, and no combination of them can contradict it. `moderation_set_post_flags` sets all three at once; a null leaves a flag alone, and a removed post carries no flags at all. `moderation_move_post` moves a post to another active Plaza and adjusts both counts.

### Comment states

| State                  | Author and body exposed | Body exposed | Accepts replies |
| ---------------------- | ----------------------- | ------------ | --------------- |
| `published`            | yes                     | yes          | yes             |
| `hidden`               | yes                     | no           | no              |
| `quarantined`          | yes                     | no           | no              |
| `deleted_by_author`    | no                      | no           | no              |
| `deleted_by_moderator` | no                      | no           | no              |

A removed comment keeps its row and its position in the thread so its replies retain their context. The read RPC blanks the author and the body instead of dropping the row, which is why a tombstone is a rendering concern rather than a data one.

Comments carry two moderation flags of their own since migration `0010`: `is_pinned` and `replies_locked`. A locked comment accepts no reply while the rest of the thread stays open. Pinning is reported by `list_post_comments`, not applied to its ordering — the thread pages on a `(created_at, id)` keyset, and reordering as pins move would break the cursor.

`moderation_set_comment_status` mirrors the post transitions, including the rule that `deleted_by_author` is terminal for a moderator. A comment counts towards its post's `comments_count` and its parent's `replies_count` only while it is `published`, so hiding one takes it out of both counts and restoring returns it.

### Report states

Source of truth: `content_reports.status` (`public.report_status`), defined in migration `0009`.

| State          | In the moderator's queue | Blocks the same reporter filing again | Carries a decision |
| -------------- | ------------------------ | ------------------------------------- | ------------------ |
| `open`         | yes                      | yes                                   | no                 |
| `under_review` | yes                      | yes                                   | no                 |
| `resolved`     | no                       | no                                    | yes                |
| `dismissed`    | no                       | no                                    | yes                |

Transitions implemented in Phase 3, all through `moderation_set_report_status`:

- (none) → `open`, by `create_report`.
- `open` → `under_review`, a moderator claiming the item so two do not work it at once.
- `open` or `under_review` → `resolved` or `dismissed`, which requires a reason and is audited.

A closed report cannot be reopened: reopening would erase who decided what and when. The reporter files again instead, which leaves both records. Every transition takes the expected current status, so two moderators on stale screens cannot overwrite each other.

Filing a report changes nothing about the target. Acting on the claim is a separate moderation action with its own permission, and those transitions are still absent.

A reporter cannot read their own report back. Knowing whether a report was seen is the signal an abusive reporter uses to calibrate.

### Plaza states

`active` and `archived`. An archived Plaza stays readable and stays listed with its state shown; it accepts no new posts. The transition runs through `admin_set_plaza_status`, which takes the expected current state so two administrators acting on stale screens cannot overwrite each other, and writes an audit entry.

### Reversibility

Removal by an author is a state change, not a delete: the row, its body and its counters survive, so restoring it is a state change too. The restore path itself is Phase 3 work and is not implemented.

A report survives its target's removal, and `moderation_get_report` still returns the body once the content is hidden. That is the point of hiding rather than deleting: the evidence has to outlive the removal.
