/**
 * Fallback slug derivation for the Council editor's "slug is optional" field.
 *
 * Mirrors `private.slugify` in migration 0015 so the redirect after a create
 * can predict the slug the database assigned. The database is still the
 * authority: a duplicate slug fails there with a unique violation, and the
 * Archivist is told to pick another one.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The article/category slug shape enforced by migrations 0015. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(value: string, min = 2, max = 80): boolean {
  return SLUG_PATTERN.test(value) && value.length >= min && value.length <= max;
}
