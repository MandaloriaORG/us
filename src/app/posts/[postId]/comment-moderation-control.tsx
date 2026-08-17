"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { setCommentFlags } from "@/lib/actions/moderation";
import { Input } from "@/components/ui/input";


export interface CommentModerationControlProps {
  commentId: string;
  isPinned: boolean;
  repliesLocked: boolean;
}

/**
 * Pin a comment and lock its replies, for a moderator reading the thread.
 *
 * DATA CONTRACT — implemented (migration 0010): `moderation_set_comment_flags`
 * requires `moderation.hide`, refuses a call that changes no flag, and writes
 * the reason to the audit log. A null flag means "leave alone", so each button
 * sends exactly the one flag it names.
 *
 * DESIGN: a moderator reads far more comments than they act on, so the control
 * is one quiet toggle per comment that opens the reason field only when needed.
 * Removal is not offered here — that is the report queue's decision surface.
 */
export function CommentModerationControl({
  commentId,
  isPinned,
  repliesLocked,
}: CommentModerationControlProps) {
  const router = useRouter();
  const reasonId = `${useId()}-reason`;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<"pin" | "lock" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedReason = reason.trim();
  const reasonInvalid = touched && trimmedReason.length < 3;

  function apply(key: "pin" | "lock", flags: { isPinned?: boolean; repliesLocked?: boolean }) {
    setTouched(true);
    if (trimmedReason.length < 3) return;

    setPending(key);
    setError(null);

    void (async () => {
      const result = await setCommentFlags({ commentId, reason: trimmedReason, ...flags });
      setPending(null);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setReason("");
      setTouched(false);
      setOpen(false);
      router.refresh();
    })();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Moderate
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={reasonId} className="text-fg text-xs font-medium">
        Reason
        <span aria-hidden="true" className="text-error">
          {" "}
          *
        </span>
        <span className="sr-only"> (required)</span>
      </label>
      <Input
        id={reasonId}
        type="text"
        value={reason}
        required
        maxLength={500}
        disabled={pending !== null}
        aria-invalid={reasonInvalid ? true : undefined}
        onBlur={() => setTouched(true)}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Explain the action"
        className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-11 w-full max-w-md rounded-md border px-3 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {reasonInvalid ? (
        <p role="alert" className="text-error text-xs">
          Give a reason of at least 3 characters.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={pending === "pin"}
          disabled={pending !== null}
          onClick={() => apply("pin", { isPinned: !isPinned })}
        >
          {isPinned ? "Unpin comment" : "Pin comment"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={pending === "lock"}
          disabled={pending !== null}
          onClick={() => apply("lock", { repliesLocked: !repliesLocked })}
        >
          {repliesLocked ? "Unlock replies" : "Lock replies"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending !== null}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
