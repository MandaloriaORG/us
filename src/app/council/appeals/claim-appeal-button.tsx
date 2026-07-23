"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { claimAppeal } from "@/lib/actions/appeals";
import type { AppealStatus } from "@/lib/content/appeal-labels";

interface ClaimAppealButtonProps {
  appealId: string;
  status: AppealStatus;
}

/**
 * Claiming needs no reason: it only marks that a moderator is reading, so two do
 * not decide the same appeal at once. Compare-and-swap against the status this
 * row displayed, like every other Council mutation.
 */
export function ClaimAppealButton({ appealId, status }: ClaimAppealButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "open") return null;

  function claim() {
    setError(null);
    startTransition(async () => {
      const result = await claimAppeal({ appealId, expectedStatus: status });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" loading={isPending} onClick={claim}>
        Claim
      </Button>
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
