"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ProfileEditErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProfileEditError({ error, reset }: ProfileEditErrorProps) {
  useEffect(() => {
    console.error("Profile editor failed to load.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div role="alert" className="rounded-md border border-error/30 bg-error/10 p-6">
        <h1 className="text-xl font-semibold text-fg">Profile temporarily unavailable</h1>
        <p className="mt-2 text-sm text-fg-muted">
          We could not load the profile editor. Try again.
        </p>
        <Button className="mt-5" type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
