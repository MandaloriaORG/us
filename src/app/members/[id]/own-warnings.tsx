"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { acknowledgeWarning } from "@/lib/actions/user-moderation";

export interface OwnWarningItem {
  warningId: string;
  reason: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface OwnWarningsProps {
  warnings: OwnWarningItem[];
}

/**
 * The warnings addressed to the member reading this page.
 *
 * DATA CONTRACT — implemented (migration 0011): `list_own_warnings` resolves the
 * member from the session and takes no id, so this can only ever be your own.
 * `acknowledge_warning` is the member saying they read it: it cannot be undone,
 * no moderator can do it on their behalf, and acknowledging twice is refused.
 *
 * DESIGN: a warning must not be dismissible by scrolling past it, so an
 * unacknowledged one keeps its own action until it is acknowledged; an
 * acknowledged one stays readable as a quiet entry rather than disappearing.
 */
export function OwnWarnings({ warnings }: OwnWarningsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (warnings.length === 0) return null;

  async function acknowledge(warningId: string) {
    setPending(warningId);
    setError(null);

    const result = await acknowledgeWarning(warningId);
    setPending(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <section className="border-border mt-8 border-t pt-8" aria-labelledby="own-warnings-title">
      <h2 id="own-warnings-title" className="text-fg text-lg font-semibold">
        Warnings
      </h2>
      <p className="text-fg-muted mt-1 text-sm">
        Sent to you by the Council. Acknowledging one records that you have read it.
      </p>

      {error ? (
        <p role="alert" className="text-error mt-3 text-sm">
          {error}
        </p>
      ) : null}

      <ol className="divide-border border-border mt-4 divide-y border-y">
        {warnings.map((warning) => (
          <li key={warning.warningId} className="py-3">
            <p className="text-fg-subtle text-xs">
              <time dateTime={warning.createdAt}>
                {new Date(warning.createdAt).toLocaleString()}
              </time>
              {warning.acknowledgedAt ? " · acknowledged" : null}
            </p>
            <p className="text-fg mt-1 text-sm wrap-break-word whitespace-pre-wrap">
              {warning.reason}
            </p>
            {warning.acknowledgedAt ? null : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                loading={pending === warning.warningId}
                disabled={pending !== null}
                onClick={() => void acknowledge(warning.warningId)}
              >
                I have read this
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
