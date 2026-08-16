"use client";

import { EmptyState } from "@/components/ui/empty-state";

export default function ManageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <EmptyState
        title="Channel management could not be loaded"
        description="Something went wrong. Try again."
        action={{ label: "Try again", onClick: reset }}
      />
    </div>
  );
}
