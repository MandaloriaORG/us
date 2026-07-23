"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";

import { ReactionControl } from "@/components/system/reaction-control";
import { ReportControl } from "@/components/system/report-control";
import { VoteControl } from "@/components/system/vote-control";
import { Button } from "@/components/ui/button";
import {
  createComment,
  deleteComment,
  setCommentVote,
  toggleCommentReaction,
  updateComment,
} from "@/lib/actions/content";
import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/content/markdown";
import type { CommentNode, ReactionType } from "@/lib/content/queries";
import { formatRelativeTime } from "@/lib/time";

import { CommentComposer } from "./comment-composer";
import { CommentModerationControl } from "./comment-moderation-control";

interface CommentItemProps {
  node: CommentNode;
  postId: string;
  reactionTypes: ReactionType[];
  /** `moderation.hide`, resolved server-side; the flag RPCs re-check it anyway. */
  canModerate?: boolean;
}

/**
 * One comment plus its replies, recursively. Depth is capped at 5 by the
 * database; indentation alone stops being legible well before that on a
 * narrow viewport, so it is capped visually and a left rail carries the rest
 * of the nesting cue instead of ever-shrinking margin.
 */
export function CommentItem({
  node,
  postId,
  reactionTypes,
  canModerate = false,
}: CommentItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const indent = Math.min(node.depth, 3);

  function requestDelete() {
    startDeleteTransition(async () => {
      const result = await deleteComment(node.id);
      if (!result.ok) {
        setDeleteError(result.message);
        setConfirmingDelete(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      style={indent > 0 ? { marginLeft: indent * 16 } : undefined}
      className={cn(node.depth > 0 && "border-border border-l pl-3")}
    >
      {node.is_removed ? (
        <div
          role="note"
          className="border-border text-fg-subtle rounded-md border border-dashed px-3 py-2 text-sm italic"
        >
          Comment removed
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-fg text-sm font-medium">{node.author_display_name}</span>
            <span className="text-fg-subtle text-xs">{formatRelativeTime(node.created_at)}</span>
          </div>

          {isEditing ? (
            <CommentComposer
              id={`edit-comment-${node.id}`}
              label={`Edit comment by ${node.author_display_name}`}
              submitLabel="Save"
              initialValue={node.body ?? ""}
              autoFocus
              onSubmit={(body) => updateComment({ commentId: node.id, body })}
              onSuccess={() => {
                setIsEditing(false);
                router.refresh();
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <div
              className="text-fg [&_a]:text-brand max-w-none text-sm [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:mt-2 [&_p:first-child]:mt-0"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(node.body ?? "", { maxLength: 10_000 }),
              }}
            />
          )}

          {!isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <VoteControl
                size="sm"
                targetLabel="comment"
                initialLikes={node.likes_count}
                initialDislikes={node.dislikes_count}
                initialVote={node.caller_vote}
                onVote={(value) => setCommentVote(node.id, value)}
              />
              <ReactionControl
                targetLabel="comment"
                reactionTypes={reactionTypes}
                onToggle={(key) => toggleCommentReaction(node.id, key)}
              />
              {node.can_reply ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsReplying((open) => !open)}
                >
                  Reply
                </Button>
              ) : null}
              {node.can_edit ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                  <PencilSimpleIcon aria-hidden="true" className="h-4 w-4" />
                  Edit
                </Button>
              ) : null}
              {node.can_edit && !confirmingDelete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  Delete
                </Button>
              ) : null}
              {!node.can_edit ? <ReportControl targetType="comment" targetId={node.id} /> : null}
              {canModerate ? (
                <CommentModerationControl
                  commentId={node.id}
                  isPinned={node.is_pinned}
                  repliesLocked={node.replies_locked}
                />
              ) : null}
            </div>
          ) : null}

          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg-muted text-xs">
                Delete this comment? This cannot be undone.
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                loading={isDeleting}
                disabled={isDeleting}
                onClick={requestDelete}
              >
                Confirm delete
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : null}
          {deleteError ? (
            <p role="alert" className="text-error text-xs">
              {deleteError}
            </p>
          ) : null}

          {isReplying ? (
            <CommentComposer
              id={`reply-${node.id}`}
              label={`Reply to ${node.author_display_name}`}
              submitLabel="Post reply"
              autoFocus
              onSubmit={(body) => createComment({ postId, body, parentId: node.id })}
              onSuccess={() => {
                setIsReplying(false);
                router.refresh();
              }}
              onCancel={() => setIsReplying(false)}
            />
          ) : null}
        </div>
      )}

      {node.replies.length > 0 ? (
        <ol className="mt-3 space-y-3">
          {node.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              node={reply}
              postId={postId}
              reactionTypes={reactionTypes}
              canModerate={canModerate}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
