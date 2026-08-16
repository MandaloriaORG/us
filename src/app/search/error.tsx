"use client";

import { useEffect } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Search failed to load.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <div role="alert" className="flex max-w-lg items-start gap-3">
        <WarningCircleIcon aria-hidden="true" className="text-error mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <h1 className="text-fg text-xl font-semibold">Search unavailable</h1>
          <p className="text-fg-muted mt-2 text-sm">
            We could not load the search results. Try again in a moment.
          </p>
          <Button type="button" size="lg" onClick={reset} className="mt-4">
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
