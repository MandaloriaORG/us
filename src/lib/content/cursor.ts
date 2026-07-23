/**
 * Keyset cursors for content listings.
 *
 * The listing RPCs paginate on `(created_at, id)`, and on `(score, created_at,
 * id)` when ordered by popularity. A cursor is therefore the last row of the
 * previous page, serialised so it can live in the URL alongside the rest of the
 * listing state.
 *
 * The encoded form is deliberately plain rather than opaque: it is not a
 * capability and grants nothing. Every field is re-validated on decode, and an
 * unparseable cursor degrades to the first page instead of raising, because a
 * hand-edited URL must not break a page.
 */

const CURSOR_SEPARATOR = "~";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ContentCursor {
  createdAt: string;
  id: string;
  /** Present only for popularity ordering. */
  score?: number;
}

export function encodeCursor(cursor: ContentCursor): string {
  const parts =
    cursor.score === undefined
      ? [cursor.createdAt, cursor.id]
      : [String(cursor.score), cursor.createdAt, cursor.id];

  return parts.join(CURSOR_SEPARATOR);
}

export function decodeCursor(value: string | null | undefined): ContentCursor | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) return null;

  const parts = value.split(CURSOR_SEPARATOR);
  if (parts.length !== 2 && parts.length !== 3) return null;

  const id = parts[parts.length - 1];
  const createdAt = parts[parts.length - 2];
  if (!UUID_PATTERN.test(id)) return null;
  if (!isValidTimestamp(createdAt)) return null;

  if (parts.length === 2) return { createdAt, id };

  const score = Number(parts[0]);
  if (!Number.isSafeInteger(score)) return null;

  return { createdAt, id, score };
}

function isValidTimestamp(value: string) {
  if (value.length < 10 || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}
