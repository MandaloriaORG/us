import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowSquareOutIcon, EyeSlashIcon, LinkSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { CodexHeader } from "@/app/codex/codex-header";
import { ProposalStatusPill } from "@/app/codex/proposal-status-pill";
import { ProposalWorkbench } from "@/app/codex/proposals/[proposalId]/proposal-workbench";
import { SOURCE_TYPE_LABELS } from "@/lib/codex/states";
import {
  getProposal,
  listProposalContributors,
  listProposalSources,
  type ProposalContributor,
  type ProposalSource,
} from "@/lib/codex/queries";
import { isSafeExternalUrl } from "@/lib/codex/url";
import { formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Codex proposal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ProposalPageProps {
  params: Promise<{ proposalId: string }>;
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { proposalId } = await params;
  if (!UUID_PATTERN.test(proposalId)) notFound();

  const [proposal, sources, contributors] = await Promise.all([
    getProposal(proposalId),
    listProposalSources(proposalId),
    listProposalContributors(proposalId),
  ]);
  if (!proposal) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserId = user?.id ?? null;
  const isProposer = currentUserId === proposal.proposer_id;
  const isOpen = ["proposed", "classified", "drafting", "reviewed", "reopened"].includes(
    proposal.status,
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <CodexHeader signedIn={Boolean(currentUserId)} />
      <p className="text-fg-muted mt-6 text-sm">
        <Link href="/codex/proposals" className="hover:text-fg">
          My proposals
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-fg text-2xl font-semibold">
          {proposal.working_title || "Untitled proposal"}
        </h1>
        <ProposalStatusPill status={proposal.status} />
      </div>
      <p className="text-fg-subtle mt-1 text-sm">
        Proposed by {proposal.proposer_display_name} · {formatRelativeTime(proposal.created_at)}
        {proposal.assignee_display_name ? ` · assigned to ${proposal.assignee_display_name}` : ""}
      </p>

      <p className="text-fg mt-4 text-sm leading-relaxed">{proposal.reason}</p>

      {proposal.article_slug ? (
        <div className="border-border bg-surface mt-4 flex items-center gap-2 rounded-md border p-4">
          <ArrowSquareOutIcon aria-hidden="true" className="text-fg-muted h-4 w-4" />
          <p className="text-sm">
            This proposal produced{" "}
            <Link
              href={`/codex/${proposal.article_slug}`}
              className="text-brand focus-visible:ring-border-focus underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
            >
              {proposal.article_slug}
            </Link>
            .
          </p>
        </div>
      ) : null}

      <SourceSection sources={sources} />
      <ContributorSection contributors={contributors} />

      {(isProposer || proposal.can_edit) && isOpen ? (
        <ProposalWorkbench
          canEdit={proposal.can_edit}
          contributors={contributors}
          isProposer={isProposer}
          proposal={proposal}
          sources={sources}
        />
      ) : null}
    </main>
  );
}

function SourceSection({ sources }: { sources: ProposalSource[] }) {
  if (sources.length === 0) return null;

  return (
    <section aria-labelledby="proposal-sources" className="border-border mt-6 border-t pt-4">
      <h2 className="text-fg text-base font-semibold" id="proposal-sources">
        Sources ({sources.length})
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {sources.map((source) => (
          <li className="flex items-start gap-2 text-sm" key={source.source_id}>
            <LinkSimpleIcon
              aria-hidden="true"
              className="text-fg-subtle mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            {source.source_type === "external" && source.is_visible ? (
              isSafeExternalUrl(source.label ?? "") ? (
                <a
                  className="text-brand focus-visible:ring-border-focus inline-flex min-h-6 items-center gap-1 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                  href={source.label ?? undefined}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  {source.label}
                </a>
              ) : (
                <span className="text-fg">{source.label}</span>
              )
            ) : source.is_visible ? (
              <span className="text-fg">
                {source.label || SOURCE_TYPE_LABELS[source.source_type]}
              </span>
            ) : (
              <span className="text-fg-subtle inline-flex items-center gap-1.5">
                <EyeSlashIcon aria-hidden="true" className="h-3.5 w-3.5" />
                Restricted source
              </span>
            )}
            {source.note ? <span className="text-fg-muted">— {source.note}</span> : null}
            <span className="text-fg-subtle ml-auto shrink-0 text-xs">
              added by {source.added_by_display_name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContributorSection({ contributors }: { contributors: ProposalContributor[] }) {
  if (contributors.length === 0) return null;

  return (
    <section aria-labelledby="proposal-contributors" className="border-border mt-6 border-t pt-4">
      <h2 className="text-fg text-base font-semibold" id="proposal-contributors">
        Contributors ({contributors.length})
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {contributors.map((contributor) => (
          <li className="text-sm" key={contributor.contributor_id}>
            {renderContributorName(contributor.member_display_name, contributor.attribution)}
            <span className="text-fg-muted">
              {" "}
              · {contributor.contribution_type} · {contributor.attribution} · {contributor.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The same anonymity policy as the public provenance panel: anonymous and
 * withdrawn attributions are never named, even inside the proposal. */
function renderContributorName(
  displayName: string | null,
  attribution: "public" | "anonymous" | "withdrawn",
) {
  if (attribution === "withdrawn") return "Withdrawn contributor";
  if (attribution === "anonymous") return "Anonymous contributor";
  return displayName || "Contributor";
}
