"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

export default function CodexError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div role="alert" className="mx-auto flex max-w-lg flex-col items-start">
        <WarningCircleIcon aria-hidden="true" className="text-warning h-5 w-5" />
        <h1 className="text-fg mt-3 text-xl font-semibold">
          Codex Libre is temporarily unavailable
        </h1>
        <p className="text-fg-muted mt-2 text-sm leading-6">
          The library could not be loaded. Try again in a moment.
        </p>
        <div className="mt-6">
          <Button onClick={reset} type="button">
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
