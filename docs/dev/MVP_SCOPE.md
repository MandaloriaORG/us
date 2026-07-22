# MVP Scope

## MVP Goal

Create a first usable version of Mandaloria as a knowledge and conversation community.

The MVP should not attempt to copy Reddit, Discord or XenForo entirely. It must cover the essential cycle:

1. a person registers;
2. creates their profile;
3. enters a plaza;
4. posts;
5. comments or replies;
6. reacts;
7. reports problematic content;
8. a moderator/admin reviews;
9. the Codex Libre contains essential public information.

## In MVP

- authentication with Supabase Auth;
- public profiles;
- basic roles;
- basic permissions;
- public plazas;
- posts;
- comments;
- simple replies;
- likes/dislikes;
- initially configured reactions;
- reports;
- basic moderation;
- minimum admin panel;
- basic Codex Libre with Markdown;
- simple search;
- soft delete;
- audit logs for sensitive actions.

## Not in MVP

- full real-time chat;
- private messages;
- advanced clan system;
- complex reputation;
- marketplace or plugins;
- advanced WYSIWYG;
- large attachments;
- mass email notifications;
- infinite nested comments;
- visual theme editor.

## Global MVP checklist

- [ ] Auth works with registration, login, logout and recovery.
- [ ] Profile is created automatically upon registration.
- [ ] User can edit their profile.
- [ ] Basic roles exist.
- [ ] Basic permissions exist.
- [ ] Plazas can be listed.
- [ ] Admin can create/edit plazas.
- [ ] User can create posts.
- [ ] User can edit their posts.
- [ ] User can delete their posts with soft delete.
- [ ] User can comment.
- [ ] User can reply to comments.
- [ ] User can edit their comments.
- [ ] User can delete their comments with soft delete.
- [ ] User can like/dislike.
- [ ] User can react with emoji/configured reaction.
- [ ] User can save posts.
- [ ] User can report content.
- [ ] Moderator can view reports.
- [ ] Moderator can hide/restore content.
- [ ] Admin can manage users basic.
- [ ] Admin can manage roles basic.
- [ ] Admin can create Codex Libre articles.
- [ ] Admin can edit Codex Libre articles in Markdown.
- [ ] Codex Libre displays public articles.
- [ ] RLS is enabled on sensitive tables.
- [ ] Admin/mod actions are logged in audit logs.
- [ ] Basic rate limit on posting/commenting/reacting/reporting.
