"use client";

import { EmptyState } from "@/components/ui/empty-state";

export default function HolochatError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <EmptyState
        title="Holochat could not be loaded"
        description="Something went wrong while loading the channels. Try again."
        action={{ label: "Try again", onClick: reset }}
      />
    </div>
  );
}
