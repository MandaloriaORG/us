import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCouncilReportAccess, getReportTargetModerationAccess } from "@/app/council/access";
import { ClaimReportButton } from "@/app/council/reports/claim-report-button";
import { ReportDecisionPanel } from "@/app/council/reports/report-decision-panel";
import { ReportTargetPanel } from "@/app/council/reports/report-target-panel";
import { Badge } from "@/components/origin/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { renderMarkdown } from "@/lib/content/markdown";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  type ReportReason,
  type ReportStatus,
} from "@/lib/content/report-reasons";
import { getReport } from "@/lib/content/reports";

import { RevisionHistory } from "./revision-history";

const STATUS_VARIANTS: Record<ReportStatus, "warning" | "info" | "success" | "outline"> = {
  open: "warning",
  under_review: "info",
  resolved: "success",
  dismissed: "outline",
};

// Authorization and report data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

interface CouncilReportPageProps {
  params: Promise<{ reportId: string }>;
}

/**
 * One report, with the evidence.
 *
 * DATA CONTRACT — implemented, do not change without the RPC:
 * `moderation_get_report` re-checks `moderation.hide`. It returns the target's
 * body even when the content is hidden, which is the point of hiding rather
 * than deleting: the evidence has to outlive the removal. The body is author
 * text and is rendered through `renderMarkdown`, never inserted raw.
 *
 * Resolving is `setReportStatus` in `@/lib/actions/reports`. It is
 * compare-and-swap: the form must send the status it displayed, and a stale
 * submission comes back as `conflict` rather than overwriting another
 * moderator's decision. Closing needs a reason of at least three characters,
 * which is written to the audit log.
 *
 * DESIGN — not implemented, owned by the UI workstream:
 * - This is short focused work on one item, so it is a page, not a dialog.
 * - Three regions in reading order: what was claimed, the evidence, the
 *   decision. The evidence is the widest and needs no frame of its own.
 * - The claim shows reason, reporter, when, and the target's current status. A
 *   target already hidden must say so before the moderator acts again.
 * - Resolve and dismiss are two named actions, not one control with a mode.
 *   Both require the reason field, so neither can be a single click.
 * - A closed report shows who closed it, when, and why, and offers no actions:
 *   reopening is not possible and the UI must not imply it is.
 * - `conflict` is the interesting failure. Its message belongs beside the
 *   actions with a way to reload, not in a toast.
 */
export default async function CouncilReportPage({ params }: CouncilReportPageProps) {
  const access = await getCouncilReportAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">Report</h1>
        <EmptyState
          title="You cannot open this report"
          description="Reviewing reports needs the moderation permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  const { reportId } = await params;
  const [report, targetAccess] = await Promise.all([
    getReport(reportId),
    getReportTargetModerationAccess(),
  ]);

  if (!report) notFound();

  const status = report.status as ReportStatus;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/council/reports"
        className="text-fg-muted hover:text-fg focus:ring-border-focus inline-flex min-h-11 items-center gap-1.5 text-sm underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        Back to the queue
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-semibold">
            {REPORT_REASON_LABELS[report.reason as ReportReason]}
          </h1>
          <p className="text-fg-muted mt-1 text-sm capitalize">
            {report.target_type} · reported by {report.reporter_display_name}
            {report.target_status ? ` · target is ${report.target_status}` : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="capitalize" variant={STATUS_VARIANTS[status]}>
            {REPORT_STATUS_LABELS[status]}
          </Badge>
          <ClaimReportButton reportId={report.report_id} status={status} />
        </div>
      </div>

      {report.details ? (
        <p className="text-fg mt-6 text-sm wrap-break-word">{report.details}</p>
      ) : null}

      <div className="border-border bg-surface mt-6 rounded-md border p-4">
        <h2 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">Evidence</h2>
        {report.target_body ? (
          <div
            className="text-fg mt-3 text-sm leading-relaxed break-words"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(report.target_body) }}
          />
        ) : (
          <p className="text-fg-muted mt-3 text-sm">
            No body is available for this target. It may be a profile report, or the target was
            removed before evidence could render here.
          </p>
        )}

        <RevisionHistory targetType={report.target_type} targetId={report.target_id} />
      </div>

      {report.target_status ? (
        <ReportTargetPanel
          targetType={report.target_type}
          targetId={report.target_id}
          targetStatus={report.target_status}
          canHide={targetAccess.canHide}
          canQuarantine={targetAccess.canQuarantine}
          canDelete={targetAccess.canDelete}
          canRestore={targetAccess.canRestore}
        />
      ) : null}

      {status === "resolved" || status === "dismissed" ? (
        <div className="border-border mt-8 border-t pt-6">
          <h2 className="text-fg text-lg font-semibold">Decision</h2>
          <p className="text-fg-muted mt-1 text-sm">
            {status === "resolved" ? "Resolved" : "Dismissed"}
            {report.resolved_at ? ` on ${new Date(report.resolved_at).toLocaleString()}` : null}.
            This report is closed and cannot be reopened.
          </p>
          {report.resolution ? <p className="text-fg mt-3 text-sm">{report.resolution}</p> : null}
        </div>
      ) : (
        <ReportDecisionPanel reportId={report.report_id} status={status} />
      )}
    </div>
  );
}
