"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { resolveAppeal } from "@/lib/actions/appeals";
import type { AppealStatus } from "@/lib/content/appeal-labels";

interface AppealDecisionPanelProps {
  appealId: string;
  status: AppealStatus;
  /** True when the reader took the action being argued with; the RPC refuses them. */
  isOwnAction: boolean;
}

/**
 * Granting and denying are two named actions, not one control with a mode. Both
 * need the reason field, both send the status this panel displayed, and a stale
 * click comes back as a conflict rather than overwriting another moderator.
 *
 * Granting does not undo anything by itself: the reviewer still restores the
 * content or lifts the suspension through the action that owns it, which writes
 * its own audit row. The copy below says so, because a control that silently
 * did half the job would be worse than one that does none of it.
 */
export function AppealDecisionPanel({ appealId, status, isOwnAction }: AppealDecisionPanelProps) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<"granted" | "denied" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  if (status !== "open" && status !== "under_review") return null;

  if (isOwnAction) {
    return (
      <div className="border-border mt-8 border-t pt-6">
        <h2 className="text-fg text-lg font-semibold">Decide</h2>
        <p className="text-fg-muted mt-2 text-sm">
          You took the action under appeal, so you cannot decide this one. Another moderator has to
          read it.
        </p>
      </div>
    );
  }

  const trimmed = reason.trim();
  const reasonInvalid = touched && trimmed.length < 3;
  const isPending = pending !== null;

  async function decide(nextStatus: "granted" | "denied") {
    setTouched(true);
    if (trimmed.length < 3) return;

    setPending(nextStatus);
    setFeedback(null);

    const result = await resolveAppeal({
      appealId,
      expectedStatus: status,
      status: nextStatus,
      decision: trimmed,
    });

    setPending(null);

    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    setFeedback({
      type: "success",
      message:
        nextStatus === "granted"
          ? "Appeal granted. Undo the original action separately; this decision does not do it for you."
          : "Appeal denied.",
    });
  }

  return (
    <div className="border-border mt-8 border-t pt-6">
      <h2 className="text-fg text-lg font-semibold">Decide</h2>
      <p className="text-fg-muted mt-1 text-sm">
        The appellant reads this wording. Granting records the judgement; restoring the content or
        lifting the sanction is a separate action.
      </p>

      <div className="mt-4 flex max-w-xl flex-col gap-2">
        <label htmlFor={reasonId} className="text-fg text-sm font-medium">
          Reason
          <span aria-hidden="true" className="text-error">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <textarea
          id={reasonId}
          value={reason}
          required
          rows={3}
          maxLength={500}
          disabled={isPending}
          aria-invalid={reasonInvalid ? true : undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => setReason(event.target.value)}
          className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-24 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Explain the decision"
        />
        {reasonInvalid ? (
          <p role="alert" className="text-error text-xs">
            Give a reason of at least 3 characters.
          </p>
        ) : (
          <p className="text-fg-muted text-xs">3–500 characters. Written to the audit log.</p>
        )}
      </div>

      {feedback ? (
        <p
          className={`mt-3 text-sm ${feedback.type === "error" ? "text-error" : "text-success"}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          loading={pending === "granted"}
          disabled={isPending}
          onClick={() => void decide("granted")}
        >
          Grant appeal
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={pending === "denied"}
          disabled={isPending}
          onClick={() => void decide("denied")}
        >
          Deny appeal
        </Button>
      </div>
    </div>
  );
}
