import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCouncilReportAccess } from "@/app/council/access";
import { AppealDecisionPanel } from "@/app/council/appeals/appeal-decision-panel";
import { ClaimAppealButton } from "@/app/council/appeals/claim-appeal-button";
import { Badge } from "@/components/origin/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { APPEAL_STATUS_LABELS, appealActionLabel, getAppeal } from "@/lib/content/appeals";
import { getCurrentAuthorization } from "@/lib/permissions";

// Authorization and appeal data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

interface CouncilAppealPageProps {
  params: Promise<{ appealId: string }>;
}

/**
 * One appeal, with the decision it argues against.
 *
 * DATA CONTRACT — implemented, do not change without the RPC:
 * `moderation_get_appeal` re-checks `moderation.hide` and returns the original
 * action alongside the argument: who took it, when, and the reason they gave.
 * `moderation_resolve_appeal` refuses the moderator who took that action, so the
 * panel below tells them rather than offering a control that will fail.
 *
 * DESIGN:
 * - Three regions in reading order: what was decided, what the member says about
 *   it, what this reviewer concludes.
 * - A decided appeal shows the decision and offers nothing: an appeal is decided
 *   once, and the UI must not imply otherwise.
 */
export default async function CouncilAppealPage({ params }: CouncilAppealPageProps) {
  const access = await getCouncilReportAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">Appeal</h1>
        <EmptyState
          title="You cannot open this appeal"
          description="Reading appeals needs the moderation permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  const { appealId } = await params;
  const [appeal, authorization] = await Promise.all([
    getAppeal(appealId),
    getCurrentAuthorization(),
  ]);

  if (!appeal) notFound();

  const decided = appeal.status === "granted" || appeal.status === "denied";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/council/appeals"
        className="text-fg-muted hover:text-fg focus:ring-border-focus inline-flex min-h-11 items-center gap-1.5 text-sm underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        Back to the queue
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-semibold">{appealActionLabel(appeal.action)}</h1>
          <p className="text-fg-muted mt-1 text-sm">
            appealed by {appeal.appellant_display_name ?? "a removed account"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={appeal.status === "open" ? "warning" : "info"}>
            {APPEAL_STATUS_LABELS[appeal.status]}
          </Badge>
          <ClaimAppealButton appealId={appeal.appeal_id} status={appeal.status} />
        </div>
      </div>

      <div className="border-border mt-6 border-t pt-6">
        <h2 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          The decision under appeal
        </h2>
        <p className="text-fg mt-3 text-sm">
          {appealActionLabel(appeal.action)} by{" "}
          {appeal.action_actor_display_name ?? "a removed account"} on{" "}
          <time dateTime={appeal.action_created_at}>
            {new Date(appeal.action_created_at).toLocaleString()}
          </time>
          .
        </p>
        {appeal.action_reason ? (
          <p className="text-fg-muted mt-2 text-sm wrap-break-word">{appeal.action_reason}</p>
        ) : (
          <p className="text-fg-muted mt-2 text-sm">No reason was recorded with that action.</p>
        )}
      </div>

      <div className="border-border mt-6 border-t pt-6">
        <h2 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
          What the member says
        </h2>
        <p className="text-fg mt-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
          {appeal.body}
        </p>
      </div>

      {decided ? (
        <div className="border-border mt-8 border-t pt-6">
          <h2 className="text-fg text-lg font-semibold">Decision</h2>
          <p className="text-fg-muted mt-1 text-sm">
            {appeal.status === "granted" ? "Granted" : "Denied"}
            {appeal.decided_at ? ` on ${new Date(appeal.decided_at).toLocaleString()}` : null}. An
            appeal is decided once and cannot be reopened.
          </p>
          {appeal.decision ? <p className="text-fg mt-3 text-sm">{appeal.decision}</p> : null}
        </div>
      ) : (
        <AppealDecisionPanel
          appealId={appeal.appeal_id}
          status={appeal.status}
          isOwnAction={
            appeal.action_actor_id !== null && appeal.action_actor_id === authorization?.userId
          }
        />
      )}
    </div>
  );
}
