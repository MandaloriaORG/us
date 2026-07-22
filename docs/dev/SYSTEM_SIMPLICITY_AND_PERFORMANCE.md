# System Simplicity and Performance

## Purpose

This document defines principles for creating Mandaloria simply, quickly and securely from the code structure.

The core idea:

Less complexity means fewer bugs. Fewer bugs means fewer vulnerabilities. Less unnecessary work means more speed.

## Base principle

Optimizing is not writing weird code. Optimizing is doing less work.

Questions per feature:

- [ ] Can we solve this with fewer states?
- [ ] Can we solve this with fewer queries?
- [ ] Can we solve this with less data sent?
- [ ] Can we solve this with one central rule instead of many repeated conditions?
- [ ] Can we avoid duplicating logic between frontend and backend?
- [ ] Can we turn a rare exception into a normal and controlled state?
- [ ] Can we make the safe case the default?

## Complexity

Rules:

- [ ] Prefer simple models with few states.
- [ ] Avoid contradictory conditions.
- [ ] Avoid hardcoded permissions in many places.
- [ ] Centralize permission rules.
- [ ] Centralize input validation.
- [ ] Centralize sanitization.
- [ ] Centralize error handling.
- [ ] Separate reading, writing and moderation.

Signs of bad complexity:

- many `if` conditions checking the same permission in different places;
- many different ways of creating the same data;
- ambiguous states like "deleted but visible";
- admin actions without common flow;
- copied queries with small differences;
- UI that allows actions that backend always rejects.

## State machines

Many features must have clear states.

Example of post:

- draft;
- pending_review;
- published;
- closed;
- hidden;
- deleted_by_author;
- deleted_by_moderator;
- archived.

Rules:

- [ ] Each allowed state must be documented.
- [ ] Each transition must have permission.
- [ ] Each sensitive transition must generate a log.
- [ ] Impossible states must be blocked with constraints or validation.
- [ ] The UI must show actions according to state.

Benefit:

A system with clear states needs fewer scattered `if`s and is harder to break.

## Permission algebra

Permissions should work as composition of simple rules.

Concepts:

- global role;
- concrete permission;
- context: plaza, channel, clan/house, Codex;
- content status;
- content author;
- account status.

Recommended rule:

`can(user, action, resource)` should be the single mental model.

Checklist:

- [ ] Every important action has a named `action`.
- [ ] Every important resource has owner/visibility/status.
- [ ] The final permission is calculated with a central function/helper.
- [ ] RLS replicates critical rules in the database.
- [ ] Ranks and badges do not grant permissions by accident.
- [ ] Denied permissions are the default.

## Invariants

An invariant is a rule that must always hold.

Mandaloria invariants:

- [ ] A user cannot edit another user's content without permission.
- [ ] A banned user cannot post.
- [ ] A user cannot assign roles to themselves.
- [ ] A moderator cannot moderate an admin.
- [ ] A closed post does not accept comments.
- [ ] A Codex draft article is not public.
- [ ] A private channel does not appear to users without access.
- [ ] A deleted post does not appear in public feeds.
- [ ] A private file does not have a permanent public URL.
- [ ] Every sensitive change is audited.

Where to apply invariants:

- database;
- RLS;
- server actions/API;
- tests;
- UI as aid, not as primary security.

## Minimum data

Rule:

Do not load what is not used.

Checklist:

- [ ] Select necessary columns, not `select *`.
- [ ] Do not send emails to the public frontend.
- [ ] Do not send internal notes to the normal client.
- [ ] Do not send full permissions if only a boolean is needed.
- [ ] Do not load all comments at once.
- [ ] Do not load all chat history.
- [ ] Do not load original images if an optimized version exists.
- [ ] Do not render hidden content and hide it with CSS.

## Normalization and denormalization

Normalizing reduces inconsistencies. Denormalizing improves speed when used well.

Normalize:

- users;
- roles;
- permissions;
- posts;
- comments;
- reactions;
- reports;
- clans;
- articles.

Denormalize with care:

- comment count;
- like count;
- dislike count;
- last post activity;
- clan member count;
- aggregate reputation.

Rules:

- [ ] Do not denormalize until there is a clear reason.
- [ ] If denormalizing, define source of truth.
- [ ] If there are counters, define how they are recalculated.
- [ ] If there is drift, have a repair job or function.

## Algorithmic complexity

Avoid work that grows badly.

Checklist:

- [ ] Feeds use pagination.
- [ ] Comments use pagination.
- [ ] Chat uses pagination/cursor.
- [ ] Search uses indexes.
- [ ] Permissions do not traverse huge lists in memory.
- [ ] Avoid nested loops over large lists.
- [ ] Avoid recalculating counts for each item.
- [ ] Avoid N+1 queries.
- [ ] Use joins or RPCs when they reduce database round trips.

Practical rule:

If a page shows 20 posts, it should not do 1 query per post for author, likes, comments and permissions. It should bring the necessary data in grouped queries.

## Idempotency

Repeated actions must not break data.

Examples:

- liking twice does not create two likes;
- unliking twice does not fail dangerously;
- reporting many times is grouped or limited;
- accepting an already accepted invitation does not duplicate membership;
- restoring already restored content does not create a weird state.

Checklist:

- [ ] Use unique constraints where applicable.
- [ ] Use upsert when it makes sense.
- [ ] Repeated actions have controlled results.
- [ ] Forms prevent double submission.

## Transactions

Use transactions when several things must change together.

Examples:

- create post and update counter;
- react and update reputation;
- ban user and close sessions/log;
- accept clan invite and create membership;
- publish article and create version.

Checklist:

- [ ] Do not leave data half-way.
- [ ] Use SQL/RPC functions for atomic operations if convenient.
- [ ] Logs are written alongside the sensitive action.

## Caching

Cache stable reads, not sensitive permissions without care.

Good candidate:

- published Codex articles;
- public plaza list;
- public settings;
- public profiles;
- aggregate counts.

Bad candidate:

- admin permissions;
- private channels;
- reports;
- moderation notes;
- private user data.

Checklist:

- [ ] Cache has clear invalidation.
- [ ] Cache does not mix private data between users.
- [ ] Cache respects role/visibility.
- [ ] Do not cache responses with secrets.

## Rendering and frontend

Rules:

- [ ] Small and predictable components.
- [ ] Do not recalculate large lists on every render.
- [ ] Virtualize long lists if needed.
- [ ] Debounce search.
- [ ] Throttle repeated actions.
- [ ] Lazy load for heavy modals/panels.
- [ ] Images with defined dimensions.
- [ ] Avoid layout shift.
- [ ] Avoid hydrating components that could be server-rendered.

## Error handling

`try/catch` is not bad. What is bad is using errors as massive normal flow or hiding failures.

Rules:

- [ ] Validate before executing.
- [ ] Use typed errors or known codes.
- [ ] Public messages do not leak internal details.
- [ ] Internal logs have enough context.
- [ ] Expected errors have clear UI.
- [ ] Do not retry infinitely.

## Simple code

Checklist:

- [ ] One function does one clear thing.
- [ ] Names explain the domain.
- [ ] Avoid premature abstractions.
- [ ] Reuse existing patterns.
- [ ] Avoid duplicating business rules.
- [ ] Avoid boolean flags that create many hidden modes.
- [ ] Prefer enums/clear states.
- [ ] Prefer constraints over comments.
- [ ] Prefer structured data over magic strings.

## Security by simplicity

Recommended patterns:

- [ ] Deny by default.
- [ ] Allowlist before blocklist.
- [ ] Explicit states before ambiguous booleans.
- [ ] Roles separated from social identity.
- [ ] Permissions separated from UI.
- [ ] A single path for sensitive actions.
- [ ] Automatic logs for admin/mod.
- [ ] Inputs validated at system boundary.

## Metrics to watch

- [ ] Initial load time.
- [ ] Feed load time.
- [ ] Post load time.
- [ ] Comment creation time.
- [ ] Reaction time.
- [ ] Search time.
- [ ] Number of queries per page.
- [ ] JS weight sent.
- [ ] Image weight.
- [ ] Errors per route.
- [ ] Rate limit hits.
- [ ] Reports/spam per user.

## Checklist before adding a feature

- [ ] The feature has a clear goal.
- [ ] The feature has clear actors.
- [ ] The feature has clear states.
- [ ] The feature has clear permissions.
- [ ] The feature has clear minimum data.
- [ ] The feature has clear edge cases.
- [ ] The feature does not duplicate another feature.
- [ ] The feature can be done in a simple version first.
- [ ] The feature does not expose private data.
- [ ] The feature can be moderated.

## Checklist before optimizing

- [ ] There is real measurement.
- [ ] The bottleneck is known.
- [ ] Queries were reviewed.
- [ ] Indexes were reviewed.
- [ ] Payload was reviewed.
- [ ] Render was reviewed.
- [ ] Images were reviewed.
- [ ] Cache was reviewed.
- [ ] The optimization does not break clarity.
- [ ] The optimization does not weaken security.
