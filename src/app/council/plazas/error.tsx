"use client";

import { useEffect, useRef } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export default function CouncilPlazasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error("Council Plazas failed to load.", { digest: error.digest });
    retryButtonRef.current?.focus();
  }, [error.digest]);

  return (
    <section
      role="alert"
      aria-labelledby="plazas-error-title"
      aria-describedby="plazas-error-description"
      className="flex max-w-lg items-start gap-3 py-2"
    >
      <WarningCircleIcon aria-hidden="true" className="text-error mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <h1 id="plazas-error-title" className="text-fg text-xl font-semibold">
          Plazas unavailable
        </h1>
        <p id="plazas-error-description" className="text-fg-muted mt-2 text-sm">
          We could not load Plazas. Nothing was changed. Try again.
        </p>
        <Button ref={retryButtonRef} type="button" onClick={reset} className="mt-4">
          Retry
        </Button>
      </div>
    </section>
  );
}
