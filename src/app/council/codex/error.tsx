"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

export default function CodexCouncilError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-lg py-10">
      <WarningCircleIcon aria-hidden="true" className="text-warning h-5 w-5" />
      <h1 className="text-fg mt-3 text-xl font-semibold">Codex work is temporarily unavailable</h1>
      <p className="text-fg-muted mt-2 text-sm leading-6">
        The article or queue could not be loaded. Try again in a moment.
      </p>
      <div className="mt-6">
        <Button onClick={reset} type="button">
          Try again
        </Button>
      </div>
    </div>
  );
}
