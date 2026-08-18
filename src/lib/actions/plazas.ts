"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Plaza administration.
 *
 * Only `admin.manage_plazas` reaches these RPCs, and the database re-checks it.
 * Archiving carries an expected status so two administrators acting on a stale
 * screen cannot silently overwrite each other, matching the Council status
 * contract, and every change is written to the audit log by the RPC itself.
 */

const uuidSchema = z.string().uuid();

const slugSchema = z
  .string({ invalid_type_error: "Enter a slug" })
  .transform((value) => value.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(2, "Slug must be at least 2 characters")
      .max(48, "Slug must be at most 48 characters")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  );

const nameSchema = z
  .string({ invalid_type_error: "Enter a name" })
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must be at most 80 characters"),
  );

function optionalText(max: number, label: string) {
  return z
    .string()
    .max(max + 500, `${label} is too long`)
    .transform((value) => {
      const clean = value
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim();
      return clean.length === 0 ? null : clean;
    })
    .pipe(z.string().max(max, `${label} must be at most ${max} characters`).nullable())
    .nullable()
    .default(null);
}

const visibilitySchema = z.enum(["public", "members", "private"], {
  invalid_type_error: "Choose who can see this Plaza",
});

const statusSchema = z.enum(["active", "archived"]);

const permissionSchema = z
  .string()
  .trim()
  .max(60, "Posting permission is not valid")
  .nullable()
  .default(null);

const createPlazaSchema = z.object({
  slug: slugSchema,
  name: nameSchema,
  description: optionalText(500, "Description"),
  visibility: visibilitySchema.default("public"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  requiredPostPermission: permissionSchema,
});

const updatePlazaSchema = z.object({
  plazaId: uuidSchema,
  slug: slugSchema,
  name: nameSchema,
  description: optionalText(500, "Description"),
  rules: optionalText(4000, "Rules"),
  visibility: visibilitySchema,
  sortOrder: z.number().int().min(0).max(10_000),
  requiredPostPermission: permissionSchema,
});

const setStatusSchema = z.object({
  plazaId: uuidSchema,
  expectedStatus: statusSchema,
  status: statusSchema,
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters").max(500),
});

export type PlazaActionResult =
  | { ok: true; plazaId: string }
  | {
      ok: false;
      code:
        "access_denied" | "conflict" | "invalid_input" | "invalid_request" | "not_found" | "retry";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: PlazaActionResult = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): PlazaActionResult {
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

function databaseFailure(error: unknown): PlazaActionResult {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "42501":
      return { ok: false, code: "access_denied", message: "You cannot manage Plazas." };
    case "P0002":
      return { ok: false, code: "not_found", message: "That Plaza no longer exists." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This Plaza changed while you were viewing it. Reload and try again.",
      };
    case "23505":
      return {
        ok: false,
        code: "invalid_request",
        message: "Another Plaza already uses that slug.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This change is not valid for the Plaza's current state.",
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

export async function createPlaza(input: unknown): Promise<PlazaActionResult> {
  const parsed = createPlazaSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_create_plaza", {
      p_slug: parsed.data.slug,
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? undefined,
      p_visibility: parsed.data.visibility,
      p_sort_order: parsed.data.sortOrder,
      p_required_post_permission: parsed.data.requiredPostPermission ?? undefined,
    });

    if (error) return databaseFailure(error);

    const plazaId = data?.[0]?.plaza_id;
    if (!plazaId) return RETRY_RESULT;

    refresh(["/plazas", "/council/plazas"]);
    return { ok: true, plazaId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function updatePlaza(input: unknown): Promise<PlazaActionResult> {
  const parsed = updatePlazaSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    // Clearing a description or the rules means sending SQL NULL, which the RPC
    // accepts. Supabase type generation cannot express a nullable argument, so
    // the null is asserted here rather than being turned into an empty string.
    const { error } = await supabase.rpc("admin_update_plaza", {
      p_plaza_id: parsed.data.plazaId,
      p_slug: parsed.data.slug,
      p_name: parsed.data.name,
      p_description: parsed.data.description as string,
      p_rules: parsed.data.rules as string,
      p_visibility: parsed.data.visibility,
      p_sort_order: parsed.data.sortOrder,
      p_required_post_permission: parsed.data.requiredPostPermission ?? undefined,
      p_clear_post_permission: parsed.data.requiredPostPermission === null,
    });

    if (error) return databaseFailure(error);

    refresh(["/plazas", `/plazas/${parsed.data.slug}`, "/council/plazas"]);
    return { ok: true, plazaId: parsed.data.plazaId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setPlazaStatus(input: unknown): Promise<PlazaActionResult> {
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_plaza_status", {
      p_plaza_id: parsed.data.plazaId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(["/plazas", "/council/plazas"]);
    return { ok: true, plazaId: parsed.data.plazaId };
  } catch (error) {
    return databaseFailure(error);
  }
}
