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
