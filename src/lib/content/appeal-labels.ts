import type { Database } from "@/lib/database.types";

/**
 * Appeal vocabulary, kept out of `appeals.ts` because that module is
 * `server-only` and these names are needed on both sides of the boundary — the
 * same split `report-reasons.ts` makes for reports.
 *
 * The action list mirrors `private.appealable_actions()` in migration 0013.
 * Nothing here decides what may be appealed; it only names what already can be.
 */

export type AppealStatus = Database["public"]["Enums"]["appeal_status"];

export const APPEAL_STATUSES = ["open", "under_review", "granted", "denied"] as const;

export const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  open: "Open",
  under_review: "Under review",
  granted: "Granted",
  denied: "Denied",
};

export const APPEALABLE_ACTION_LABELS: Record<string, string> = {
  "user.warned": "Warning",
  "user.suspended": "Suspension",
  "user.banned": "Ban",
  "post.status": "Post removed or hidden",
  "comment.status": "Comment removed or hidden",
  "post.flags": "Post flags changed",
  "comment.flags": "Comment flags changed",
};

/** An unknown action is shown as its own name rather than hidden or renamed. */
export function appealActionLabel(action: string): string {
  return APPEALABLE_ACTION_LABELS[action] ?? action;
}

/** The queue filter is URL state, so it arrives unvalidated. */
export function parseAppealStatus(value: string | string[] | undefined): AppealStatus | null {
  if (value === "all") return null;
  const first = Array.isArray(value) ? value[0] : value;
  return APPEAL_STATUSES.find((status) => status === first) ?? "open";
}
