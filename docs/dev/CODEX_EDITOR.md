# Codex Editor

## Goal

The Codex Libre must allow creating and maintaining essential free and open information using Markdown.

The editor must be simple, secure and versioned.

## Roles

Admin:

- full control over articles, categories, versions and permissions.

Archivist:

- can create and edit articles according to permissions;
- can submit for review;
- can publish only if they have permission.

User:

- can read published articles;
- can suggest corrections;
- can save articles.

Visitor:

- can read public articles.

## Markdown Editor

- [ ] Title field.
- [ ] Slug field.
- [ ] Category selector.
- [ ] Markdown Editor.
- [ ] Markdown Preview.
- [ ] Save draft.
- [ ] Publish.
- [ ] Unpublish.
- [ ] Archive.
- [ ] Restore.
- [ ] Change/version message.
- [ ] Content validation.
- [ ] Output sanitization.

## Versions

- [ ] Create version when publishing.
- [ ] Create version when editing published content.
- [ ] Save author of each version.
- [ ] Save date of each version.
- [ ] Save change summary.
- [ ] View history.
- [ ] Compare versions if feasible.
- [ ] Restore previous version.

## Suggestions

- [ ] User can suggest correction.
- [ ] Archivist/admin can view suggestions.
- [ ] Archivist/admin can accept suggestion.
- [ ] Archivist/admin can reject suggestion.
- [ ] Accepted suggestion generates a version.

## Conversation Distillation

- [ ] Create proposal from eligible post, comment or message.
- [ ] Add multiple allowed sources.
- [ ] Detect related proposals and articles.
- [ ] Classify and assign proposal.
- [ ] Create draft from accepted proposal.
- [ ] Show sources as working notes, not as automatic public content.
- [ ] Confirm contributors and type of contribution.
- [ ] Allow public, anonymous or withdrawn attribution according to policy.
- [ ] Link article and conversation in both directions.
- [ ] Show secure provenance in published article.
- [ ] Follow states defined in `docs/KNOWLEDGE_LIFECYCLE.md`.

## Security

- [ ] Markdown is sanitized before rendering.
- [ ] Raw HTML is disabled or filtered by allowlist.
- [ ] External links use safe attributes.
- [ ] Images have restrictions.
- [ ] Scripts are blocked.
- [ ] Only authorized roles can write.
- [ ] Public reading only for published articles.

## States

- [ ] Draft.
- [ ] Under review.
- [ ] Published.
- [ ] Unpublished.
- [ ] Archived.
- [ ] Locked.

## Required data

- library_categories;
- library_articles;
- library_article_versions;
- library_suggestions;
- knowledge_proposals;
- knowledge_proposal_sources;
- knowledge_proposal_contributors;
- knowledge_proposal_events;
- library_discussions;
- audit_logs;
- attachments if images are allowed.
