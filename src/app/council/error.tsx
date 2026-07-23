"use client";

import { useEffect } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export default function CouncilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("Council content failed to load.", { digest: error.digest });
      return;
    }

    console.error("Council content failed to load.");
  }, [error.digest]);

  return (
    <div role="alert" className="flex max-w-lg items-start gap-3 py-2">
      <WarningCircleIcon aria-hidden="true" className="text-error mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <h1 className="text-fg text-xl font-semibold">Council unavailable</h1>
        <p className="text-fg-muted mt-2 text-sm">We could not load the Council. Try again.</p>
        <Button type="button" size="lg" onClick={reset} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  );
}
