import Link from "next/link";
import {
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
  EyeSlashIcon,
  LinkSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { ProposalStatusPill } from "@/app/codex/proposal-status-pill";
import {
  ATTRIBUTION_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
} from "@/lib/codex/states";
import type { ArticleProvenance } from "@/lib/codex/queries";
import { isSafeExternalUrl } from "@/lib/codex/url";

/**
 * The reviewed provenance of a published article: which proposal produced it,
 * which conversations it cites, and who contributed and how they chose to be
 * credited. Every source and contributor was already resolved through the
 * visibility RPCs, so a restricted source renders as a quiet placeholder and a
 * withdrawn contributor is never named.
 */
export function ProvenancePanel({ provenance }: { provenance: ArticleProvenance[] }) {
  if (provenance.length === 0) return null;

  return (
    <section aria-labelledby="provenance-heading" className="border-border mt-10 border-t pt-7">
      <div className="flex items-center gap-2">
        <span className="border-brand/25 bg-brand/5 text-brand flex h-6 w-6 items-center justify-center rounded border">
          <ArrowsClockwiseIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
        <h2
          className="text-fg font-display text-lg font-semibold tracking-tight"
          id="provenance-heading"
        >
          Provenance
        </h2>
      </div>
      <p className="text-fg-muted mt-1.5 text-sm">
        How this article was distilled from conversation, with the sources and people credited
        behind it.
      </p>

      <ul className="mt-4 flex flex-col gap-4">
        {provenance.map(({ proposal, sources, contributors }) => (
          <li key={proposal.proposal_id}>
            <div className="border-border bg-bg-raised/40 rounded-lg border p-4 shadow-[0_1px_0_var(--color-white/4%)]">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/codex/proposals/${proposal.proposal_id}`}
                  className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  {proposal.working_title || "Distillation proposal"}
                </Link>
                <ProposalStatusPill status={proposal.status} />
                {proposal.assignee_display_name ? (
                  <span className="text-fg-subtle text-xs">
                    Assigned to {proposal.assignee_display_name}
                  </span>
                ) : null}
              </div>

              {sources.length > 0 ? (
                <div className="mt-3">
                  <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                    Sources
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {sources.map((source) => (
                      <li key={source.source_id} className="flex items-start gap-2 text-sm">
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
                              <ArrowSquareOutIcon aria-hidden="true" className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-fg">{source.label}</span>
                          )
                        ) : source.is_visible ? (
                          <span className="text-fg">{source.label}</span>
                        ) : (
                          <span className="text-fg-subtle inline-flex items-center gap-1.5">
                            <EyeSlashIcon aria-hidden="true" className="h-3.5 w-3.5" />
                            Restricted source
                          </span>
                        )}
                        {source.note ? (
                          <span className="text-fg-muted">— {source.note}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {contributors.length > 0 ? (
                <div className="mt-3">
                  <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">
                    Contributors
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {contributors.map((contributor) => (
                      <li className="text-fg text-sm" key={contributor.contributor_id}>
                        {renderContributorName(
                          contributor.member_display_name,
                          contributor.attribution,
                        )}
                        <span className="text-fg-muted">
                          {" "}
                          · {CONTRIBUTION_TYPE_LABELS[contributor.contribution_type]}
                          {" · "}
                          {ATTRIBUTION_LABELS[contributor.attribution].toLowerCase()} ·{" "}
                          {CONTRIBUTION_STATUS_LABELS[contributor.status].toLowerCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-fg-subtle mt-3 flex items-center gap-1.5 text-xs">
        <ArrowsClockwiseIcon aria-hidden="true" className="h-3.5 w-3.5" />
        Attribution never grants rank, reputation or badges on its own.
      </p>
    </section>
  );
}

function renderContributorName(
  displayName: string | null,
  attribution: "public" | "anonymous" | "withdrawn",
) {
  if (attribution === "withdrawn") return "Withdrawn contributor";
  if (attribution === "anonymous") return "Anonymous contributor";
  return displayName || "Contributor";
}
