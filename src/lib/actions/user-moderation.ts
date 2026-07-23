"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Warnings and Council notes.
 *
 * The two records are opposites and must not be confused. A **warning** is
 * addressed to the member: they read it and they acknowledge it. A **note** is
 * addressed to other moderators and the subject can never read it.
 *
 * Authority is never decided here. `moderation_warn_user` re-checks
 * `moderation.warn` and refuses a self-warning or a protected target; the note
 * RPCs re-check `admin.view_users`, and only a note's own author may remove it.
 */

const uuidSchema = z.string().uuid();

/**
 * Control characters are stripped and newlines normalised, but the wording is
 * otherwise the moderator's. A warning is read by the member it is addressed
 * to, so its ceiling is higher than the 500 characters an audit reason allows;
 * the database truncates the audit copy rather than refusing the warning.
 */
function proseSchema(max: number, label: string) {
  return z
    .string({ invalid_type_error: `Enter ${label}` })
    .max(max + 500, `${label} is too long`)
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
        .min(3, `${label} must be at least 3 characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );
}

const warnUserSchema = z.object({
  userId: uuidSchema,
  reason: proseSchema(1000, "The warning"),
});

const addNoteSchema = z.object({
  userId: uuidSchema,
  body: proseSchema(2000, "The note"),
});

export type UserModerationResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: "access_denied" | "invalid_input" | "invalid_request" | "not_found" | "retry";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: UserModerationResult = {
  ok: false,
  code: "retry",
  message: "That could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): UserModerationResult {
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

function databaseFailure(error: unknown): UserModerationResult {
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
      return { ok: false, code: "not_found", message: "That is no longer available." };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "That is not valid for the current state.",
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

export async function warnUser(input: unknown): Promise<UserModerationResult> {
  const parsed = warnUserSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("moderation_warn_user", {
      p_user_id: parsed.data.userId,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    const warningId = data?.[0]?.warning_id;
    if (!warningId) return RETRY_RESULT;

    refresh([`/council/users/${parsed.data.userId}`]);
    return { ok: true, id: warningId };
  } catch (error) {
    return databaseFailure(error);
  }
}

/**
 * Acknowledging is the member saying they read it. It is not reversible and no
 * moderator can do it on their behalf, so this action takes nothing but the id.
 */
export async function acknowledgeWarning(warningId: unknown): Promise<UserModerationResult> {
  const parsed = uuidSchema.safeParse(warningId);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("acknowledge_warning", { p_warning_id: parsed.data });

    if (error) return databaseFailure(error);

    refresh(["/profile", "/"]);
    return { ok: true, id: parsed.data };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function addUserNote(input: unknown): Promise<UserModerationResult> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("council_add_user_note", {
      p_user_id: parsed.data.userId,
      p_body: parsed.data.body,
    });

    if (error) return databaseFailure(error);

    const noteId = data?.[0]?.note_id;
    if (!noteId) return RETRY_RESULT;

    refresh([`/council/users/${parsed.data.userId}`]);
    return { ok: true, id: noteId };
  } catch (error) {
    return databaseFailure(error);
  }
}

/**
 * The subject id is not sent: the database resolves it from the note, and only
 * the note's author may remove it. The caller passes it purely so the right
 * Council page can be refreshed.
 */
export async function deleteUserNote(
  noteId: unknown,
  subjectId?: unknown,
): Promise<UserModerationResult> {
  const parsed = uuidSchema.safeParse(noteId);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("council_delete_user_note", { p_note_id: parsed.data });

    if (error) return databaseFailure(error);

    const subject = uuidSchema.safeParse(subjectId);
    refresh(subject.success ? [`/council/users/${subject.data}`] : []);
    return { ok: true, id: parsed.data };
  } catch (error) {
    return databaseFailure(error);
  }
}
