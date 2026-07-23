"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createComment } from "@/lib/actions/content";
import type { CommentNode, ReactionType } from "@/lib/content/queries";

import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

export interface CommentThreadProps {
  postId: string;
  thread: CommentNode[];
  reactionTypes: ReactionType[];
  acceptsComments: boolean;
  nextCursor: string | null;
}

/**
 * Top-level composer plus the nested comment list. Creating, editing and
 * deleting are never optimistic: each waits for the server's answer and then
 * calls `router.refresh()` so the thread re-renders from the same read path
 * every visitor sees, instead of a client-fabricated guess.
 */
export function CommentThread({
  postId,
  thread,
  reactionTypes,
  acceptsComments,
  nextCursor,
}: CommentThreadProps) {
  const router = useRouter();

  return (
    <div className="mt-4 flex flex-col gap-6">
      {acceptsComments ? (
        <CommentComposer
          id="new-comment"
          label="Add a comment"
          submitLabel="Post comment"
          placeholder="Add a comment…"
          onSubmit={(body) => createComment({ postId, body, parentId: null })}
          onSuccess={() => router.refresh()}
        />
      ) : (
        <p className="text-fg-muted text-sm">This post is closed to new comments.</p>
      )}

      {thread.length === 0 ? (
        <p className="text-fg-muted text-sm">No comments yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {thread.map((node) => (
            <CommentItem key={node.id} node={node} postId={postId} reactionTypes={reactionTypes} />
          ))}
        </ol>
      )}

      {nextCursor ? (
        <Link
          href={`/posts/${postId}?cursor=${encodeURIComponent(nextCursor)}`}
          className="text-brand text-sm underline-offset-4 hover:underline"
        >
          Load more comments
        </Link>
      ) : null}
    </div>
  );
}
