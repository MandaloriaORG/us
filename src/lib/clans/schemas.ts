import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const slugSchema = z
  .string({ invalid_type_error: "Enter a slug" })
  .transform((value) => value.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(2, "Slug must be at least 2 characters")
      .max(48, "Slug must be at most 48 characters")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  );

export const nameSchema = (max: number, label: string) =>
  z
    .string({ invalid_type_error: `Enter a ${label.toLowerCase()}` })
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, `${label} must be at least 2 characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

const CONTROL_CHARS = new RegExp(`[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]`, "g");

/** Optional multi-line text: normalises newlines, strips control characters
 * and turns an empty value into SQL NULL (matching the RPC contracts). */
export function optionalText(max: number, label: string) {
  return z
    .string()
    .max(max + 500, `${label} is too long`)
    .transform((value) => {
      const clean = value
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(CONTROL_CHARS, "")
        .trim();
      return clean.length === 0 ? null : clean;
    })
    .pipe(z.string().max(max, `${label} must be at most ${max} characters`).nullable())
    .nullable()
    .default(null);
}

/** A reason that will be written to the audit log: required and bounded. */
export const reasonSchema = z
  .string()
  .trim()
  .min(3, "Give a reason of at least 3 characters")
  .max(500, "Reason must be at most 500 characters");

export const clanPrivacySchema = z.enum(["open", "invite", "closed"], {
  invalid_type_error: "Choose who can join this clan",
});

export const clanStatusSchema = z.enum(["active", "archived"]);

export const clanMemberRoleSchema = z.enum(["leader", "officer", "member"]);

export const rankStatusSchema = z.enum(["active", "retired"]);

export const badgeStatusSchema = z.enum(["active", "retired"]);

export const evidenceVisibilitySchema = z.enum(["public", "private"]);

export const hexColorSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^#[0-9a-fA-F]{3,8}$/.test(value), {
    message: "Use a hex color like #aabbcc",
  })
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const internalPermissionsSchema = z
  .array(
    z
      .string()
      .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/, "Invalid permission name")
      .min(3)
      .max(60),
  )
  .default([]);
