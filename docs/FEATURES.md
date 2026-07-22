# Features

## Approach

Mandaloria should grow in layers. First define what each person can do, then how those actions connect with permissions, moderation, reputation, clans/houses, and administration.

Operational detail for each feature lives in `FEATURE_MATRIX.md`.

The initial priority is to have the basics done well:

- post;
- comment;
- reply;
- react;
- edit;
- delete;
- report;
- moderate;
- administer permissions.

## Users

A user can have:

- profile;
- avatar;
- biography;
- rank;
- roles;
- main clan/house;
- secondary clans/circles;
- badges;
- reputation;
- friends or connections;
- saved posts;
- activity history;
- notification preferences.

## Posts

Basic actions:

- create post;
- edit own post;
- delete own post;
- view post;
- comment;
- save/bookmark;
- report;
- share link;
- react;
- upvote;
- downvote.

Moderation actions:

- close post;
- reopen post;
- pin post;
- feature post;
- hide post;
- restore post;
- move to another plaza;
- change tags;
- mark as approved;
- mark as rejected;
- lock edits.

Possible statuses:

- draft;
- published;
- pending review;
- closed;
- pinned;
- featured;
- hidden;
- deleted by author;
- deleted by moderator;
- archived.

## Comments and Replies

Basic actions:

- comment on a post;
- reply to another comment;
- edit own comment;
- delete own comment;
- react with emoji;
- upvote;
- downvote;
- report comment;
- copy direct link.

Recommended model for MVP:

- comments with a single layer of replies or simple thread;
- pagination;
- sorting by date or relevance;
- soft delete to not break conversations.

Future version:

- full nested comments;
- collapsible replies;
- comment pinned by moderator;
- edit history;
- user mentions.

## Reactions

Initial types:

- like;
- dislike;
- emoji;
- Respect;
- Wisdom;
- Useful contribution;
- Agree;
- Needs revision.

Rules:

- a user can react once per configurable reaction type;
- like/dislike votes can be mutually exclusive;
- reactions can affect reputation;
- admins can enable or disable reaction types;
- some reactions may require a role or rank.

## Friends and Connections

Initial system:

- send friend request;
- accept request;
- reject request;
- cancel request;
- remove friendship;
- block user.

Future system:

- follow user without friendship;
- close members list;
- privacy by relationship level;
- clan/circle invitations.

## Badges

Badges recognize identity, achievements, or trust.

Types:

- manual;
- automatic;
- temporary;
- exclusive;
- event;
- clan/house.

Examples:

- Founder;
- First oath;
- Archivist;
- Mentor;
- Guardian;
- Featured contribution;
- Builder of Mandaloria.

A verifiable badge must show issuer, date, reason, permitted evidence, and status. It can be revoked without erasing its internal history and never grants permissions by accident.

## Ranks

Ranks represent community progression.

Rules:

- they can be automatic or manual;
- they do not always grant permissions;
- they can be tied to reputation, seniority, or Council decision;
- they should be visible on the profile and next to the user's name.

## Roles

Roles are technical and control permissions.

Initial roles:

- user;
- verified member;
- archivist;
- moderator;
- guardian;
- administrator.

Important rule:

Rank and badge represent identity. Role represents permissions.

## Clans, Houses, and Circles

Basic actions:

- view clans/houses;
- request entry;
- accept invitation;
- leave;
- view members;
- view clan/house page;
- post in clan/house space if permitted.

Leader actions:

- edit description;
- change emblem;
- invite members;
- expel members;
- assign internal role;
- create internal announcement.
- define mission and areas of responsibility;
- organize research expeditions;
- propose results to the Codex.

Admin actions:

- create clan/house;
- archive clan/house;
- change leader;
- moderate internal content;
- define if public, private, or invitation-only.
- resolve responsibility or publication conflicts.

## Library / Codex Libre

Basic actions:

- read articles;
- search articles;
- view categories;
- save articles;
- suggest correction;
- comment or discuss article in a linked plaza.

Archivist actions:

- create article;
- edit article;
- send for review;
- publish;
- archive;
- restore previous version.

Admin actions:

- manage categories;
- approve changes;
- lock editing;
- define visibility.

Distillation of conversations:

- propose eligible posts, comments, or messages;
- review sources and consent;
- recognize confirmed contributions;
- create draft from a proposal;
- publish a reviewed version;
- link source and article in both directions;
- withdraw or correct attribution without destroying audit.

The full specification lives in `KNOWLEDGE_LIFECYCLE.md`.

## Holochat

Basic actions:

- view channels;
- send messages;
- edit own message;
- delete own message;
- react with emoji;
- reply to message;
- report message.

Future actions:

- mentions;
- pinned messages;
- private channels;
- channels per clan/house;
- channels per role;
- online presence.

## Notifications

Initial events:

- reply to post;
- reply to comment;
- reaction received;
- mention;
- friend request;
- clan/house invitation;
- report resolved;
- warning received;
- important announcement.

Preferences:

- notifications within the web;
- optional email;
- mute plazas;
- mute posts;
- mute users.

## Moderation

Actions:

- review reports;
- hide content;
- restore content;
- quarantine content and attachments;
- remove from quarantine;
- close posts;
- move posts;
- pin posts;
- warn user;
- suspend user;
- ban user;
- review history;
- log action.

Every sensitive change must be logged.

Moderation is reversible by default. Permanent deletion is exceptional and requires higher permission, reason, and confirmation.

## Admin

The admin panel must control:

- users;
- roles;
- permissions;
- ranks;
- badges;
- clans/houses;
- plazas;
- channels;
- Codex Libre;
- reports;
- bans;
- settings;
- themes;
- reactions;
- logs.

## MVP Priority

First:

1. profiles;
2. roles;
3. plazas;
4. posts;
5. comments;
6. replies;
7. likes/dislikes;
8. simple reactions;
9. reports;
10. basic moderation;
11. basic library;
12. minimum admin.

Later:

1. clans/houses;
2. ranks;
3. badges;
4. friends;
5. notifications;
6. chat;
7. advanced permissions;
8. advanced customization.
