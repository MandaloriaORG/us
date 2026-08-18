"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon, FlagIcon } from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { reportChatMessage } from "@/lib/actions/holochat";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/content/report-reasons";
import { Textarea } from "@/components/ui/textarea";

export interface ChatReportControlProps {
  messageId: string;
  onClose: () => void;
}

/**
 * Inline report form for a chat message. Reports reach the shared moderation
 * queue through `report_chat_message`, which re-checks visibility, the
 * self-report rule and the report rate limit.
 *
 * Never optimistic. On a successful submission the control replaces itself with
 * a terminal confirmation and offers a close action.
 */
export function ChatReportControl({ messageId, onClose }: ChatReportControlProps) {
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const baseId = `report-chat-${messageId}`;

  if (submitted) {
    return (
      <p className="text-fg-muted flex items-center gap-1.5 text-xs">
        <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
        Report submitted — a moderator will review it.
        <button
          type="button"
          onClick={onClose}
          className="text-fg underline underline-offset-2 hover:opacity-80"
        >
          Close
        </button>
      </p>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await reportChatMessage({ messageId, reason, details });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }
      setSubmitted(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
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
          className="min-h-20 resize-y"
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
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReportTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="ghost" onClick={onClick}>
      <FlagIcon aria-hidden="true" className="h-4 w-4" />
      Report
    </Button>
  );
}
