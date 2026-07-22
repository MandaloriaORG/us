import { DataTable, type DataTableColumn } from "@/components/reui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

import { getAuditActionDetail, getAuditActionLabel, type AuditLogDto } from "./audit-log-dto";

interface AuditLogTableProps {
  auditLogs: readonly AuditLogDto[];
  hasFilters: boolean;
  total: number;
}

const auditDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  hour12: true,
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  timeZoneName: "short",
  year: "numeric",
});

function formatAuditDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : auditDateTimeFormatter.format(date);
}

function AuditDetails({ auditLog }: { auditLog: AuditLogDto }) {
  const actionDetail = getAuditActionDetail(auditLog);

  if (!actionDetail && !auditLog.reason) {
    return <span className="text-fg-subtle">No additional details</span>;
  }

  return (
    <details className="group max-w-md">
      <summary className="min-h-11 cursor-pointer content-center rounded-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
        View details
      </summary>
      <dl className="mt-1 space-y-2 border-l border-border pl-3 text-sm">
        {actionDetail && (
          <div>
            <dt className="sr-only">Change</dt>
            <dd className="break-words text-fg">{actionDetail}</dd>
          </div>
        )}
        {auditLog.reason && (
          <div>
            <dt className="font-medium text-fg-muted">Reason</dt>
            <dd className="break-words text-fg">{auditLog.reason}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

const columns: readonly DataTableColumn<AuditLogDto>[] = [
  {
    id: "when",
    header: () => "When",
    cellClassName: "whitespace-nowrap tabular-nums text-fg-muted",
    cell: (auditLog) => (
      <time dateTime={auditLog.createdAt}>{formatAuditDateTime(auditLog.createdAt)}</time>
    ),
  },
  {
    id: "actor",
    header: () => "Actor",
    cellClassName: "max-w-48",
    cell: (auditLog) => (
      <span className="break-words font-medium text-fg">{auditLog.actorDisplayName}</span>
    ),
  },
  {
    id: "action",
    header: () => "Action",
    cellClassName: "max-w-48",
    cell: (auditLog) => <span className="break-words">{getAuditActionLabel(auditLog.action)}</span>,
  },
  {
    id: "target",
    header: () => "Target",
    cellClassName: "max-w-48",
    cell: (auditLog) => <span className="break-words">{auditLog.targetDisplayName}</span>,
  },
  {
    id: "details",
    header: () => "Details",
    cellClassName: "min-w-56 max-w-96",
    cell: (auditLog) => <AuditDetails auditLog={auditLog} />,
  },
];

export function AuditLogTable({ auditLogs, hasFilters, total }: AuditLogTableProps) {
  const safeTotal = Number.isSafeInteger(total) && total >= 0 ? total : 0;
  const emptyState = (
    <EmptyState
      action={hasFilters ? { href: "/council/audit", label: "Clear filters" } : undefined}
      description={
        hasFilters
          ? "Try adjusting or clearing the current filters."
          : "Administrative actions will appear here."
      }
      title={hasFilters ? "No audit events match these filters" : "No audit events yet"}
    />
  );

  return (
    <div>
      <p aria-live="polite" className="min-h-6 text-sm tabular-nums text-fg-muted">
        {safeTotal === 1 ? "1 audit event" : `${safeTotal} audit events`}
      </p>
      <DataTable
        ariaLabel="Council audit log"
        caption="Council audit events with actor, action, target, and details"
        className="mt-4"
        columns={columns}
        dense
        emptyState={emptyState}
        rowKey={(auditLog) => auditLog.id}
        rows={auditLogs}
        tableClassName="min-w-[64rem]"
      />
    </div>
  );
}
