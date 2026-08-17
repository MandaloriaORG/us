"use client";

import { useId, useState } from "react";

import { setReportStatus } from "@/lib/actions/reports";
import type { ReportStatus } from "@/lib/content/report-reasons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";


interface ReportDecisionPanelProps {
  reportId: string;
  status: ReportStatus;
}

/**
 * Resolve and dismiss are two named actions, not one control with a mode.
 * Both require the reason field below, so neither can be a single click, and
 * both send the status this panel displayed: a stale click comes back as a
 * conflict rather than overwriting another moderator's decision.
 */
export function ReportDecisionPanel({ reportId, status }: ReportDecisionPanelProps) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<"resolved" | "dismissed" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  if (status !== "open" && status !== "under_review") return null;

  const trimmed = reason.trim();
  const reasonInvalid = touched && trimmed.length < 3;
  const isPending = pending !== null;

  async function decide(nextStatus: "resolved" | "dismissed") {
    setTouched(true);
    if (trimmed.length < 3) return;

    setPending(nextStatus);
    setFeedback(null);

    const result = await setReportStatus({
      reportId,
      expectedStatus: status,
      status: nextStatus,
      resolution: trimmed,
    });

    setPending(null);

    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    setFeedback({
      type: "success",
      message: nextStatus === "resolved" ? "Report resolved." : "Report dismissed.",
    });
  }

  return (
    <div className="border-border mt-8 border-t pt-6">
      <h2 className="text-fg text-lg font-semibold">Decide</h2>

      <div className="mt-4 flex max-w-xl flex-col gap-2">
        <label htmlFor={reasonId} className="text-fg text-sm font-medium">
          Reason
          <span aria-hidden="true" className="text-error">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <Textarea
          id={reasonId}
          value={reason}
          required
          rows={3}
          maxLength={500}
          disabled={isPending}
          aria-invalid={reasonInvalid ? true : undefined}
          aria-describedby={reasonInvalid ? `${reasonId}-error` : undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => setReason(event.target.value)}
          className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-24 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Explain the decision"
        />
        {reasonInvalid ? (
          <p id={`${reasonId}-error`} role="alert" className="text-error text-xs">
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
          {feedback.type === "error" ? " Reload the page and try again." : null}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          loading={pending === "resolved"}
          disabled={isPending}
          onClick={() => void decide("resolved")}
        >
          Resolve
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={pending === "dismissed"}
          disabled={isPending}
          onClick={() => void decide("dismissed")}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
