"use client";

import { useState } from "react";

import { setPlazaStatus } from "@/lib/actions/plazas";
import { Button } from "@/components/ui/button";

interface PlazaStatusControlProps {
  plazaId: string;
  status: "active" | "archived";
}

/**
 * Archive/reactivate is compare-and-swap against the status this panel
 * displayed, matching every other Council mutation (`ReportDecisionPanel`,
 * `UserManagementPanel`): a stale click comes back as a conflict rather than
 * overwriting another administrator's change, and the conflict message
 * already tells the caller to reload.
 */
export function PlazaStatusControl({ plazaId, status }: PlazaStatusControlProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  const trimmed = reason.trim();
  const reasonInvalid = touched && trimmed.length < 3;
  const nextStatus = status === "active" ? "archived" : "active";
  const actionLabel = status === "active" ? "Archive Plaza" : "Reactivate Plaza";

  async function changeStatus() {
    setTouched(true);
    if (trimmed.length < 3) return;

    setPending(true);
    setFeedback(null);

    const result = await setPlazaStatus({
      plazaId,
      expectedStatus: status,
      status: nextStatus,
      reason: trimmed,
    });

    setPending(false);

    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    setFeedback({
      type: "success",
      message: status === "active" ? "Plaza archived." : "Plaza reactivated.",
    });
    setReason("");
    setTouched(false);
  }

  return (
    <div className="border-border mt-8 border-t pt-6">
      <h2 className="text-fg text-lg font-semibold">
        {status === "active" ? "Archive" : "Reactivate"}
      </h2>
      <p className="text-fg-muted mt-1 text-sm">
        {status === "active"
          ? "An archived Plaza stops accepting new posts but stays visible to those who could already see it."
          : "Reactivating lets this Plaza accept new posts again."}
      </p>

      <div className="mt-4 flex max-w-xl flex-col gap-2">
        <label htmlFor="plaza-status-reason" className="text-fg text-sm font-medium">
          Reason
          <span aria-hidden="true" className="text-error">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <textarea
          id="plaza-status-reason"
          value={reason}
          required
          rows={3}
          maxLength={500}
          disabled={pending}
          aria-invalid={reasonInvalid ? true : undefined}
          aria-describedby={reasonInvalid ? "plaza-status-reason-error" : undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => setReason(event.target.value)}
          className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-24 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={status === "active" ? "Why is this Plaza closing?" : "Why reopen it now?"}
        />
        {reasonInvalid ? (
          <p id="plaza-status-reason-error" role="alert" className="text-error text-xs">
            Give a reason of at least 3 characters.
          </p>
        ) : (
          <p className="text-fg-muted text-xs">3–500 characters. Written to the audit log.</p>
        )}
      </div>

      {feedback ? (
        <p
          className={`mt-4 text-sm ${feedback.type === "error" ? "text-error" : "text-success"}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mt-4">
        <Button
          type="button"
          variant={status === "active" ? "destructive" : "secondary"}
          loading={pending}
          disabled={pending}
          onClick={() => void changeStatus()}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
