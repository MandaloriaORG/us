import { FlagIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { getCouncilReportAccess } from "@/app/council/access";
import { ClaimReportButton } from "@/app/council/reports/claim-report-button";
import { Badge } from "@/components/origin/badge";
import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
} from "@/lib/content/report-reasons";
import { listReports, parseReportStatus, type ReportSummary } from "@/lib/content/reports";

const STATUS_VARIANTS: Record<ReportStatus, "warning" | "info" | "success" | "outline"> = {
  open: "warning",
  under_review: "info",
  resolved: "success",
  dismissed: "outline",
};

function relativeAge(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Authorization and queue data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

interface CouncilReportsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** The filter has to survive paging, or Back lands the moderator somewhere else. */
function nextPageHref(status: ReportStatus | null, cursor: string) {
  const params = new URLSearchParams();
  if (status === null) params.set("status", "all");
  else if (status !== "open") params.set("status", status);
  params.set("cursor", cursor);

  return `/council/reports?${params.toString()}`;
}

/**
 * The report queue.
 *
 * DATA CONTRACT — implemented, do not change without the RPC:
 * `moderation_list_reports` re-checks `moderation.hide` and raises if the caller
 * lacks it, so the access check below is for the shell, not the data. There is
 * no client-side filtering to add. The status filter and the cursor are URL
 * state and both are re-validated server-side; a hand-edited value degrades to
 * the open queue and the first page rather than failing.
 *
 * `open_report_count` is how many live reports name the same target, which is
 * the brigading signal. It is not a count of this reporter's reports.
 *
 * DESIGN — not implemented, owned by the UI workstream:
 * - The queue is a work list under comparison — reason, age, how many others
 *   reported the same thing — so a table applies, not cards.
 * - Status is a badge; reason and reporter are quiet text. Neither may rely on
 *   colour alone.
 * - `open_report_count` above 1 is the one thing worth emphasising in a row.
 * - The status filter belongs in the URL alongside the cursor so Back restores
 *   the moderator's place in the queue.
 * - Claiming a report ("under review") is the primary action per row and needs
 *   the current status sent with it: the RPC is compare-and-swap and will
 *   refuse a stale click rather than overwrite another moderator.
 * - Empty state must distinguish "the queue is clear" from "nothing matches
 *   this filter", and offer clearing the filter in the second case.
 */
export default async function CouncilReportsPage({ searchParams }: CouncilReportsPageProps) {
  const access = await getCouncilReportAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">Reports</h1>
        <EmptyState
          title="You cannot work the report queue"
          description="Reviewing reports needs the moderation permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  const params = (await searchParams) ?? {};
  const status = parseReportStatus(params.status);
  const page = await listReports({
    status,
    cursor: typeof params.cursor === "string" ? params.cursor : null,
  });

  const hasFilter = status !== "open";

  const filterForm = (
    <form className="border-border grid gap-4 border-y py-4 sm:grid-cols-[10rem_auto_auto] sm:items-end">
      <NativeSelect
        id="council-report-status"
        defaultValue={status ?? "all"}
        label="Status"
        name="status"
      >
        <option value="all">All statuses</option>
        {REPORT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {REPORT_STATUS_LABELS[value]}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" className="px-4">
        Apply filter
      </Button>
      {hasFilter ? (
        <Link
          href="/council/reports"
          className="text-fg-muted hover:text-fg focus:ring-border-focus inline-flex min-h-11 items-center underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
        >
          Clear filter
        </Link>
      ) : null}
    </form>
  );

  if (page.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-fg text-2xl font-semibold">Reports</h1>
        {filterForm}
        <EmptyState
          icon={<FlagIcon aria-hidden="true" className="h-6 w-6" />}
          title={status === "open" ? "The queue is clear" : "Nothing matches this filter"}
          description={
            status === "open"
              ? "No report is waiting for a moderator right now."
              : "No report has that status. Clear the filter to see the open queue."
          }
          action={
            hasFilter ? { label: "Show the open queue", href: "/council/reports" } : undefined
          }
        />
      </div>
    );
  }

  const columns: DataTableColumn<ReportSummary>[] = [
    {
      id: "reason",
      header: () => "Report",
      cell: (report) => (
        <div className="min-w-0">
          <Link
            href={`/council/reports/${report.report_id}`}
            className="text-fg hover:text-brand focus:ring-border-focus min-h-11 min-w-0 font-medium underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
          >
            {REPORT_REASON_LABELS[report.reason as ReportReason]}
          </Link>
          <p className="text-fg-muted mt-0.5 text-sm wrap-break-word capitalize">
            {report.target_type} · reported by {report.reporter_display_name}
          </p>
          {report.target_excerpt ? (
            <p className="text-fg-subtle mt-0.5 max-w-md truncate text-sm">
              {report.target_excerpt}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: () => "Status",
      cell: (report) => (
        <div className="flex flex-col items-start gap-1">
          <Badge className="capitalize" variant={STATUS_VARIANTS[report.status as ReportStatus]}>
            {REPORT_STATUS_LABELS[report.status as ReportStatus]}
          </Badge>
          {report.open_report_count > 1 ? (
            <span className="text-warning text-xs font-medium">
              {report.open_report_count} live reports
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "age",
      header: () => "Reported",
      cellClassName: "tabular-nums text-fg-muted",
      cell: (report) => <time dateTime={report.created_at}>{relativeAge(report.created_at)}</time>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (report) => (
        <ClaimReportButton reportId={report.report_id} status={report.status as ReportStatus} />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-fg text-2xl font-semibold">Reports</h1>
      {filterForm}

      <DataTable
        ariaLabel="Report queue"
        caption="Reports awaiting or resolved by moderation, newest first"
        className="mt-4"
        columns={columns}
        rowKey={(report) => report.report_id}
        rows={page.items}
        tableClassName="min-w-160"
      />

      {page.nextCursor ? (
        <Link
          href={nextPageHref(status, page.nextCursor)}
          className="text-fg-muted hover:text-fg focus:ring-border-focus mt-6 inline-flex min-h-11 items-center underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
        >
          Next page
        </Link>
      ) : null}
    </div>
  );
}
