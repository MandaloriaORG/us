"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface MembersErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MembersError({ error, reset }: MembersErrorProps) {
  useEffect(() => {
    console.error("Member content failed to load.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div role="alert" className="rounded-md border border-error/30 bg-error/10 p-6">
        <h1 className="text-xl font-semibold text-fg">Members temporarily unavailable</h1>
        <p className="mt-2 text-sm text-fg-muted">
          We could not load this member content. Try again.
        </p>
        <Button className="mt-5" type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
