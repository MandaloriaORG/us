# Phase 2 - Plazas, Posts and Comments

## Objective

Implement the Reddit-like core of Mandaloria.

## Plazas

- [x] List plazas.
- [x] View plaza detail.
- [x] Create plaza from admin. — `/council/plazas/new`, wired to `createPlaza`.
- [x] Edit plaza from admin. — `/council/plazas/[plazaId]`, wired to `updatePlaza`.
- [x] Archive plaza from admin. — same screen, CAS archive/reactivate wired to `setPlazaStatus`.
- [x] Configure visibility. — part of the same create/edit form.
- [ ] Configure per-plaza permissions. — `required_post_permission` has no UI to set it.

## Posts

- [x] Create post.
- [x] View post.
- [x] Edit own post.
- [x] Delete own post with soft delete.
- [x] List posts by plaza.
- [ ] Main feed. — the home route (`/`) is still the public marketing page; no cross-Plaza feed exists.
- [x] Pagination.
- [ ] Tags. — filtering an existing listing by tag works; there is no tag editor on compose/edit, so a member cannot assign a tag to their own post yet (`setPostTags` is unused).
- [x] Save/bookmark.
- [ ] Share link. — the post has a stable, canonical URL; there is no dedicated "copy link" control.

## Comments and replies

- [x] Create comment.
- [x] Reply to comment.
- [x] Edit own comment.
- [x] Delete own comment with soft delete.
- [x] Show replies.
- [x] Comment pagination.
- [ ] Copy direct link to comment.

## Likes, dislikes and reactions

- [x] Like on post.
- [x] Dislike on post.
- [x] Remove vote.
- [x] Change vote.
- [x] Emoji reaction / configured reaction on post.
- [x] Reaction on comment.
- [x] Prevent duplicate votes.
- [x] Update counters.

## Security

- [x] RLS for posts.
- [x] RLS for comments.
- [x] RLS for reactions.
- [x] Rate limit on creating post.
- [x] Rate limit on commenting.
- [x] Rate limit on reacting.
- [x] Sanitize Markdown or content.

## Done when

- [x] A user can post and comment.
- [x] A user can reply.
- [x] A user can react/vote.
- [x] A user only edits/deletes their own content.
- [x] Visitors only see public content.
