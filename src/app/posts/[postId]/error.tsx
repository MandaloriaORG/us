"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ContentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The digest is the only thing logged. The message can carry request detail and
 * must not reach the browser console or the page.
 */
export default function ContentError({ error, reset }: ContentErrorProps) {
  useEffect(() => {
    console.error("Plaza content failed to load.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div role="alert" className="border-error/30 bg-error/10 rounded-md border p-6">
        <h1 className="text-fg text-xl font-semibold">This content is temporarily unavailable</h1>
        <p className="text-fg-muted mt-2 text-sm">We could not load it. Try again.</p>
        <Button className="mt-5" type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
