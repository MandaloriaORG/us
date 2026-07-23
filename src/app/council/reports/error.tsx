"use client";

import { useEffect, useRef } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export default function CouncilReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error("Council report queue failed to load.", { digest: error.digest });
    retryButtonRef.current?.focus();
  }, [error.digest]);

  return (
    <section
      role="alert"
      aria-labelledby="reports-error-title"
      aria-describedby="reports-error-description"
      className="flex max-w-lg items-start gap-3 py-2"
    >
      <WarningCircleIcon aria-hidden="true" className="text-error mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <h1 id="reports-error-title" className="text-fg text-xl font-semibold">
          Report queue unavailable
        </h1>
        <p id="reports-error-description" className="text-fg-muted mt-2 text-sm">
          We could not load the queue. Nothing was changed. Try again.
        </p>
        <Button ref={retryButtonRef} type="button" onClick={reset} className="mt-4">
          Retry
        </Button>
      </div>
    </section>
  );
}
