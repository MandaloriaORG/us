import Link from "next/link";
import { FlagIcon } from "@phosphor-icons/react/dist/ssr";

import { getCodexCouncilAccess } from "@/app/council/codex/codex-access";
import { SuggestionReviewForm } from "@/app/council/codex/suggestions/suggestion-review-form";
import { Badge } from "@/components/origin/badge";
import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SUGGESTION_STATUS_LABELS } from "@/lib/codex/states";
import {
  moderationListCodexSuggestions,
  parseSuggestionStatus,
  type SuggestionQueueRow,
} from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "warning" | "info" | "success" | "outline"> = {
  open: "warning",
  accepted: "success",
  rejected: "outline",
  merged: "info",
};

interface SuggestionsQueuePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function nextPageHref(status: string, cursor: string) {
  const params = new URLSearchParams();
  if (status !== "open") params.set("status", status);
  params.set("cursor", cursor);
  return `/council/codex/suggestions?${params.toString()}`;
}

export default async function SuggestionsQueuePage({ searchParams }: SuggestionsQueuePageProps) {
  const access = await getCodexCouncilAccess();
  if (!access.allowed) {
    return (
      <EmptyState
        title="Archivist access required"
        description="Reviewing suggestions needs the codex.edit permission."
      />
    );
  }

  const params = await searchParams;
  const status = parseSuggestionStatus(params.status) ?? "open";
  const cursor = typeof params.cursor === "string" ? params.cursor : null;

  const page = await moderationListCodexSuggestions({ status, cursor });

  const filterForm = (
    <form className="border-border grid gap-4 border-y py-4 sm:grid-cols-[10rem_auto_auto] sm:items-end">
      <NativeSelect id="suggestion-status" defaultValue={status} label="Status" name="status">
        <option value="open">Open</option>
        <option value="accepted">Accepted</option>
        <option value="rejected">Rejected</option>
        <option value="merged">Merged</option>
      </NativeSelect>
      <Button type="submit" className="px-4">
        Apply filter
      </Button>
      {status !== "open" ? (
        <Link
          href="/council/codex/suggestions"
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
        <h2 className="text-fg text-lg font-semibold">Suggestions</h2>
        {filterForm}
        <EmptyState
          icon={<FlagIcon aria-hidden="true" className="h-6 w-6" />}
          title={status === "open" ? "No open suggestions" : "Nothing matches this filter"}
          description={
            status === "open"
              ? "Corrections members send about published articles appear here."
              : "No suggestion has that status. Clear the filter to see the open queue."
          }
          action={
            status !== "open"
              ? { label: "Show the open queue", href: "/council/codex/suggestions" }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-fg text-lg font-semibold">Suggestions</h2>
      {filterForm}
      <ul className="mt-4 flex flex-col gap-3">
        {page.items.map((suggestion) => (
          <SuggestionRow key={suggestion.suggestion_id} suggestion={suggestion} />
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

function SuggestionRow({ suggestion }: { suggestion: SuggestionQueueRow }) {
  const reviewed = suggestion.status !== "open";

  return (
    <li className="border-border rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/council/codex/${suggestion.article_slug}/edit`}
          className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
        >
          {suggestion.article_title}
        </Link>
        <Badge variant={STATUS_VARIANTS[suggestion.status]}>
          {SUGGESTION_STATUS_LABELS[suggestion.status]}
        </Badge>
        <span className="text-fg-subtle text-xs">
          {suggestion.suggester_display_name} · {formatRelativeTime(suggestion.created_at)}
        </span>
      </div>
      <p className="text-fg-muted mt-2 text-sm">{suggestion.body}</p>
      {!reviewed ? (
        <div className="mt-3">
          <SuggestionReviewForm expectedStatus="open" suggestion={suggestion} />
        </div>
      ) : null}
    </li>
  );
}
