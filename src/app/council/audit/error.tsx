"use client";

import { useEffect, useRef } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export default function AuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error.digest) {
      console.error("Council audit log failed to load.", { digest: error.digest });
    } else {
      console.error("Council audit log failed to load.");
    }

    retryButtonRef.current?.focus();
  }, [error.digest]);

  return (
    <section
      role="alert"
      aria-labelledby="audit-error-title"
      aria-describedby="audit-error-description"
      className="flex max-w-lg items-start gap-3 py-2"
    >
      <WarningCircleIcon aria-hidden="true" className="text-error mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <h1 id="audit-error-title" className="text-fg text-xl font-semibold">
          Audit log unavailable
        </h1>
        <p id="audit-error-description" className="text-fg-muted mt-2 text-sm">
          We could not load the audit log. Try again.
        </p>
        <Button ref={retryButtonRef} type="button" onClick={reset} className="mt-4">
          Retry
        </Button>
      </div>
    </section>
  );
}
