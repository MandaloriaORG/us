# Implementation Security

## Main rule

The frontend is never the source of truth for permissions.

Every sensitive action must be validated on the server, Supabase RLS or both.

## Global checklist

- [ ] RLS enabled on sensitive tables.
- [ ] RLS policies reviewed per table.
- [ ] Service role key never exposed to the client.
- [ ] Environment variables separated by environment.
- [ ] Input validation in actions/API.
- [ ] Markdown sanitization.
- [ ] Rate limiting on public actions.
- [ ] Soft delete on content.
- [ ] Audit logs on admin/mod actions.
- [ ] Admin route protection.
- [ ] Permissions do not depend on the visible role name.
- [ ] Users cannot change their own role.
- [ ] Moderators cannot act on admins.
- [ ] Private content does not appear in search.
- [ ] Storage limited by type and size.

## Tables with mandatory RLS

- profiles
- user_roles
- roles
- permissions
- role_permissions
- spaces
- posts
- comments
- content_reactions
- reports
- moderation_queue
- moderator_actions
- audit_logs
- clans
- clan_members
- library_articles
- library_article_versions
- chat_channels
- chat_messages
- notifications

## Actions that require audit log

- assign/remove role;
- change permissions;
- ban user;
- suspend user;
- hide/restore content;
- delete content as moderator/admin;
- publish/unpublish Codex article;
- restore Codex version;
- change site settings;
- change plaza/channel/clan visibility;
- change clan/house leader.

## Initial rate limits

- [ ] Create post.
- [ ] Comment.
- [ ] Reply.
- [ ] React.
- [ ] Report.
- [ ] Send friend request.
- [ ] Send chat message.
- [ ] Upload file.

## Secure defaults

- [ ] New users cannot upload large attachments.
- [ ] Unverified users cannot post.
- [ ] Private plazas do not appear to visitors.
- [ ] Private channels do not appear to non-members.
- [ ] Draft articles are not public.
- [ ] New roles have no permissions by default.
- [ ] Custom reactions do not affect reputation by default.
