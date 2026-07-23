"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Moderation transitions for posts and comments.
 *
 * Authority is never decided here. Each RPC resolves its own permission from
 * the destination state — hiding, quarantining, deleting and restoring are
 * different levels of authority over the same row — and re-checks it inside the
 * transaction. This module validates shape, maps database error codes onto
 * stable result codes and refreshes the affected routes.
 *
 * Every transition is compare-and-swap: the caller sends the state it displayed
 * and a stale submission comes back as `conflict` rather than overwriting
 * another moderator. Every transition also carries a reason, which the database
 * writes to the audit log; no removal here can be anonymous.
 */

const uuidSchema = z.string().uuid();

const reasonSchema = z
  .string({ invalid_type_error: "Give a reason" })
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Give a reason of at least 3 characters")
      .max(500, "The reason must be at most 500 characters"),
  );

/**
 * `draft` and `pending_review` are the author's workflow, not a moderation
 * outcome, so they are absent from both ends of the transition on purpose. The
 * database refuses them too.
 */
const postStatusSchema = z.enum([
  "draft",
  "pending_review",
  "published",
  "closed",
  "hidden",
  "quarantined",
  "deleted_by_author",
  "deleted_by_moderator",
  "archived",
]);

const postDestinationSchema = z.enum([
  "published",
  "closed",
  "hidden",
  "quarantined",
  "deleted_by_moderator",
  "archived",
]);

const commentStatusSchema = z.enum([
  "published",
  "hidden",
  "quarantined",
  "deleted_by_author",
  "deleted_by_moderator",
]);

const commentDestinationSchema = z.enum([
  "published",
  "hidden",
  "quarantined",
  "deleted_by_moderator",
]);

const setPostStatusSchema = z.object({
  postId: uuidSchema,
  expectedStatus: postStatusSchema,
  status: postDestinationSchema,
  reason: reasonSchema,
});

const setCommentStatusSchema = z.object({
  commentId: uuidSchema,
  expectedStatus: commentStatusSchema,
  status: commentDestinationSchema,
  reason: reasonSchema,
});

/** A null flag leaves that flag alone; all-null is refused by the database. */
const setPostFlagsSchema = z
  .object({
    postId: uuidSchema,
    reason: reasonSchema,
    isPinned: z.boolean().nullable().default(null),
    isHighlighted: z.boolean().nullable().default(null),
    editLocked: z.boolean().nullable().default(null),
  })
  .refine(
    (value) => value.isPinned !== null || value.isHighlighted !== null || value.editLocked !== null,
    { message: "Change at least one flag", path: ["form"] },
  );

const setCommentFlagsSchema = z
  .object({
    commentId: uuidSchema,
    reason: reasonSchema,
    isPinned: z.boolean().nullable().default(null),
    repliesLocked: z.boolean().nullable().default(null),
  })
  .refine((value) => value.isPinned !== null || value.repliesLocked !== null, {
    message: "Change at least one flag",
    path: ["form"],
  });

const movePostSchema = z.object({
  postId: uuidSchema,
  plazaId: uuidSchema,
  reason: reasonSchema,
});

export type ModerationActionResult =
  | { ok: true; targetId: string }
  | {
      ok: false;
      code:
        "access_denied" | "conflict" | "invalid_input" | "invalid_request" | "not_found" | "retry";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: ModerationActionResult = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): ModerationActionResult {
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

function databaseFailure(error: unknown): ModerationActionResult {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "42501":
      return {
        ok: false,
        code: "access_denied",
        message: "You do not have permission for that action.",
      };
    case "P0002":
      return { ok: false, code: "not_found", message: "That content no longer exists." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This changed while you were viewing it. Reload and try again.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "That is not a valid change for the current state.",
      };
    default:
      return RETRY_RESULT;
  }
}

function refresh(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // The mutation is committed; a cache failure must not invite a retry.
    }
  }
}

/** Moderation can change what a feed shows anywhere, so the sweep is broad. */
function refreshPost(postId: string) {
  refresh(["/", "/plazas", `/posts/${postId}`, "/council/reports"]);
}

function refreshComment(postId?: string) {
  refresh(postId ? [`/posts/${postId}`, "/council/reports"] : ["/council/reports"]);
}

export async function setPostStatus(input: unknown): Promise<ModerationActionResult> {
  const parsed = setPostStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_set_post_status", {
      p_post_id: parsed.data.postId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refreshPost(parsed.data.postId);
    return { ok: true, targetId: parsed.data.postId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setPostFlags(input: unknown): Promise<ModerationActionResult> {
  const parsed = setPostFlagsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    // A null means "leave this flag alone" and has to reach the RPC as SQL
    // NULL. Type generation cannot express a nullable argument, so it is
    // asserted here rather than being coerced into a false.
    const { error } = await supabase.rpc("moderation_set_post_flags", {
      p_post_id: parsed.data.postId,
      p_reason: parsed.data.reason,
      p_is_pinned: parsed.data.isPinned as boolean,
      p_is_highlighted: parsed.data.isHighlighted as boolean,
      p_edit_locked: parsed.data.editLocked as boolean,
    });

    if (error) return databaseFailure(error);

    refreshPost(parsed.data.postId);
    return { ok: true, targetId: parsed.data.postId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function movePost(input: unknown): Promise<ModerationActionResult> {
  const parsed = movePostSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_move_post", {
      p_post_id: parsed.data.postId,
      p_plaza_id: parsed.data.plazaId,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refreshPost(parsed.data.postId);
    return { ok: true, targetId: parsed.data.postId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setCommentStatus(input: unknown): Promise<ModerationActionResult> {
  const parsed = setCommentStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_set_comment_status", {
      p_comment_id: parsed.data.commentId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refreshComment();
    return { ok: true, targetId: parsed.data.commentId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setCommentFlags(input: unknown): Promise<ModerationActionResult> {
  const parsed = setCommentFlagsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_set_comment_flags", {
      p_comment_id: parsed.data.commentId,
      p_reason: parsed.data.reason,
      p_is_pinned: parsed.data.isPinned as boolean,
      p_replies_locked: parsed.data.repliesLocked as boolean,
    });

    if (error) return databaseFailure(error);

    refreshComment();
    return { ok: true, targetId: parsed.data.commentId };
  } catch (error) {
    return databaseFailure(error);
  }
}
