# Initial Database Design

## Approach

The database should start simple, but prepared to grow.

Target stack:

- Supabase Auth for authentication.
- Supabase Postgres for main data.
- Supabase Storage for avatars and attachments.
- Row Level Security for permissions.

It should not attempt to copy all XenForo tables from the start. The priority is to have a clear structure for community, content, moderation, and customization.

The schema, RLS, functions, triggers, indexes, and reproducible configuration must live in versioned migrations. The complete strategy for changing projects without rebuilding Mandaloria lives in `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md`.

## Modules

The database can be separated into these modules:

- identity;
- community;
- content;
- moderation;
- chat;
- library;
- customization;
- system.

## Identity

Initial tables:

- profiles
- roles
- user_roles
- permissions
- role_permissions

Future tables:

- user_settings
- user_sessions
- login_attempts
- user_devices

## Community

Initial tables:

- clans
- clan_members
- ranks
- user_ranks
- badges
- user_badges

Future tables:

- clan_roles
- clan_role_members
- clan_invites
- clan_pages
- clan_responsibilities
- expeditions
- expedition_members
- expedition_sources
- reputation_events

`user_badges` must store assignment provenance: issuer, date, reason, evidence reference, visibility, status, and revocation. Private evidence is referenced without being copied to public profiles.

## Reddit-like Content

Initial tables:

- spaces
- posts
- comments
- tags
- post_tags
- reactions
- content_reactions
- bookmarks

Future tables:

- post_versions
- comment_versions
- pinned_posts
- saved_searches
- content_mentions

## Library

Initial tables:

- library_categories
- library_articles
- library_article_versions

Future tables:

- library_review_requests
- library_contributors
- library_references

Tables for the knowledge cycle:

- knowledge_proposals
- knowledge_proposal_sources
- knowledge_proposal_contributors
- knowledge_proposal_events
- library_discussions

## Chat

Initial tables:

- chat_channels
- chat_channel_members
- chat_messages

Future tables:

- chat_message_reactions
- chat_pinned_messages
- chat_read_receipts
- chat_mentions

## Moderation

Initial tables:

- reports
- moderation_queue
- moderator_actions
- user_warnings
- user_bans
- audit_logs

Future tables:

- spam_logs
- trust_scores
- moderation_notes
- content_appeals
- moderation_evidence

## Admin and Customization

Initial tables:

- site_settings
- theme_settings
- navigation_items

Future tables:

- custom_fields
- custom_field_values
- email_templates
- feature_flags
- admin_activity_logs
- site_setting_versions

## Files

Initial tables:

- attachments
- attachment_usage

Uses:

- avatars;
- clan/house emblems;
- images in posts;
- library attachments.

## System Events

Initial table when side effects exist:

- outbox_events

The main action and its event are written in the same transaction. Notifications, indexing, reputation, and statistics consume events idempotently and with retry capability.

## Recommended MVP

For the first version, the schema should include approximately these tables:

1. profiles
2. roles
3. user_roles
4. permissions
5. role_permissions
6. spaces
7. posts
8. comments
9. tags
10. post_tags
11. reactions
12. content_reactions
13. bookmarks
14. clans
15. clan_members
16. ranks
17. user_ranks
18. badges
19. user_badges
20. library_categories
21. library_articles
22. library_article_versions
23. reports
24. moderation_queue
25. moderator_actions
26. user_warnings
27. user_bans
28. audit_logs
29. chat_channels
30. chat_channel_members
31. chat_messages
32. site_settings
33. theme_settings
34. attachments
35. attachment_usage
36. friendships
37. friend_requests
38. notification_preferences

The knowledge cycle adds `knowledge_proposals`, `knowledge_proposal_sources`, `knowledge_proposal_contributors`, and `knowledge_proposal_events` in the Codex phase. `outbox_events` is added when introducing notifications, search, or asynchronous reputation.

This provides a solid foundation without yet falling into a system of 100+ tables.

## Important Technical Rules

- Use UUID as primary identifier.
- Use timestamps in main tables: created_at, updated_at.
- Use soft delete for community content.
- Model statuses with enums/check constraints and validated transitions.
- Index foreign keys and search columns.
- Prepare full-text search for posts and library.
- Define RLS from the start.
- Separate roles from permissions.
- Log sensitive actions in audit_logs.
- Keep exact records as source of truth and use counters only as quick views.
- Save configuration changes with previous value, new value, and responsible party.
- Use transactional outbox for side effects that need retries.

## Initial RLS

Conceptual rules:

- Anyone can read visible public content.
- Only authenticated users can post, comment, or react.
- Users can only edit their own content if it is not locked.
- Moderators can hide, close, or review content.
- Administrators can manage configuration, roles, and structure.
- Published library is public.
- Draft or under-review library is only visible to authorized roles.
- Knowledge proposals, sources, and attributions respect the visibility of the source content.
- Private channels are only visible to authorized members.
