import Link from "next/link";
import { notFound } from "next/navigation";

import { getCouncilReportAccess } from "@/app/council/access";
import { CopyLinkButton } from "@/components/system/copy-link-button";
import { ReportControl } from "@/components/system/report-control";
import { renderMarkdown } from "@/lib/content/markdown";
import {
  buildCommentTree,
  getPost,
  listPlazas,
  listPostComments,
  listReactionTypes,
} from "@/lib/content/queries";
import { formatRelativeTime } from "@/lib/time";

import { CommentThread } from "./comment-thread";
import { PostEngagement } from "./post-engagement";
import { PostModerationPanel } from "./post-moderation-panel";
import { PostOwnerActions } from "./post-owner-actions";

/**
 * Post detail with its comment thread.
 *
 * DATA CONTRACT — implemented:
 * - `get_post` returns nothing when the post is invisible to the caller, which
 *   becomes a 404. A removed post stays addressable but arrives with `body` set
 *   to null, so its replies keep their context; the tombstone below is where
 *   that is rendered.
 * - `accepts_comments`, `can_edit`, `caller_vote` and `caller_bookmarked` are
 *   all computed server-side. They drive what the UI offers; they are never the
 *   authority, because every mutation RPC re-checks them.
 * - `list_post_comments` returns a flat, chronological, cursor-paginated page.
 *   `buildCommentTree` nests it, and a reply whose parent sits on an earlier
 *   page surfaces at the root rather than disappearing.
 *
 * DESIGN — implemented by this file and its client subcomponents:
 * - The body is Markdown, rendered through `renderMarkdown`; only the
 *   surrounding layout is new here.
 * - Vote controls (`VoteControl`) have an accessible pressed state, a label
 *   naming the target, and never rely on colour alone.
 * - The reaction control (`ReactionControl`) renders the configured catalog
 *   from `listReactionTypes()`. There is no read RPC for existing reaction
 *   totals/caller state, so a total only appears once this browser has
 *   toggled that key and the server has answered — a real data-contract gap,
 *   not something this page can fabricate honestly.
 * - Reply nesting is capped at depth 5 by the database (`node.depth`);
 *   indentation is capped visually and a left rail carries the rest of the
 *   nesting cue below 320px.
 * - A removed comment renders a quiet tombstone, not an error.
 * - Vote, reaction and bookmark are optimistic (`PostEngagement`,
 *   `CommentItem`). Creating, editing and deleting a post or comment are not:
 *   they wait for the server and then navigate or refresh.
 */
interface PostPageProps {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { postId } = await params;
  if (!UUID_PATTERN.test(postId)) notFound();

  const { cursor } = await searchParams;

  const post = await getPost(postId);
  if (!post) notFound();

  // `moderation.hide` is what every flag, move and lock RPC re-checks, so it is
  // also what decides whether the controls are worth rendering at all.
  const [comments, reactionTypes, moderationAccess] = await Promise.all([
    listPostComments(postId, { cursor: cursor ?? null }),
    listReactionTypes(),
    getCouncilReportAccess(),
  ]);

  const canModerate = moderationAccess.allowed;
  const plazas = canModerate ? await listPlazas() : [];

  const thread = buildCommentTree(comments.items);
  const removed = post.body === null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <p className="text-fg-muted text-sm">
        <Link href={`/plazas/${post.plaza_slug}`} className="hover:text-fg">
          {post.plaza_name}
        </Link>
      </p>

      <h1 className="text-fg mt-1 text-2xl font-semibold">{post.title}</h1>
      <p className="text-fg-subtle mt-1 text-sm">
        {post.author_display_name} · {formatRelativeTime(post.created_at)}
      </p>

      {removed ? (
        <div
          role="note"
          className="border-border text-fg-subtle mt-4 rounded-md border border-dashed px-4 py-3 text-sm italic"
        >
          This post was removed by its author.
        </div>
      ) : (
        // Safe by construction: `renderMarkdown` escapes the author's text before
        // emitting its own closed set of tags. See `src/lib/content/markdown.ts`.
        <div
          className="text-fg [&_a]:text-brand mt-4 max-w-none text-sm leading-relaxed [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:mt-3 [&_p:first-child]:mt-0"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body ?? "") }}
        />
      )}

      {post.tag_slugs.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {post.tag_slugs.map((slug) => (
            <li key={slug}>
              <Link
                href={`/plazas/${post.plaza_slug}?tag=${encodeURIComponent(slug)}`}
                className="border-border text-fg-muted hover:text-fg hover:border-border-raised duration-fast rounded-full border px-2.5 py-1 text-xs transition-colors"
              >
                {slug}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-border mt-5 border-t pt-4">
        <PostEngagement
          postId={post.id}
          initialLikes={post.likes_count}
          initialDislikes={post.dislikes_count}
          initialVote={post.caller_vote}
          initialBookmarked={post.caller_bookmarked}
          reactionTypes={reactionTypes}
        />
      </div>

      <div className="mt-3">
        <CopyLinkButton path={`/posts/${post.id}`} />
      </div>

      {post.can_edit ? (
        <div className="mt-4">
          <PostOwnerActions postId={post.id} plazaSlug={post.plaza_slug} />
        </div>
      ) : (
        <div className="mt-4">
          <ReportControl targetType="post" targetId={post.id} />
        </div>
      )}

      {canModerate ? (
        <PostModerationPanel
          postId={post.id}
          plazaId={post.plaza_id}
          status={post.status}
          isPinned={post.is_pinned}
          isHighlighted={post.is_highlighted}
          editLocked={post.edit_locked}
          plazas={plazas.map((plaza) => ({ id: plaza.id, name: plaza.name }))}
        />
      ) : null}

      <div className="border-border mt-8 border-t pt-6">
        <h2 className="text-fg text-lg font-semibold">Comments ({post.comments_count})</h2>

        <CommentThread
          postId={postId}
          thread={thread}
          reactionTypes={reactionTypes}
          acceptsComments={post.accepts_comments}
          nextCursor={comments.nextCursor}
          canModerate={canModerate}
        />
      </div>
    </main>
  );
}
