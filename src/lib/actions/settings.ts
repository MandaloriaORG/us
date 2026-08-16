"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Site settings administration.
 *
 * Only `admin.manage_settings` reaches the RPC, and the database re-checks it.
 * Every write is compare-and-swap against the value the administrator was
 * shown, type-checked against the setting's stored type, bounds-checked for
 * numbers, and written to the audit log with both values. This action only
 * validates shape early enough to keep a bad payload off the wire; it never
 * decides authority.
 */

export const SETTING_VALUE_TYPES = ["string", "number", "boolean", "json", "array"] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

const KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9_]+)*$/;

const keySchema = z
  .string({ invalid_type_error: "Choose a setting." })
  .transform((value) => value.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(2, "Setting key is not valid.")
      .max(60, "Setting key is not valid.")
      .regex(KEY_PATTERN, "Setting key is not valid."),
  );

const valueTypeSchema = z.enum(SETTING_VALUE_TYPES, {
  invalid_type_error: "Choose a setting type.",
});

const updateSettingSchema = z.object({
  expectedValue: z.unknown(),
  key: keySchema,
  reason: z.string().trim().max(500, "Reason must be at most 500 characters").optional(),
  value: z.unknown(),
  valueType: valueTypeSchema,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Mirror the database's type gate so a mismatched payload fails with a readable
 * message instead of a generic database rejection.
 */
function typeMismatch(valueType: SettingValueType, value: unknown): string | null {
  switch (valueType) {
    case "string":
      return typeof value === "string" && value.length <= 2000
        ? null
        : "Enter text up to 2000 characters.";
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : "Enter a number.";
    case "boolean":
      return typeof value === "boolean" ? null : "Choose an option.";
    case "json":
      return isPlainObject(value) ? null : "Enter a JSON object.";
    case "array":
      return Array.isArray(value) ? null : "Enter a JSON array.";
  }
}

export type SettingActionResult =
  | { ok: true; key: string }
  | {
      ok: false;
      code:
        "access_denied" | "conflict" | "invalid_input" | "invalid_request" | "not_found" | "retry";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: SettingActionResult = {
  ok: false,
  code: "retry",
  message: "The setting could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): SettingActionResult {
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

function databaseFailure(error: unknown): SettingActionResult {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "42501":
      return { ok: false, code: "access_denied", message: "You cannot manage site settings." };
    case "P0002":
      return { ok: false, code: "not_found", message: "That setting no longer exists." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This setting changed while you were viewing it. Reload and try again.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This value is not valid for this setting.",
      };
    default:
      return RETRY_RESULT;
  }
}

export async function updateSiteSetting(input: unknown): Promise<SettingActionResult> {
  const parsed = updateSettingSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const valueError = typeMismatch(parsed.data.valueType, parsed.data.value);
  if (valueError) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { value: valueError },
    };
  }

  if (parsed.data.expectedValue !== undefined) {
    const expectedError = typeMismatch(parsed.data.valueType, parsed.data.expectedValue);
    if (expectedError) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Check the highlighted fields and try again.",
        fieldErrors: { expectedValue: expectedError },
      };
    }
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_site_setting", {
      p_key: parsed.data.key,
      p_value: parsed.data.value as Json,
      p_expected_value: parsed.data.expectedValue as Json | undefined,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(["/council/settings", "/"]);
    return { ok: true, key: parsed.data.key };
  } catch (error) {
    return databaseFailure(error);
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
