import Link from "next/link";
import type { Metadata } from "next";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/origin/badge";
import { CodexHeader } from "@/app/codex/codex-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PROPOSAL_STATUS_LABELS } from "@/lib/codex/states";
import { listOwnCodexProposals } from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "My proposals",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyProposalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <CodexHeader signedIn={false} />
        <EmptyState
          className="mt-10"
          icon={<PaperPlaneTiltIcon aria-hidden="true" className="h-6 w-6" />}
          title="Sign in to see your proposals"
          description="Conversations you proposed to distil into Codex knowledge appear here."
          action={{ label: "Sign in", href: "/auth/login" }}
        />
      </main>
    );
  }

  const proposals = await listOwnCodexProposals();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <CodexHeader signedIn={true} />
      <h1 className="text-fg mt-6 text-xl font-semibold">My proposals</h1>

      {proposals.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<PaperPlaneTiltIcon aria-hidden="true" className="h-6 w-6" />}
          title="No proposals yet"
          description="When a conversation deserves to be preserved, propose it for the Codex."
          action={{ label: "Propose for the Codex", href: "/codex/propose" }}
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {proposals.map((proposal) => (
            <li className="border-border rounded-md border p-4" key={proposal.proposal_id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/codex/proposals/${proposal.proposal_id}`}
                  className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  {proposal.working_title || "Untitled proposal"}
                </Link>
                <Badge variant="outline">{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge>
                <span className="text-fg-subtle text-xs">
                  {formatRelativeTime(proposal.created_at)}
                </span>
              </div>
              <p className="text-fg-muted mt-2 text-sm">{proposal.reason}</p>
              {proposal.article_slug ? (
                <p className="mt-2 text-sm">
                  <Link
                    href={`/codex/${proposal.article_slug}`}
                    className="text-brand focus-visible:ring-border-focus inline-flex min-h-6 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                  >
                    Read the article it produced
                  </Link>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
