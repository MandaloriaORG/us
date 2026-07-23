import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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
      <summary className="text-fg-muted hover:text-fg focus-visible:ring-border-focus min-h-11 cursor-pointer content-center rounded-xs underline-offset-4 hover:underline focus:outline-hidden focus-visible:ring-2">
        View details
      </summary>
      <dl className="border-border mt-1 space-y-2 border-l pl-3 text-sm">
        {actionDetail && (
          <div>
            <dt className="sr-only">Change</dt>
            <dd className="text-fg wrap-break-word">{actionDetail}</dd>
          </div>
        )}
        {auditLog.reason && (
          <div>
            <dt className="text-fg-muted font-medium">Reason</dt>
            <dd className="text-fg wrap-break-word">{auditLog.reason}</dd>
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
      <span className="text-fg font-medium wrap-break-word">{auditLog.actorDisplayName}</span>
    ),
  },
  {
    id: "action",
    header: () => "Action",
    cellClassName: "max-w-48",
    cell: (auditLog) => (
      <span className="wrap-break-word">{getAuditActionLabel(auditLog.action)}</span>
    ),
  },
  {
    id: "target",
    header: () => "Target",
    cellClassName: "max-w-48",
    cell: (auditLog) => <span className="wrap-break-word">{auditLog.targetDisplayName}</span>,
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
      <p aria-live="polite" className="text-fg-muted min-h-6 text-sm tabular-nums">
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
        tableClassName="min-w-5xl"
      />
    </div>
  );
}
