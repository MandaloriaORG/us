# Feature Matrix

## Purpose

This document breaks down each important feature of Mandaloria to avoid missing basic actions for usage, moderation, permissions, or data.

Each feature must answer:

- what can a user do;
- what can a moderator do;
- what can an admin do;
- what data does it need;
- what permissions does it require;
- what edge cases need to be covered.

## 1. Accounts and Authentication

User:

- register;
- log in;
- log out;
- recover password;
- verify email;
- change email;
- change password.

Admin:

- view users;
- suspend user;
- ban user;
- force logout if necessary;
- change roles;
- view relevant activity.

Data needed:

- Supabase auth user;
- profile;
- verified email;
- account status;
- timestamps;
- last access.

Permissions:

- visitor can register;
- authenticated user can manage their account;
- admin can manage accounts;
- moderator must not change credentials or global roles.

Edge cases:

- banned user attempts to log in;
- unverified user attempts to post;
- deleted or deactivated account;
- pending email change.

## 2. User Profile

User:

- view public profile;
- edit display name;
- edit avatar;
- edit bio;
- edit links;
- choose privacy;
- view their posts;
- view their badges;
- view their clan/house;
- view friends if applicable.

Moderator:

- hide offensive bio/avatar;
- view report history;
- add moderation note.

Admin:

- edit sensitive fields;
- reset avatar;
- change profile status;
- assign rank, role, or badge.

Data needed:

- profile;
- avatar;
- bio;
- display_name;
- privacy_settings;
- user_badges;
- user_ranks;
- clan_members.

Permissions:

- user edits their own profile;
- moderator moderates visible content;
- admin manages technical identity.

Edge cases:

- duplicate names;
- reserved names;
- avatar too large;
- bio with dangerous HTML;
- private profile.

## 3. Plazas

User:

- view public plazas;
- enter a plaza;
- view posts;
- filter by recent, popular, or featured;
- create post if permitted.

Moderator:

- pin plaza rules;
- move posts;
- close posts;
- hide posts;
- review reports from that plaza.

Admin:

- create plaza;
- edit name, slug, and description;
- change visibility;
- define permissions;
- archive plaza;
- order plazas.

Data needed:

- spaces;
- space_permissions;
- posts;
- moderation_rules;

Permissions:

- public plaza visible to all;
- private plaza visible only to authorized members;
- announcements plaza only allows posting to specific roles.

Edge cases:

- duplicate slug;
- archived plaza;
- user without permission attempts to post;
- moving post to a plaza where the author does not have permission.

## 4. Posts

User:

- create post;
- edit own post;
- delete own post;
- view post;
- comment;
- upvote;
- downvote;
- react;
- save;
- report;
- share link.

Moderator:

- edit title for moderation;
- hide post;
- restore post;
- delete post;
- close or reopen;
- pin;
- feature;
- move;
- lock editing;
- approve or reject.

Admin:

- do everything a moderator can;
- change author only in special cases/import;
- purge content if legally necessary;
- configure post types.

Data needed:

- posts;
- post_versions;
- post_tags;
- content_reactions;
- bookmarks;
- reports;
- moderator_actions.

Permissions:

- user edits their content if published and not locked;
- moderator can moderate within their scope;
- admin can moderate globally.

Edge cases:

- post with comments deleted by author;
- closed post does not accept comments;
- pending post does not appear publicly;
- content edited after being reported;
- banned author.

## 5. Comments and Replies

User:

- comment;
- reply to a comment;
- edit own comment;
- delete own comment;
- upvote;
- downvote;
- react with emoji;
- report;
- copy direct link.

Moderator:

- hide comment;
- restore comment;
- delete comment;
- pin comment;
- lock replies;
- edit for moderation reason;
- review history.

Admin:

- configure reply depth;
- configure sorting;
- purge comment if necessary;
- view full logs.

Data needed:

- comments;
- comment_versions;
- parent_comment_id;
- content_reactions;
- reports;
- moderator_actions.

Permissions:

- user comments if the post is open;
- user edits their comment if not locked;
- moderator manages comments in assigned plazas;
- admin manages everything.

Edge cases:

- parent comment deleted;
- reply to hidden comment;
- closed post;
- comment edited after receiving replies;
- mass spam.

## 6. Reactions, Likes, and Dislikes

User:

- like;
- dislike;
- remove vote;
- change like to dislike;
- react with emoji;
- remove reaction.

Moderator:

- view abuse patterns;
- remove abusive reactions if applicable.

Admin:

- create reaction types;
- disable types;
- decide if they affect reputation;
- decide if like/dislike are visible;
- limit reactions by role.

Data needed:

- reactions;
- content_reactions;
- reaction_types;
- reputation_events.

Permissions:

- authenticated user can react;
- new users may have a limit;
- closed content may or may not allow reactions depending on setting.

Edge cases:

- double vote from the same user;
- bots reacting massively;
- user reacts to deleted content;
- inconsistent counts.

## 7. Reports

User:

- report post;
- report comment;
- report message;
- report profile;
- choose reason;
- add description.

Moderator:

- view queue;
- assign report to self;
- resolve;
- reject;
- request further review;
- take action on content;
- take action on user.

Admin:

- view all reports;
- configure reasons;
- audit decisions;
- reassign reports.

Data needed:

- reports;
- report_reasons;
- moderation_queue;
- moderator_actions;
- audit_logs.

Permissions:

- authenticated user can report;
- moderator sees reports in their scope;
- admin sees everything.

Edge cases:

- multiple reports on the same content;
- repeated false report;
- content deleted before review;
- moderator involved in the case.

## 8. Moderation

Moderator:

- review reported content;
- hide/restore;
- quarantine and remove from quarantine;
- close/reopen;
- move;
- pin/feature;
- warn user;
- suspend user;
- ban if permitted;
- write internal note;
- view action history.

Admin:

- define moderator scope;
- configure moderation permissions;
- review logs;
- revert actions;
- assign cases.
- authorize permanent deletion when legal and necessary.

Data needed:

- moderation_queue;
- moderator_actions;
- moderation_notes;
- moderation_evidence;
- user_warnings;
- user_bans;
- audit_logs.

Permissions:

- moderator only acts within their scope;
- strong actions require specific permissions;
- admin controls configuration.

Edge cases:

- moderator attempts to act on admin;
- moderator moderates their own report;
- temporary ban expires;
- user appeals decision;
- action needs reverting;
- attachment must be inaccessible during quarantine;
- evidence must be preserved with limited access and retention;
- permanent deletion must not be executable by accident.

## 9. Admin and Permissions

Admin:

- create roles;
- edit roles;
- assign roles;
- remove roles;
- create permissions;
- assign permissions to roles;
- configure permissions per plaza;
- configure permissions per channel;
- configure permissions per clan/house;
- view audit logs.

Data needed:

- roles;
- permissions;
- user_roles;
- role_permissions;
- context_permissions;
- audit_logs.

Permissions:

- only admin can manage permissions;
- some critical permissions require owner/superadmin;
- changes must be audited.

Edge cases:

- admin removes their own access;
- role with no permissions;
- duplicate permission;
- conflict between global and contextual permission;
- accidental privilege escalation.

## 10. Clans, Houses, and Circles

User:

- view public clans;
- request entry;
- accept invitation;
- leave;
- view members;
- post in internal space if permitted.

Leader:

- invite;
- accept requests;
- expel members;
- change internal roles;
- edit clan page;
- pin internal announcement;
- declare mission and areas of responsibility;
- organize research expeditions;
- propose results to the Codex;
- issue badges only if given explicit authority.

Moderator:

- moderate internal content if in scope;
- review clan/house reports.

Admin:

- create clan/house;
- archive;
- change leader;
- change privacy;
- resolve disputes.

Data needed:

- clans;
- clan_members;
- clan_roles;
- clan_invites;
- clan_spaces;
- clan_audit_logs;
- clan_responsibilities;
- expeditions;
- expedition_members;
- expedition_sources.

Permissions:

- leader manages their clan, not the whole site;
- admin can intervene;
- private spaces require membership;
- caring for a Codex area does not grant ownership or automatic publication;
- internal roles do not grant global permissions.

Edge cases:

- leader abandons clan;
- clan with no members;
- expired invitation;
- banned user belongs to a clan;
- conflict between global role and internal role;
- abandoned expedition or with private sources;
- dispute over which House maintains a topic;
- attempt to publish internal knowledge without consent.

## 11. Friends, Blocks, and Connections

User:

- send request;
- accept;
- reject;
- cancel;
- remove friendship;
- block user;
- unblock;
- configure visibility.

Moderator:

- view blocks only if necessary for investigation;
- act in harassment cases.

Admin:

- review abuse;
- limit requests by rate limit.

Data needed:

- friend_requests;
- friendships;
- user_blocks;
- privacy_settings.

Permissions:

- user manages their relationships;
- no one can force friendship except system/admin in technical cases;
- blocked user cannot interact directly.

Edge cases:

- repeated requests;
- blocked user attempts to reply;
- friendship while there is a block;
- harassment through requests.

## 12. Ranks and Badges

User:

- view rank;
- view badges;
- view progress if applicable;
- view issuer, date, reason, evidence, and status of a verifiable badge.

Moderator:

- suggest badge;
- view reputation history.

Admin:

- create ranks;
- assign ranks;
- create badges;
- assign badges;
- remove badges;
- define automatic rules;
- revoke a badge while preserving audit.

Data needed:

- ranks;
- user_ranks;
- badges;
- user_badges;
- reputation_events.

Permissions:

- rank must not grant permissions automatically unless an explicit rule exists;
- badge must not grant permissions by default;
- admin controls manual assignments;
- only authorized issuers may grant each badge type;
- private evidence is not exposed when showing the badge.

Edge cases:

- user loses reputation;
- badge removed;
- manual vs automatic rank;
- reputation abuse;
- evidence removed or quarantined;
- badge revoked;
- issuer loses their authority after issuing it.

## 13. Codex Libre

Visitor:

- read public articles;
- search;
- browse categories.

User:

- save article;
- suggest correction;
- comment in linked discussion.

Archivist:

- create article;
- edit;
- send for review;
- publish if permitted;
- restore version.

Admin:

- configure categories;
- lock article;
- change permissions;
- approve sensitive changes.

Data needed:

- library_categories;
- library_articles;
- library_article_versions;
- library_suggestions;
- library_discussions.

Permissions:

- public reading for essential knowledge;
- limited writing;
- version history mandatory.

Edge cases:

- vandalism;
- two people editing at the same time;
- sensitive article;
- version rollback.

### 13.1 Distillation of Conversations

Member:

- propose a post, comments, or permitted messages for the Codex;
- indicate reason and sources;
- follow the proposal;
- request public attribution, anonymous attribution, or withdrawal according to policy.

Archivist:

- classify the proposal;
- detect duplicates;
- validate source permissions;
- confirm contributors;
- create or assign draft;
- request changes;
- send for publication.

Council/publisher:

- approve or reject;
- resolve privacy and attribution conflicts;
- publish a reviewed version;
- reopen, archive, or replace a proposal.

Data needed:

- knowledge_proposals;
- knowledge_proposal_sources;
- knowledge_proposal_contributors;
- knowledge_proposal_events;
- library_discussions;
- audit_logs.

Permissions:

- the proposal does not automatically inherit public access;
- each source retains its visibility;
- only authorized roles review drafts;
- only authorized publishers create a public version;
- RLS protects proposals, sources, contributions, and drafts.

Edge cases:

- private or deleted source;
- source enters quarantine;
- duplicate proposals;
- disputed attribution;
- House conversation without permission to be published;
- two editors working at the same time;
- published article reveals private information.

The full specification lives in `docs/KNOWLEDGE_LIFECYCLE.md`.

## 14. Holochat

User:

- view permitted channels;
- send message;
- edit own message;
- delete own message;
- reply;
- react;
- report.

Moderator:

- delete message;
- hide message;
- restore;
- pin message;
- mute user;
- temporarily close channel.

Admin:

- create channel;
- delete channel;
- change permissions;
- configure channels by role or clan;
- export logs if necessary.

Data needed:

- chat_channels;
- chat_channel_members;
- chat_messages;
- chat_message_reactions;
- chat_read_receipts;
- reports.

Permissions:

- user only sees permitted channels;
- announcements write-only for Council;
- clan channels require membership.

Edge cases:

- real-time spam;
- blocked user;
- message edited after report;
- private channel leaking data;
- history too large.

## 15. Notifications

User:

- receive notifications;
- mark as read;
- mute post;
- mute plaza;
- configure email;
- disable types.

Admin:

- send global announcement;
- configure notification types;
- limit email.

Data needed:

- notifications;
- notification_preferences;
- notification_events;

Permissions:

- user only sees their own notifications;
- admins must not read private notifications without technical reason.

Edge cases:

- too many notifications;
- blocked user generates notification;
- notification points to deleted content;
- email spam.

## 16. Search

User:

- search posts;
- search comments if applicable;
- search articles;
- filter by plaza, date, author, or tag.

Admin:

- reindex;
- configure weights;
- hide deleted content.

Data needed:

- search_index;
- posts;
- comments;
- library_articles;
- tags.

Permissions:

- search only returns content visible to the user.

Edge cases:

- private content appears in search;
- deleted content still indexed;
- slow search;
- scraping abuse.

## 17. Files and Attachments

User:

- upload avatar;
- upload image if the plaza allows it;
- delete own file if not locked;
- view public files.

Moderator:

- hide file;
- delete offensive attachment;
- review reports.

Admin:

- configure max size;
- configure allowed types;
- manage buckets;
- permanently delete file if necessary.

Data needed:

- attachments;
- attachment_usage;
- storage buckets;
- reports.

Permissions:

- new users may have attachments disabled;
- private files require signed URLs;
- public files must be limited by type.

Edge cases:

- dangerous file;
- huge file;
- attachment used in deleted content;
- private file leak.

## Recommended Implementation Order

1. Accounts and profiles.
2. Roles and basic permissions.
3. Plazas.
4. Posts.
5. Comments/replies.
6. Likes/dislikes/reactions.
7. Reports.
8. Basic moderation.
9. Minimum admin.
10. Codex Libre.
11. Notifications.
12. Clans/houses.
13. Ranks/badges.
14. Friends/blocks.
15. Holochat.
16. Search.
17. Attachments.
