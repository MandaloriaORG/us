"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ChatMessageStatus } from "@/lib/holochat/types";
import { Textarea } from "@/components/ui/textarea";


export type ModerationAction = "hide" | "restore" | "delete";

const MODERATION_LABELS: Record<ModerationAction, string> = {
  hide: "Hide message",
  restore: "Restore message",
  delete: "Delete message",
};

export interface MessageModerationControlProps {
  messageId: string;
  action: ModerationAction;
  /** The status currently shown to the moderator, sent back as the CAS guard. */
  expectedStatus: ChatMessageStatus;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}

/**
 * The reason step of a chat moderation transition. Hiding, restoring and
 * deleting a message are audited and reversible (except delete, which is final),
 * so the moderator states why. The transition itself is compare-and-swap: the
 * thread sends the status that was displayed and the database refuses a stale
 * submission.
 */
export function MessageModerationControl({
  action,
  onCancel,
  onConfirm,
}: MessageModerationControlProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const baseId = `moderate-${action}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const ok = await onConfirm(reason);
      if (!ok) setError("That could not be saved. Try again.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <label htmlFor={`${baseId}-reason`} className="text-fg text-sm font-medium">
        {MODERATION_LABELS[action]} — why?
      </label>
      <Textarea
        id={`${baseId}-reason`}
        value={reason}
        disabled={isPending}
        required
        minLength={3}
        maxLength={500}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Short reason for the audit log"
        className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          loading={isPending}
          disabled={isPending || reason.trim().length < 3}
        >
          Confirm
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
