"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const userStatusSchema = z.enum(["active", "suspended", "banned"]);
const uuidSchema = z.string().uuid();
const reasonSchema = z.string().trim().min(3).max(500);

const statusActionSchema = z.object({
  targetUserId: uuidSchema,
  expectedStatus: userStatusSchema,
  status: userStatusSchema,
  reason: reasonSchema,
});

const roleActionSchema = z.object({
  targetUserId: uuidSchema,
  roleId: uuidSchema,
  reason: reasonSchema,
});

export type CouncilUserStatus = z.infer<typeof userStatusSchema>;

export interface SetUserStatusInput {
  targetUserId: string;
  expectedStatus: CouncilUserStatus;
  status: CouncilUserStatus;
  reason: string;
}

export interface ChangeUserRoleInput {
  targetUserId: string;
  roleId: string;
  reason: string;
}

export type CouncilActionResult =
  | { ok: true; auditLogId: string }
  | {
      ok: false;
      code:
        | "access_denied"
        | "invalid_input"
        | "invalid_request"
        | "protected_last_administrator"
        | "retry";
      message: string;
    };

const INVALID_INPUT_RESULT: CouncilActionResult = {
  ok: false,
  code: "invalid_input",
  message: "Check the action details and try again.",
};

const RETRY_RESULT: CouncilActionResult = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

function databaseErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function databaseFailure(error: unknown): CouncilActionResult {
  switch (databaseErrorCode(error)) {
    case "42501":
      return {
        ok: false,
        code: "access_denied",
        message: "You do not have permission to make this change.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This change is not valid for the current account state.",
      };
    case "23514":
      return {
        ok: false,
        code: "protected_last_administrator",
        message: "The last Administrator role cannot be removed.",
      };
    default:
      return RETRY_RESULT;
  }
}

function mutationSuccess(auditLogId: unknown, targetUserId: string): CouncilActionResult {
  const parsedAuditLogId = uuidSchema.safeParse(auditLogId);
  if (!parsedAuditLogId.success) return RETRY_RESULT;

  for (const path of ["/council/users", `/council/users/${targetUserId}`]) {
    try {
      revalidatePath(path);
    } catch {
      // The database mutation is already committed; a cache failure must not invite a retry.
    }
  }

  return { ok: true, auditLogId: parsedAuditLogId.data };
}

export async function setUserStatus(input: SetUserStatusInput): Promise<CouncilActionResult> {
  const parsed = statusActionSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT_RESULT;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("council_set_user_status", {
      p_user_id: parsed.data.targetUserId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);
    return mutationSuccess(data, parsed.data.targetUserId);
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function assignUserRole(input: ChangeUserRoleInput): Promise<CouncilActionResult> {
  const parsed = roleActionSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT_RESULT;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("council_assign_user_role", {
      p_user_id: parsed.data.targetUserId,
      p_role_id: parsed.data.roleId,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);
    return mutationSuccess(data, parsed.data.targetUserId);
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function removeUserRole(input: ChangeUserRoleInput): Promise<CouncilActionResult> {
  const parsed = roleActionSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT_RESULT;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("council_remove_user_role", {
      p_user_id: parsed.data.targetUserId,
      p_role_id: parsed.data.roleId,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);
    return mutationSuccess(data, parsed.data.targetUserId);
  } catch (error) {
    return databaseFailure(error);
  }
}
