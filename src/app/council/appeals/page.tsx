import { GavelIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { getCouncilReportAccess } from "@/app/council/access";
import { ClaimAppealButton } from "@/app/council/appeals/claim-appeal-button";
import { Badge } from "@/components/origin/badge";
import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUSES,
  appealActionLabel,
  listAppeals,
  parseAppealStatus,
  type AppealStatus,
  type AppealSummary,
} from "@/lib/content/appeals";
import { formatRelativeTime } from "@/lib/time";

const STATUS_VARIANTS: Record<AppealStatus, "warning" | "info" | "success" | "outline"> = {
  open: "warning",
  under_review: "info",
  granted: "success",
  denied: "outline",
};

// Authorization and queue data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

interface CouncilAppealsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** The filter has to survive paging, or Back lands the moderator somewhere else. */
function nextPageHref(status: AppealStatus | null, cursor: string) {
  const params = new URLSearchParams();
  if (status === null) params.set("status", "all");
  else if (status !== "open") params.set("status", status);
  params.set("cursor", cursor);

  return `/council/appeals?${params.toString()}`;
}

/**
 * The appeal queue.
 *
 * DATA CONTRACT — implemented, do not change without the RPC:
 * `moderation_list_appeals` re-checks `moderation.hide`, so the check below is
 * for the shell, not the data. Status and cursor are URL state, both
 * re-validated server-side; a hand-edited value degrades to the open queue.
 *
 * DESIGN:
 * - Same shape as the report queue, because it is the same kind of work: a
 *   comparable list with an age and one primary action per row.
 * - The row names the action being argued with, not the appeal's own wording:
 *   deciding needs the argument, and that belongs on the detail page.
 */
export default async function CouncilAppealsPage({ searchParams }: CouncilAppealsPageProps) {
  const access = await getCouncilReportAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">Appeals</h1>
        <EmptyState
          title="You cannot work the appeal queue"
          description="Reading appeals needs the moderation permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  const params = (await searchParams) ?? {};
  const status = parseAppealStatus(params.status);
  const page = await listAppeals({
    status,
    cursor: typeof params.cursor === "string" ? params.cursor : null,
  });

  const hasFilter = status !== "open";

  const filterForm = (
    <form className="border-border grid gap-4 border-y py-4 sm:grid-cols-[10rem_auto_auto] sm:items-end">
      <NativeSelect
        id="council-appeal-status"
        defaultValue={status ?? "all"}
        label="Status"
        name="status"
      >
        <option value="all">All statuses</option>
        {APPEAL_STATUSES.map((value) => (
          <option key={value} value={value}>
            {APPEAL_STATUS_LABELS[value]}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" className="px-4">
        Apply filter
      </Button>
      {hasFilter ? (
        <Link
          href="/council/appeals"
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
        <h1 className="text-fg text-2xl font-semibold">Appeals</h1>
        {filterForm}
        <EmptyState
          icon={<GavelIcon aria-hidden="true" className="h-6 w-6" />}
          title={status === "open" ? "No appeal is waiting" : "Nothing matches this filter"}
          description={
            status === "open"
              ? "Nobody is currently arguing with a moderation decision."
              : "No appeal has that status. Clear the filter to see the open queue."
          }
          action={
            hasFilter ? { label: "Show the open queue", href: "/council/appeals" } : undefined
          }
        />
      </div>
    );
  }

  const columns: DataTableColumn<AppealSummary>[] = [
    {
      id: "action",
      header: () => "Appeal",
      cell: (appeal) => (
        <div className="min-w-0">
          <Link
            href={`/council/appeals/${appeal.appeal_id}`}
            className="text-fg hover:text-brand focus:ring-border-focus min-h-11 min-w-0 font-medium underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
          >
            {appealActionLabel(appeal.action)}
          </Link>
          <p className="text-fg-muted mt-0.5 text-sm wrap-break-word">
            filed by {appeal.appellant_display_name ?? "a removed account"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: () => "Status",
      cell: (appeal) => (
        <Badge variant={STATUS_VARIANTS[appeal.status]}>
          {APPEAL_STATUS_LABELS[appeal.status]}
        </Badge>
      ),
    },
    {
      id: "age",
      header: () => "Filed",
      cellClassName: "tabular-nums text-fg-muted",
      cell: (appeal) => (
        <time dateTime={appeal.created_at}>{formatRelativeTime(appeal.created_at)}</time>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (appeal) => <ClaimAppealButton appealId={appeal.appeal_id} status={appeal.status} />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-fg text-2xl font-semibold">Appeals</h1>
      {filterForm}

      <DataTable
        ariaLabel="Appeal queue"
        caption="Appeals against moderation decisions, newest first"
        className="mt-4"
        columns={columns}
        rowKey={(appeal) => appeal.appeal_id}
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
