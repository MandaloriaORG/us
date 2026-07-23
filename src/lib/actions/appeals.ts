"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Filing and deciding appeals.
 *
 * Authority is never decided here. `create_appeal` re-checks that the action is
 * appealable and was taken against the caller, that no live or decided appeal
 * already exists for it, and the rate limit; the Council RPCs re-check
 * `moderation.hide` and refuse the moderator who took the original action. This
 * module validates shape and maps database error codes onto stable result codes.
 *
 * Filing deliberately does not require an active account: a suspended or banned
 * member is exactly the person with something to argue about.
 *
 * Granting an appeal is a judgement, not a rollback. Undoing the action is a
 * separate moderation call with its own audit row, which is why nothing here
 * touches content.
 */

const uuidSchema = z.string().uuid();

const appealStatusSchema = z.enum(["open", "under_review", "granted", "denied"]);
const appealDecisionSchema = z.enum(["granted", "denied"]);

const bodySchema = z
  .string({ invalid_type_error: "Write your appeal" })
  .max(2500, "Your appeal is too long")
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
      .min(20, "Your appeal must be at least 20 characters")
      .max(2000, "Your appeal must be at most 2000 characters"),
  );

const decisionSchema = z
  .string({ invalid_type_error: "Give a reason" })
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Give a reason of at least 3 characters")
      .max(500, "The reason must be at most 500 characters"),
  );

const createAppealSchema = z.object({
  auditLogId: uuidSchema,
  body: bodySchema,
});

const claimAppealSchema = z.object({
  appealId: uuidSchema,
  expectedStatus: appealStatusSchema,
});

const resolveAppealSchema = z.object({
  appealId: uuidSchema,
  expectedStatus: appealStatusSchema,
  status: appealDecisionSchema,
  decision: decisionSchema,
});

export type AppealActionResult =
  | { ok: true; appealId: string }
  | {
      ok: false;
      code:
        | "access_denied"
        | "conflict"
        | "duplicate"
        | "invalid_input"
        | "invalid_request"
        | "not_found"
        | "rate_limited"
        | "retry";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: AppealActionResult = {
  ok: false,
  code: "retry",
  message: "That could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): AppealActionResult {
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

function databaseFailure(error: unknown): AppealActionResult {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "42501":
      return { ok: false, code: "access_denied", message: "You cannot do this." };
    case "P0002":
      return { ok: false, code: "not_found", message: "That is no longer available." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This changed while you were viewing it. Reload and try again.",
      };
    case "23505":
      return {
        ok: false,
        code: "duplicate",
        message: "You have already appealed this action.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "That is not valid for the current state.",
      };
    case "53400":
      return {
        ok: false,
        code: "rate_limited",
        message: "You have filed several appeals recently. Try again later.",
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

export async function createAppeal(input: unknown): Promise<AppealActionResult> {
  const parsed = createAppealSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_appeal", {
      p_audit_log_id: parsed.data.auditLogId,
      p_body: parsed.data.body,
    });

    if (error) return databaseFailure(error);

    const appealId = data?.[0]?.appeal_id;
    if (!appealId) return RETRY_RESULT;

    refresh(["/council/appeals"]);
    return { ok: true, appealId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function claimAppeal(input: unknown): Promise<AppealActionResult> {
  const parsed = claimAppealSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_claim_appeal", {
      p_appeal_id: parsed.data.appealId,
      p_expected_status: parsed.data.expectedStatus,
    });

    if (error) return databaseFailure(error);

    refresh(["/council/appeals", `/council/appeals/${parsed.data.appealId}`]);
    return { ok: true, appealId: parsed.data.appealId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function resolveAppeal(input: unknown): Promise<AppealActionResult> {
  const parsed = resolveAppealSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_resolve_appeal", {
      p_appeal_id: parsed.data.appealId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_decision: parsed.data.decision,
    });

    if (error) return databaseFailure(error);

    refresh(["/council/appeals", `/council/appeals/${parsed.data.appealId}`]);
    return { ok: true, appealId: parsed.data.appealId };
  } catch (error) {
    return databaseFailure(error);
  }
}
