import Link from "next/link";
import type { Metadata } from "next";
import { SealQuestionIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/origin/badge";
import { CodexHeader } from "@/app/codex/codex-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SUGGESTION_STATUS_LABELS } from "@/lib/codex/states";
import { listOwnCodexSuggestions } from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "My suggestions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "warning" | "info" | "success" | "outline"> = {
  open: "warning",
  accepted: "success",
  rejected: "outline",
  merged: "info",
};

export default async function MySuggestionsPage() {
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
          icon={<SealQuestionIcon aria-hidden="true" className="h-6 w-6" />}
          title="Sign in to see your suggestions"
          description="Corrections you have proposed to Codex articles appear here."
          action={{ label: "Sign in", href: "/auth/login" }}
        />
      </main>
    );
  }

  const suggestions = await listOwnCodexSuggestions();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <CodexHeader signedIn={true} />
      <h1 className="text-fg mt-6 text-xl font-semibold">My suggestions</h1>

      {suggestions.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<SealQuestionIcon aria-hidden="true" className="h-6 w-6" />}
          title="No suggestions yet"
          description="Open an article and suggest a correction to help the library stay accurate."
          action={{ label: "Browse the library", href: "/codex" }}
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <li className="border-border rounded-md border p-4" key={suggestion.suggestion_id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/codex/${suggestion.article_slug}`}
                  className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  {suggestion.article_title}
                </Link>
                <Badge variant={STATUS_VARIANTS[suggestion.status]}>
                  {SUGGESTION_STATUS_LABELS[suggestion.status]}
                </Badge>
                <span className="text-fg-subtle text-xs">
                  {formatRelativeTime(suggestion.created_at)}
                </span>
              </div>
              <p className="text-fg-muted mt-2 text-sm">{suggestion.body}</p>
              {suggestion.review_note ? (
                <p className="text-fg-subtle mt-2 text-xs">Review: {suggestion.review_note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
