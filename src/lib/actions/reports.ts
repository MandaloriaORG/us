"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { REPORT_REASONS, REPORT_STATUSES } from "@/lib/content/report-reasons";
import { createClient } from "@/lib/supabase/server";

/**
 * Filing and resolving reports.
 *
 * Filing changes nothing about the reported content; it records a claim. Acting
 * on that claim is a separate moderation action with its own permission.
 *
 * Authority is never decided here. `create_report` re-checks the actor, the
 * target's visibility, the self-report rule and the rate limit; the queue RPCs
 * re-check `moderation.hide`. This module validates shape and maps database
 * error codes onto stable result codes.
 */

const uuidSchema = z.string().uuid();

const reasonSchema = z.enum(REPORT_REASONS, {
  invalid_type_error: "Choose a reason",
  required_error: "Choose a reason",
});

const detailsSchema = z
  .string()
  .max(1500, "Details are too long")
  .transform((value) => {
    const clean = value
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim();
    return clean.length === 0 ? null : clean;
  })
  .pipe(z.string().max(1000, "Details must be at most 1000 characters").nullable())
  .nullable()
  .default(null);

/**
 * Exactly one target, checked here so an obviously malformed form never reaches
 * the database, and checked again there because that is where it matters.
 */
const createReportSchema = z
  .object({
    reason: reasonSchema,
    postId: uuidSchema.nullable().default(null),
    commentId: uuidSchema.nullable().default(null),
    profileId: uuidSchema.nullable().default(null),
    details: detailsSchema,
  })
  .refine(
    (value) =>
      [value.postId, value.commentId, value.profileId].filter((id) => id !== null).length === 1,
    { message: "Report exactly one item", path: ["form"] },
  );

const statusSchema = z.enum(REPORT_STATUSES);

const setReportStatusSchema = z
  .object({
    reportId: uuidSchema,
    expectedStatus: statusSchema,
    status: statusSchema,
    resolution: z.string().trim().max(500).nullable().default(null),
  })
  .refine(
    (value) =>
      value.status === "resolved" || value.status === "dismissed"
        ? (value.resolution?.length ?? 0) >= 3
        : true,
    { message: "Give a reason of at least 3 characters", path: ["resolution"] },
  );

export type ReportActionResult =
  | { ok: true; reportId: string }
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

const RETRY_RESULT: ReportActionResult = {
  ok: false,
  code: "retry",
  message: "That could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): ReportActionResult {
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

function databaseFailure(error: unknown): ReportActionResult {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "42501":
      return { ok: false, code: "access_denied", message: "You cannot do this." };
    case "P0002":
      return { ok: false, code: "not_found", message: "That content is no longer available." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "Another moderator changed this report. Reload and try again.",
      };
    case "23505":
      return {
        ok: false,
        code: "duplicate",
        message: "You already reported this. A moderator is looking at it.",
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
        message: "You have reported too much recently. Wait a moment and try again.",
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

export async function createReport(input: unknown): Promise<ReportActionResult> {
  const parsed = createReportSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    // The RPC takes SQL NULL for the two targets that were not chosen. Type
    // generation cannot express a nullable argument, so the nulls are asserted
    // here rather than being dropped, which would change which overload runs.
    const { data, error } = await supabase.rpc("create_report", {
      p_reason: parsed.data.reason,
      p_post_id: parsed.data.postId as string,
      p_comment_id: parsed.data.commentId as string,
      p_profile_id: parsed.data.profileId as string,
      p_details: parsed.data.details as string,
    });

    if (error) return databaseFailure(error);

    const reportId = data?.[0]?.report_id;
    if (!reportId) return RETRY_RESULT;

    // Nothing the reporter sees changes, so nothing is revalidated. Refreshing
    // the queue here would also tell a reporter their report landed.
    return { ok: true, reportId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setReportStatus(input: unknown): Promise<ReportActionResult> {
  const parsed = setReportStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_set_report_status", {
      p_report_id: parsed.data.reportId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_resolution: parsed.data.resolution as string,
    });

    if (error) return databaseFailure(error);

    refresh(["/council/reports", `/council/reports/${parsed.data.reportId}`]);
    return { ok: true, reportId: parsed.data.reportId };
  } catch (error) {
    return databaseFailure(error);
  }
}
