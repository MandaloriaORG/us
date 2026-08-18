"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Reaction-type administration (Council).
 *
 * Only `admin.manage_settings` reaches the RPCs, and the database re-checks it.
 * Activation is compare-and-swap against the state the administrator was shown
 * (`admin_set_reaction_type_active`), so a stale screen cannot silently
 * overwrite another administrator's toggle; every change is written to the
 * audit log by the RPC itself. This action only validates shape early enough to
 * keep a bad payload off the wire; it never decides authority.
 */

const reactionKeySchema = z
  .string({ invalid_type_error: "Enter a reaction key" })
  .transform((value) => value.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(2, "Key must be at least 2 characters")
      .max(32, "Key must be at most 32 characters")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  );

const upsertReactionTypeSchema = z.object({
  key: reactionKeySchema,
  label: z
    .string({ invalid_type_error: "Enter a label" })
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "Label must be at least 2 characters")
        .max(40, "Label must be at most 40 characters"),
    ),
  emoji: z
    .string({ invalid_type_error: "Enter an emoji" })
    .trim()
    .pipe(z.string().min(1, "Enter an emoji").max(8, "Emoji must be at most 8 characters")),
  affectsReputation: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const setReactionTypeActiveSchema = z.object({
  key: reactionKeySchema,
  expectedActive: z.boolean(),
  isActive: z.boolean(),
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters").max(500),
});

export type ReactionTypeActionResult =
  | { ok: true; key: string }
  | {
      ok: false;
      code:
        "access_denied" | "conflict" | "invalid_input" | "invalid_request" | "not_found" | "retry";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: ReactionTypeActionResult = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): ReactionTypeActionResult {
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

function databaseFailure(error: unknown): ReactionTypeActionResult {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  switch (code) {
    case "42501":
      return { ok: false, code: "access_denied", message: "You cannot manage reaction types." };
    case "P0002":
      return { ok: false, code: "not_found", message: "That reaction type no longer exists." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This reaction type changed while you were viewing it. Reload and try again.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This change is not valid for the reaction type's current state.",
      };
    case "23505":
      return {
        ok: false,
        code: "invalid_request",
        message: "Another reaction type already uses that key.",
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

export async function upsertReactionType(input: unknown): Promise<ReactionTypeActionResult> {
  const parsed = upsertReactionTypeSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_upsert_reaction_type", {
      p_key: parsed.data.key,
      p_label: parsed.data.label,
      p_emoji: parsed.data.emoji,
      p_affects_reputation: parsed.data.affectsReputation,
      p_sort_order: parsed.data.sortOrder,
    });

    if (error) return databaseFailure(error);

    const key = data?.[0]?.reaction_key;
    if (!key) return RETRY_RESULT;

    refresh(["/council/settings"]);
    return { ok: true, key };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setReactionTypeActive(input: unknown): Promise<ReactionTypeActionResult> {
  const parsed = setReactionTypeActiveSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_reaction_type_active", {
      p_key: parsed.data.key,
      p_expected_active: parsed.data.expectedActive,
      p_is_active: parsed.data.isActive,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    const key = data?.[0]?.reaction_key;
    if (!key) return RETRY_RESULT;

    refresh(["/council/settings"]);
    return { ok: true, key };
  } catch (error) {
    return databaseFailure(error);
  }
}
