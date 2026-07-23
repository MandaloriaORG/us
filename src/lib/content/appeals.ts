import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "@/lib/content/cursor";
import type { AppealStatus } from "@/lib/content/appeal-labels";

/**
 * Read paths for appeals.
 *
 * `moderation_appeals` carries no grant, so every read is a SECURITY DEFINER
 * RPC. The member-facing pair (`list_own_moderation_actions`, `list_own_appeals`)
 * resolves the member from the session and takes no id: there is deliberately no
 * way to ask for somebody else's sanctions or arguments from this module. The
 * two Council reads re-check `moderation.hide`.
 *
 * A failed read is an empty result, never a thrown page: a database message must
 * not reach a UI, and a refusal is indistinguishable from having nothing.
 */

type Functions = Database["public"]["Functions"];

/**
 * Type generation cannot infer nullability for `RETURNS TABLE` columns. An
 * action may carry no reason, an action with no appeal yet has neither appeal
 * column, an undecided appeal has no decision, and any display name is null once
 * that account is removed.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export {
  APPEAL_STATUSES,
  APPEAL_STATUS_LABELS,
  APPEALABLE_ACTION_LABELS,
  appealActionLabel,
  parseAppealStatus,
} from "@/lib/content/appeal-labels";
export type { AppealStatus } from "@/lib/content/appeal-labels";

export type OwnModerationAction = Nullable<
  Functions["list_own_moderation_actions"]["Returns"][number],
  "reason" | "appeal_id" | "appeal_status"
>;

export type OwnAppeal = Nullable<
  Functions["list_own_appeals"]["Returns"][number],
  "decision" | "decided_at"
>;

export type AppealSummary = Nullable<
  Functions["moderation_list_appeals"]["Returns"][number],
  "appellant_display_name"
>;

export type AppealDetail = Nullable<
  Functions["moderation_get_appeal"]["Returns"][number],
  | "action_reason"
  | "action_actor_id"
  | "action_actor_display_name"
  | "appellant_display_name"
  | "decision"
  | "decided_by"
  | "decided_at"
>;

export const APPEAL_PAGE_SIZE = 25;

export interface AppealPage {
  items: AppealSummary[];
  nextCursor: string | null;
}

export async function listOwnModerationActions(): Promise<OwnModerationAction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_moderation_actions", {});
  if (error) return [];
  return (data ?? []) as OwnModerationAction[];
}

export async function listOwnAppeals(): Promise<OwnAppeal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_appeals");
  if (error) return [];
  return (data ?? []) as OwnAppeal[];
}

export interface ListAppealsOptions {
  status?: AppealStatus | null;
  cursor?: string | null;
  pageSize?: number;
}

export async function listAppeals(options: ListAppealsOptions = {}): Promise<AppealPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? APPEAL_PAGE_SIZE, 1), 100);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_list_appeals", {
    // Every status means SQL NULL, which the RPC reads as "no filter"; omitting
    // the argument would apply its `open` default instead. Type generation
    // cannot express a nullable argument, hence the assertion.
    p_status: (options.status === undefined ? "open" : options.status) as AppealStatus,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return { items: [], nextCursor: null };

  const items = (data ?? []) as AppealSummary[];
  if (items.length < pageSize) return { items, nextCursor: null };

  const last = items[items.length - 1];
  return {
    items,
    nextCursor: encodeCursor({ createdAt: last.created_at, id: last.appeal_id }),
  };
}

export async function getAppeal(appealId: string): Promise<AppealDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_get_appeal", { p_appeal_id: appealId });
  if (error) return null;
  return (data?.[0] as AppealDetail | undefined) ?? null;
}
