import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Edit history for a post or a comment.
 *
 * `content_revisions` carries no grant, so the read is a SECURITY DEFINER RPC
 * that requires being the item's author or holding `moderation.hide`. Anyone
 * else is told the content does not exist rather than that it is forbidden, so
 * an id cannot be used to probe for edits.
 *
 * The history is bounded to the 50 most recent revisions per item, trimmed as
 * they are written. A caller asking for more gets the bound, not an error.
 */

type Functions = Database["public"]["Functions"];

/**
 * Type generation cannot infer nullability for `RETURNS TABLE` columns. A
 * comment revision has no title, and the editor is nulled if that account is
 * removed — the revision itself survives, because it is evidence about the
 * content rather than about the account.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type ContentRevision = Nullable<
  Functions["list_content_revisions"]["Returns"][number],
  "title" | "editor_id" | "editor_display_name"
>;

export const REVISION_LIMIT = 50;

async function listRevisions(
  args: { p_post_id?: string; p_comment_id?: string },
  limit: number,
): Promise<ContentRevision[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_content_revisions", {
    ...args,
    p_limit: Math.min(Math.max(limit, 1), REVISION_LIMIT),
  });

  // A refused or missing read is an empty history, not a thrown page: the
  // caller decides whether that means "never edited" or "not yours to see",
  // and a database message must never reach a page.
  if (error) return [];
  return (data ?? []) as ContentRevision[];
}

export function listPostRevisions(
  postId: string,
  limit = REVISION_LIMIT,
): Promise<ContentRevision[]> {
  return listRevisions({ p_post_id: postId }, limit);
}

export function listCommentRevisions(
  commentId: string,
  limit = REVISION_LIMIT,
): Promise<ContentRevision[]> {
  return listRevisions({ p_comment_id: commentId }, limit);
}
