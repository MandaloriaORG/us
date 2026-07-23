import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor, type ContentCursor } from "@/lib/content/cursor";

/**
 * Read paths for Plazas, posts and comments.
 *
 * Every read goes through a minimized SECURITY DEFINER RPC. The tables carry no
 * grant for `anon` or `authenticated`, so authority lives entirely in the
 * database and this module only shapes results and bounds pagination. A failed
 * read returns an empty page rather than throwing: the route decides whether
 * that is an empty state or an error, and a database fault must never leak its
 * message into a page.
 */

type Functions = Database["public"]["Functions"];

/**
 * Supabase type generation cannot infer nullability for the output columns of a
 * `RETURNS TABLE` function, so it types every one of them as non-null. The RPCs
 * deliberately blank the author and body of removed content, and a comment's
 * parent is null at the root of a thread. These aliases restore the truth at the
 * one boundary where it is known.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type PlazaSummary = Nullable<Functions["list_plazas"]["Returns"][number], "description">;
export type PlazaDetail = Nullable<
  Functions["get_plaza"]["Returns"][number],
  "description" | "rules"
>;
export type PostSummary = Nullable<Functions["list_posts"]["Returns"][number], "excerpt">;
export type PostDetail = Nullable<Functions["get_post"]["Returns"][number], "body">;
export type PostComment = Nullable<
  Functions["list_post_comments"]["Returns"][number],
  "author_id" | "author_display_name" | "body" | "parent_id"
>;
export type BookmarkSummary = Functions["list_own_bookmarks"]["Returns"][number];
export type ReactionType = Functions["list_reaction_types"]["Returns"][number];

export const POST_PAGE_SIZE = 25;
export const COMMENT_PAGE_SIZE = 50;
export const BOOKMARK_PAGE_SIZE = 25;

export type PostOrder = "recent" | "popular";

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function parsePostOrder(value: string | string[] | undefined): PostOrder {
  return value === "popular" ? "popular" : "recent";
}

function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null };
}

/**
 * A full page implies there may be another one. Requesting `pageSize` and
 * reporting the last row as the cursor avoids the extra count query that an
 * offset scheme would need, at the cost of one possible empty final page.
 */
function toPage<T>(
  rows: T[] | null,
  pageSize: number,
  cursorOf: (row: T) => ContentCursor,
): Page<T> {
  const items = rows ?? [];
  if (items.length < pageSize) return { items, nextCursor: null };

  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor(cursorOf(last)) };
}

export async function listPlazas(): Promise<PlazaSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_plazas");
  if (error) return [];
  return data ?? [];
}

export async function getPlaza(slug: string): Promise<PlazaDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_plaza", { p_slug: slug });
  if (error) return null;
  return data?.[0] ?? null;
}

export interface ListPostsOptions {
  plazaId?: string | null;
  order?: PostOrder;
  tagSlug?: string | null;
  cursor?: string | null;
  pageSize?: number;
}

export async function listPosts(options: ListPostsOptions = {}): Promise<Page<PostSummary>> {
  const pageSize = boundedPageSize(options.pageSize, POST_PAGE_SIZE, 50);
  const order = options.order ?? "recent";
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_posts", {
    p_plaza_id: options.plazaId ?? undefined,
    p_order: order,
    p_tag_slug: options.tagSlug ?? undefined,
    p_cursor_score: cursor?.score,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();

  return toPage(data, pageSize, (row) => ({
    createdAt: row.created_at,
    id: row.id,
    score: order === "popular" ? row.score : undefined,
  }));
}

export async function getPost(postId: string): Promise<PostDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_post", { p_post_id: postId });
  if (error) return null;
  return data?.[0] ?? null;
}

export interface ListCommentsOptions {
  cursor?: string | null;
  pageSize?: number;
}

export async function listPostComments(
  postId: string,
  options: ListCommentsOptions = {},
): Promise<Page<PostComment>> {
  const pageSize = boundedPageSize(options.pageSize, COMMENT_PAGE_SIZE, 100);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_post_comments", {
    p_post_id: postId,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();

  return toPage(data, pageSize, (row) => ({ createdAt: row.created_at, id: row.id }));
}

export async function listOwnBookmarks(
  options: ListCommentsOptions = {},
): Promise<Page<BookmarkSummary>> {
  const pageSize = boundedPageSize(options.pageSize, BOOKMARK_PAGE_SIZE, 50);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_bookmarks", {
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();

  return toPage(data, pageSize, (row) => ({
    createdAt: row.bookmarked_at,
    id: row.bookmark_id,
  }));
}

export async function listReactionTypes(): Promise<ReactionType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_reaction_types");
  if (error) return [];
  return data ?? [];
}

/**
 * Comments arrive as a flat, chronologically ordered page. Building the reply
 * tree in one pass keeps the page bounded and lets an orphaned reply — a reply
 * whose parent sits on an earlier page — surface at the root instead of
 * vanishing.
 */
export interface CommentNode extends PostComment {
  replies: CommentNode[];
}

export function buildCommentTree(comments: PostComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parent_id ? nodes.get(comment.parent_id) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function boundedPageSize(requested: number | undefined, fallback: number, max: number) {
  if (!Number.isInteger(requested) || requested === undefined) return fallback;
  return Math.min(Math.max(requested, 1), max);
}
