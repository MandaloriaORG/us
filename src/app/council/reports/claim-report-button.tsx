"use client";

import { useState, useTransition } from "react";

import { setReportStatus } from "@/lib/actions/reports";
import type { ReportStatus } from "@/lib/content/report-reasons";
import { Button } from "@/components/ui/button";

interface ClaimReportButtonProps {
  reportId: string;
  status: ReportStatus;
}

/**
 * Claiming needs no reason: it only marks that a moderator is looking, so two
 * do not work the same item at once. It is compare-and-swap against the
 * status this row displayed, matching every other Council mutation.
 */
export function ClaimReportButton({ reportId, status }: ClaimReportButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "open") return null;

  function claim() {
    setError(null);
    startTransition(async () => {
      const result = await setReportStatus({
        reportId,
        expectedStatus: status,
        status: "under_review",
      });
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
