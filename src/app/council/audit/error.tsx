"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

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
      <AlertCircle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-error" />
      <div>
        <h1 id="audit-error-title" className="text-xl font-semibold text-fg">
          Audit log unavailable
        </h1>
        <p id="audit-error-description" className="mt-2 text-sm text-fg-muted">
          We could not load the audit log. Try again.
        </p>
        <Button ref={retryButtonRef} type="button" onClick={reset} className="mt-4">
          Retry
        </Button>
      </div>
    </section>
  );
}
