import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "@/lib/content/cursor";

/**
 * Read paths for warnings and Council notes.
 *
 * Neither table carries a grant, so every read is a SECURITY DEFINER RPC that
 * re-checks its own permission. `listOwnWarnings` resolves the member from the
 * session inside the database and takes no id — there is deliberately no way to
 * ask for somebody else's warnings from this module.
 *
 * There is no `listUserWarnings` for the Council either. A member's moderation
 * history is `council_list_audit_logs` filtered by target, which already
 * includes every warning; a second reader would be a second truth.
 */

type Functions = Database["public"]["Functions"];

/**
 * Type generation cannot infer nullability for `RETURNS TABLE` columns, so it
 * types every one as non-null. A warning is unacknowledged until the member
 * acknowledges it, and a note's author is nulled if that account is removed.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type OwnWarning = Nullable<
  Functions["list_own_warnings"]["Returns"][number],
  "acknowledged_at"
>;

export type UserNote = Nullable<
  Functions["council_list_user_notes"]["Returns"][number],
  "actor_id" | "actor_display_name"
>;

export const NOTE_PAGE_SIZE = 25;

export interface NotePage {
  items: UserNote[];
  nextCursor: string | null;
}

export async function listOwnWarnings(): Promise<OwnWarning[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_warnings");
  if (error) return [];
  return (data ?? []) as OwnWarning[];
}

/** How many of the reader's own warnings still need acknowledging. */
export async function countUnacknowledgedWarnings(): Promise<number> {
  const warnings = await listOwnWarnings();
  return warnings.filter((warning) => warning.acknowledged_at === null).length;
}

export interface ListUserNotesOptions {
  cursor?: string | null;
  pageSize?: number;
}

export async function listUserNotes(
  userId: string,
  options: ListUserNotesOptions = {},
): Promise<NotePage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? NOTE_PAGE_SIZE, 1), 100);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("council_list_user_notes", {
    p_user_id: userId,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return { items: [], nextCursor: null };

  const items = (data ?? []) as UserNote[];
  if (items.length < pageSize) return { items, nextCursor: null };

  const last = items[items.length - 1];
  return {
    items,
    nextCursor: encodeCursor({ createdAt: last.created_at, id: last.note_id }),
  };
}
