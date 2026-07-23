import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "@/lib/content/cursor";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/content/report-reasons";

/**
 * Read paths for the moderation queue.
 *
 * `content_reports` carries no grant for `anon` or `authenticated`, so every
 * read goes through a SECURITY DEFINER RPC that re-checks `moderation.hide`.
 * This module never decides who may look; it shapes results and bounds
 * pagination, and a failed read returns an empty page so a database fault
 * cannot leak its message into a page.
 *
 * A reporter cannot read their own report back. That is deliberate: knowing
 * whether a report was seen is the signal an abusive reporter uses to
 * calibrate. There is no `listOwnReports` here, and adding one would need a new
 * RPC, not a change to this file.
 */

type Functions = Database["public"]["Functions"];

/**
 * Type generation cannot infer nullability for `RETURNS TABLE` columns, so it
 * types every one as non-null. The queue leaves the details and the whole
 * resolution triple empty until a report is closed, and a profile report has no
 * post or comment behind it to excerpt.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type { ReportReason, ReportStatus } from "@/lib/content/report-reasons";

export type ReportSummary = Nullable<
  Functions["moderation_list_reports"]["Returns"][number],
  | "details"
  | "resolution"
  | "resolved_by"
  | "resolved_at"
  | "target_author_id"
  | "target_author_display_name"
  | "target_excerpt"
>;

export type ReportDetail = Nullable<
  Functions["moderation_get_report"]["Returns"][number],
  | "details"
  | "resolution"
  | "resolved_by"
  | "resolved_at"
  | "target_author_id"
  | "target_author_display_name"
  | "target_body"
  | "target_status"
>;

export const REPORT_PAGE_SIZE = 25;

export interface ReportPage {
  items: ReportSummary[];
  nextCursor: string | null;
}

/**
 * The queue filter is URL state, so it arrives as an unvalidated string. An
 * unrecognised value falls back to the open queue rather than showing
 * everything, because the queue's job is the work that is still outstanding.
 */
export function parseReportStatus(value: string | string[] | undefined): ReportStatus | null {
  if (value === "all") return null;
  return REPORT_STATUSES.find((status) => status === value) ?? "open";
}

export interface ListReportsOptions {
  status?: ReportStatus | null;
  cursor?: string | null;
  pageSize?: number;
}

export async function listReports(options: ListReportsOptions = {}): Promise<ReportPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? REPORT_PAGE_SIZE, 1), 100);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_list_reports", {
    // Asking for every status means sending SQL NULL, which the RPC reads as
    // "no filter". Omitting the argument would instead apply its default of
    // `open`. Type generation cannot express a nullable argument, so the null
    // is asserted here rather than being turned into a status.
    p_status: (options.status === undefined ? "open" : options.status) as ReportStatus,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return { items: [], nextCursor: null };

  const items = (data ?? []) as ReportSummary[];
  if (items.length < pageSize) return { items, nextCursor: null };

  const last = items[items.length - 1];
  return {
    items,
    nextCursor: encodeCursor({ createdAt: last.created_at, id: last.report_id }),
  };
}

export async function getReport(reportId: string): Promise<ReportDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_get_report", { p_report_id: reportId });
  if (error) return null;
  return (data?.[0] as ReportDetail | undefined) ?? null;
}
