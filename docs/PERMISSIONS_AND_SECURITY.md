# Permissions and Security

## Principle

Mandaloria should be simple to use and hard to break.

Security must not depend only on the frontend. All important rules must also be enforced in the database and on the server.

## Permission Model

Separate concepts:

- Role: grants technical permissions.
- Rank: represents progress or status.
- Badge: recognizes achievements.
- Clan/House: represents belonging.
- Permission: specific action allowed or blocked.

Example:

A user can be Mentor rank, have the Archivist badge, and belong to the House of the Archive, but can only edit the Codex Libre if they have a role or permission that allows it.

## Basic Permissions

Users:

- view public content;
- create posts;
- comment;
- reply;
- react;
- vote;
- report;
- edit own content;
- delete own content.

Moderators:

- hide content;
- restore content;
- quarantine content if permitted;
- remove content from quarantine;
- close posts;
- move posts;
- review reports;
- warn users;
- suspend users;
- view moderation logs.

Administrators:

- manage users;
- manage roles;
- manage permissions;
- manage plazas;
- manage channels;
- manage clans/houses;
- manage Codex Libre;
- manage settings;
- view audit logs;
- assign or remove roles.

Archivists:

- classify knowledge proposals;
- review sources and attributions;
- create articles;
- edit articles;
- send articles for review;
- publish if permitted;
- restore versions if permitted.

## Permissions by Context

Permissions can depend on:

- global role;
- specific plaza;
- specific channel;
- clan/house;
- content status;
- content author;
- account age;
- reputation/trust.

Examples:

- A user can comment in Central Plaza but not in Council Announcements.
- An archivist can edit Codex Libre articles but not change roles.
- A clan leader can manage members of their clan but not ban users globally.
- A House can maintain a Codex topic without having permission to publish on its own.
- A verifiable badge recognizes a contribution, but does not authorize any technical action.

## Central Evaluation

Every sensitive action answers a single conceptual question:

`can(actor, action, resource, context)`

The result combines role, specific permission, context, resource status, authorship, and account status. The UI uses the result to present actions; server and RLS re-validate it as the real authorities.

## Technical Security

Mandatory rules:

- use Supabase Auth for authentication;
- enable Row Level Security on sensitive tables;
- validate permissions on the server;
- do not trust data sent by the client;
- sanitize rendered content;
- limit file uploads;
- rate limit actions;
- use soft delete for community content;
- use reversible quarantine during investigations;
- log sensitive actions;
- protect admin routes;
- separate permissions from visible ranks.

## Main Risks

Spam:

- rate limits;
- email verification;
- review queue for new accounts;
- limits by account age.

XSS:

- sanitize Markdown/HTML;
- block scripts;
- use allowlist of tags;
- escape user content.

Permission abuse:

- minimum roles;
- admin logs;
- confirmation for destructive actions;
- do not grant broad permissions by default.

Data exposure:

- RLS;
- queries filtered by user;
- do not expose emails publicly;
- do not expose internal data in public APIs.

Dangerous files:

- limit MIME types;
- limit size;
- separate public and private buckets;
- scan or restrict attachments;
- do not execute uploaded files.

Brute force:

- rate limit on login;
- Supabase Auth policies;
- temporary lockout;
- logs of suspicious attempts.

## Rules for a Secure MVP

First version:

- RLS enabled from the start.
- Only authenticated users can write.
- Visitors only read public content.
- Users edit only their own content.
- Moderators cannot change permissions.
- Admins cannot bypass audit logs.
- Deleted content is hidden, not physically deleted.
- Permanent deletion requires higher permission, reason, and confirmation.
- File uploads limited or disabled at first.
- Sanitized Markdown.
- Rate limits on posting, commenting, reacting, and reporting.

## Security Philosophy

Simple and secure means:

- few critical paths;
- explicit permissions;
- restrictive defaults;
- clear logs;
- complex features only when necessary.
