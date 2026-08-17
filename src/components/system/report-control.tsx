"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon, FlagIcon } from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { createReport } from "@/lib/actions/reports";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/content/report-reasons";
import { Textarea } from "@/components/ui/textarea";


const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const TARGET_KEYS = {
  post: "postId",
  comment: "commentId",
  profile: "profileId",
} as const;

export interface ReportControlProps {
  targetType: "post" | "comment" | "profile";
  targetId: string;
}

/**
 * Inline report form for a post, comment, or profile. Owns the `createReport`
 * call itself, since the shape sent is identical everywhere except which
 * target key carries the id.
 *
 * Never optimistic: a `ReportActionResult` isn't guessable client-side. On a
 * successful submission the control replaces itself with a terminal
 * confirmation and does not offer the form again in this render, matching the
 * database's one-live-report-per-target rule and avoiding a guaranteed second
 * "duplicate" round-trip.
 */
export function ReportControl({ targetType, targetId }: ReportControlProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const baseId = `report-${targetType}-${targetId}`;

  if (submitted) {
    return (
      <p className="text-fg-muted flex items-center gap-1.5 text-xs">
        <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
        Report submitted — a moderator will review it.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <FlagIcon aria-hidden="true" className="h-4 w-4" />
        Report
      </Button>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await createReport({
        reason,
        details,
        [TARGET_KEYS[targetType]]: targetId,
      });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }
      setSubmitted(true);
    });
  }

  function handleCancel() {
    setOpen(false);
    setReason("");
    setDetails("");
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <NativeSelect
        id={`${baseId}-reason`}
        label="Reason"
        required
        disabled={isPending}
        value={reason}
        error={fieldErrors.reason}
        onChange={(event) => setReason(event.target.value)}
      >
        <option value="" disabled>
          Choose a reason
        </option>
        {REPORT_REASONS.map((value) => (
          <option key={value} value={value}>
            {REPORT_REASON_LABELS[value]}
          </option>
        ))}
      </NativeSelect>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${baseId}-details`} className="text-fg text-sm font-medium">
          Details <span className="text-fg-subtle font-normal">(optional)</span>
        </label>
        <Textarea
          id={`${baseId}-details`}
          value={details}
          disabled={isPending}
          maxLength={1000}
          aria-invalid={fieldErrors.details ? true : undefined}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Anything a moderator should know…"
          className={TEXTAREA_CLASS}
        />
        {fieldErrors.details ? (
          <p role="alert" className="text-error text-xs">
            {fieldErrors.details}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-error text-xs">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={isPending} disabled={isPending || !reason}>
          Submit report
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
