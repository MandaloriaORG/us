import Link from "next/link";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";

import { getCodexCouncilAccess } from "@/app/council/codex/codex-access";
import { ProposalStatusPill } from "@/app/codex/proposal-status-pill";
import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PROPOSAL_STATUS_LABELS } from "@/lib/codex/states";
import {
  moderationListCodexProposals,
  parseProposalStatus,
  type ProposalQueueRow,
} from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

interface ProposalsQueuePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function nextPageHref(status: string, cursor: string) {
  const params = new URLSearchParams();
  if (status !== "proposed") params.set("status", status);
  params.set("cursor", cursor);
  return `/council/codex/proposals?${params.toString()}`;
}

export default async function ProposalsQueuePage({ searchParams }: ProposalsQueuePageProps) {
  const access = await getCodexCouncilAccess();
  if (!access.allowed) {
    return (
      <EmptyState
        title="Archivist access required"
        description="Working the proposal queue needs the codex.edit permission."
      />
    );
  }

  const params = await searchParams;
  const status = parseProposalStatus(params.status) ?? "proposed";
  const cursor = typeof params.cursor === "string" ? params.cursor : null;

  const page = await moderationListCodexProposals({ status, cursor });

  const filterForm = (
    <form className="border-border grid gap-4 border-y py-4 sm:grid-cols-[10rem_auto_auto] sm:items-end">
      <NativeSelect id="proposal-status" defaultValue={status} label="Status" name="status">
        {Object.entries(PROPOSAL_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" className="px-4">
        Apply filter
      </Button>
      {status !== "proposed" ? (
        <Link
          href="/council/codex/proposals"
          className="text-fg-muted hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
        >
          Clear filter
        </Link>
      ) : null}
    </form>
  );

  if (page.items.length === 0) {
    return (
      <div>
        <h2 className="text-fg text-lg font-semibold">Proposals</h2>
        {filterForm}
        <EmptyState
          icon={<PaperPlaneTiltIcon aria-hidden="true" className="h-6 w-6" />}
          title={status === "proposed" ? "No proposals waiting" : "Nothing matches this filter"}
          description={
            status === "proposed"
              ? "Conversations members proposed to distil into Codex knowledge appear here."
              : "No proposal has that status. Clear the filter to see the open queue."
          }
          action={
            status !== "proposed"
              ? { label: "Show proposed", href: "/council/codex/proposals" }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-fg text-lg font-semibold">Proposals</h2>
      {filterForm}
      <ul className="mt-4 flex flex-col gap-3">
        {page.items.map((proposal) => (
          <ProposalQueueRow key={proposal.proposal_id} proposal={proposal} />
        ))}
      </ul>
      {page.nextCursor ? (
        <Link
          href={nextPageHref(status, page.nextCursor)}
          className="text-fg-muted hover:text-fg focus-visible:ring-border-focus mt-6 inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
        >
          Next page
        </Link>
      ) : null}
    </div>
  );
}

function ProposalQueueRow({ proposal }: { proposal: ProposalQueueRow }) {
  return (
    <li className="border-border rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/codex/proposals/${proposal.proposal_id}`}
          className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
        >
          {proposal.reason.slice(0, 120)}
          {proposal.reason.length > 120 ? "…" : ""}
        </Link>
        <ProposalStatusPill status={proposal.status} />
        <span className="text-fg-subtle text-xs">
          {proposal.proposer_display_name} · {formatRelativeTime(proposal.created_at)}
        </span>
      </div>
      <p className="text-fg-muted mt-1 text-sm">
        {proposal.source_count} source{proposal.source_count === 1 ? "" : "s"}
        {proposal.assignee_display_name
          ? ` · assigned to ${proposal.assignee_display_name}`
          : " · unassigned"}
      </p>
    </li>
  );
}
