"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Write paths for posts, comments and engagement.
 *
 * Authority is never decided here. Every mutation calls an RPC that re-checks
 * the actor, the permission, the target's state and the rate limit inside the
 * database transaction; this module validates shape, maps database error codes
 * onto stable result codes, and refreshes the affected routes. A client that
 * skips these actions and calls the RPC directly gets exactly the same answer.
 */

const uuidSchema = z.string().uuid();

const titleSchema = z
  .string({ invalid_type_error: "Enter a title" })
  .max(300, "Title must be at most 300 characters")
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(300, "Title must be at most 300 characters"),
  );

/**
 * Control characters are stripped and newlines normalised, but Markdown is left
 * intact: it is stored as written and sanitised when it is rendered, so the
 * source a member can edit is the source they typed.
 */
function bodySchema(max: number, label: string) {
  return z
    .string({ invalid_type_error: `Enter ${label}` })
    .max(max + 1000, `${label} is too long`)
    .transform((value) =>
      value
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(1, `${label} cannot be empty`)
        .max(max, `${label} must be at most ${max} characters`),
    );
}

const postBodySchema = bodySchema(40_000, "Post body");
const commentBodySchema = bodySchema(10_000, "Comment");

const tagSlugSchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(2, "A tag must be at least 2 characters")
      .max(32, "A tag must be at most 32 characters")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  );

const voteSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

const createPostSchema = z.object({
  plazaId: uuidSchema,
  title: titleSchema,
  body: postBodySchema,
  publish: z.boolean().default(true),
});

const updatePostSchema = z.object({
  postId: uuidSchema,
  title: titleSchema,
  body: postBodySchema,
});

const createCommentSchema = z.object({
  postId: uuidSchema,
  body: commentBodySchema,
  parentId: uuidSchema.nullable().default(null),
});

const updateCommentSchema = z.object({
  commentId: uuidSchema,
  body: commentBodySchema,
});

const setTagsSchema = z.object({
  postId: uuidSchema,
  tagSlugs: z.array(tagSlugSchema).max(5, "A post accepts at most 5 tags"),
});

export type ContentActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code:
        | "access_denied"
        | "invalid_input"
        | "invalid_request"
        | "not_found"
        | "rate_limited"
        | "retry";
      message: string;
      /** Field-level messages, present only when validation rejected the input. */
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
} as const;

function invalidInput(error: z.ZodError): ContentActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  return {
    ok: false,
    code: "invalid_input",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function databaseFailure(error: unknown): ContentActionResult<never> {
  switch (databaseErrorCode(error)) {
    case "42501":
      return {
        ok: false,
        code: "access_denied",
        message: "You do not have permission to do this.",
      };
    case "P0002":
      return {
        ok: false,
        code: "not_found",
        message: "That content is no longer available.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This change is not valid for the current state.",
      };
    case "53400":
      return {
        ok: false,
        code: "rate_limited",
        message: "You have done that too many times. Wait a moment and try again.",
      };
    default:
      return RETRY_RESULT;
  }
}

/**
 * The mutation is already committed by the time the cache is refreshed, so a
 * revalidation fault must never be reported as a failed write.
 */
function refresh(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Intentionally ignored; see above.
    }
  }
}

export async function createPost(input: unknown): Promise<ContentActionResult<{ postId: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_post", {
      p_plaza_id: parsed.data.plazaId,
      p_title: parsed.data.title,
      p_body: parsed.data.body,
      p_publish: parsed.data.publish,
    });

    if (error) return databaseFailure(error);

    const postId = data?.[0]?.post_id;
    if (!postId) return RETRY_RESULT;

    refresh(["/plazas", `/plazas/${parsed.data.plazaId}`]);
    return { ok: true, postId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function updatePost(input: unknown): Promise<ContentActionResult<{ postId: string }>> {
  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_own_post", {
      p_post_id: parsed.data.postId,
      p_title: parsed.data.title,
      p_body: parsed.data.body,
    });

    if (error) return databaseFailure(error);

    refresh([`/posts/${parsed.data.postId}`]);
    return { ok: true, postId: parsed.data.postId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function deletePost(input: unknown): Promise<ContentActionResult<{ postId: string }>> {
  const parsed = uuidSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_own_post", { p_post_id: parsed.data });
    if (error) return databaseFailure(error);

    refresh(["/plazas", `/posts/${parsed.data}`]);
    return { ok: true, postId: parsed.data };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setPostTags(
  input: unknown,
): Promise<ContentActionResult<{ tagSlugs: string[] }>> {
  const parsed = setTagsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_own_post_tags", {
      p_post_id: parsed.data.postId,
      p_tag_slugs: parsed.data.tagSlugs,
    });

    if (error) return databaseFailure(error);

    refresh([`/posts/${parsed.data.postId}`]);
    return { ok: true, tagSlugs: (data ?? []).map((row) => row.tag_slug) };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function createComment(
  input: unknown,
): Promise<ContentActionResult<{ commentId: string }>> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_comment", {
      p_post_id: parsed.data.postId,
      p_body: parsed.data.body,
      p_parent_id: parsed.data.parentId ?? undefined,
    });

    if (error) return databaseFailure(error);

    const commentId = data?.[0]?.comment_id;
    if (!commentId) return RETRY_RESULT;

    refresh([`/posts/${parsed.data.postId}`]);
    return { ok: true, commentId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function updateComment(
  input: unknown,
): Promise<ContentActionResult<{ commentId: string }>> {
  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_own_comment", {
      p_comment_id: parsed.data.commentId,
      p_body: parsed.data.body,
    });

    if (error) return databaseFailure(error);
    return { ok: true, commentId: parsed.data.commentId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function deleteComment(
  input: unknown,
): Promise<ContentActionResult<{ commentId: string }>> {
  const parsed = uuidSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_own_comment", { p_comment_id: parsed.data });
    if (error) return databaseFailure(error);

    return { ok: true, commentId: parsed.data };
  } catch (error) {
    return databaseFailure(error);
  }
}

export interface VoteState {
  likesCount: number;
  dislikesCount: number;
  callerVote: number;
}

export async function setPostVote(
  postId: unknown,
  value: unknown,
): Promise<ContentActionResult<VoteState>> {
  const parsedId = uuidSchema.safeParse(postId);
  const parsedValue = voteSchema.safeParse(value);
  if (!parsedId.success) return invalidInput(parsedId.error);
  if (!parsedValue.success) return invalidInput(parsedValue.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_post_vote", {
      p_post_id: parsedId.data,
      p_value: parsedValue.data,
    });

    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    return {
      ok: true,
      likesCount: row.likes_count,
      dislikesCount: row.dislikes_count,
      callerVote: row.caller_vote,
    };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setCommentVote(
  commentId: unknown,
  value: unknown,
): Promise<ContentActionResult<VoteState>> {
  const parsedId = uuidSchema.safeParse(commentId);
  const parsedValue = voteSchema.safeParse(value);
  if (!parsedId.success) return invalidInput(parsedId.error);
  if (!parsedValue.success) return invalidInput(parsedValue.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_comment_vote", {
      p_comment_id: parsedId.data,
      p_value: parsedValue.data,
    });

    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    return {
      ok: true,
      likesCount: row.likes_count,
      dislikesCount: row.dislikes_count,
      callerVote: row.caller_vote,
    };
  } catch (error) {
    return databaseFailure(error);
  }
}

const reactionKeySchema = z
  .string()
  .trim()
  .min(1, "A reaction key is required")
  .regex(
    /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|[^\x00-\x7F]+)$/,
    "A reaction key is a slug or an emoji",
  )
  .max(64);

export interface ReactionState {
  reactionKey: string;
  total: number;
  callerReacted: boolean;
}

export async function togglePostReaction(
  postId: unknown,
  reactionKey: unknown,
): Promise<ContentActionResult<ReactionState>> {
  const parsedId = uuidSchema.safeParse(postId);
  const parsedKey = reactionKeySchema.safeParse(reactionKey);
  if (!parsedId.success) return invalidInput(parsedId.error);
  if (!parsedKey.success) return invalidInput(parsedKey.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_post_reaction", {
      p_post_id: parsedId.data,
      p_reaction_key: parsedKey.data,
    });

    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    return {
      ok: true,
      reactionKey: row.reaction_key,
      total: row.total,
      callerReacted: row.caller_reacted,
    };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function toggleCommentReaction(
  commentId: unknown,
  reactionKey: unknown,
): Promise<ContentActionResult<ReactionState>> {
  const parsedId = uuidSchema.safeParse(commentId);
  const parsedKey = reactionKeySchema.safeParse(reactionKey);
  if (!parsedId.success) return invalidInput(parsedId.error);
  if (!parsedKey.success) return invalidInput(parsedKey.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_comment_reaction", {
      p_comment_id: parsedId.data,
      p_reaction_key: parsedKey.data,
    });

    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    return {
      ok: true,
      reactionKey: row.reaction_key,
      total: row.total,
      callerReacted: row.caller_reacted,
    };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function toggleBookmark(
  postId: unknown,
): Promise<ContentActionResult<{ bookmarked: boolean }>> {
  const parsed = uuidSchema.safeParse(postId);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_bookmark", { p_post_id: parsed.data });
    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    refresh(["/bookmarks"]);
    return { ok: true, bookmarked: row.bookmarked };
  } catch (error) {
    return databaseFailure(error);
  }
}
