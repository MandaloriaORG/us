"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Last boundary before the framework's own error page.
 *
 * Routes that can say something more specific own their own `error.tsx`; this
 * one catches everything else so a failure never reaches an unstyled default.
 * The digest is the only thing logged: the message may carry data the reader
 * is not entitled to, and in production Next.js redacts it anyway.
 */
interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("Unhandled route error.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div role="alert" className="border-error/30 bg-error/10 rounded-md border p-6">
        <h1 className="text-fg text-xl font-semibold">This page could not load</h1>
        <p className="text-fg-muted mt-2 text-sm">
          Something failed on our side. Nothing you were doing was lost.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <a href="/" className="text-fg-muted hover:text-fg text-sm underline underline-offset-4">
            Return to Home
          </a>
        </div>
      </div>
    </main>
  );
}
