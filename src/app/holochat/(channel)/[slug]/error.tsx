"use client";

import { EmptyState } from "@/components/ui/empty-state";

export default function ChannelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-svh items-center justify-center px-6">
      <EmptyState
        title="This channel could not be loaded"
        description="Something went wrong while loading the conversation. Try again."
        action={{ label: "Try again", onClick: reset }}
      />
    </div>
  );
}
