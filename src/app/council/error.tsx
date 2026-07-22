"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

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
      <AlertCircle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-error" />
      <div>
        <h1 className="text-xl font-semibold text-fg">Council unavailable</h1>
        <p className="mt-2 text-sm text-fg-muted">We could not load the Council. Try again.</p>
        <Button type="button" size="lg" onClick={reset} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  );
}
