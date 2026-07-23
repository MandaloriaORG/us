"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { setCommentStatus, setPostStatus } from "@/lib/actions/moderation";
import { Button } from "@/components/ui/button";

type TargetStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "closed"
  | "archived"
  | "hidden"
  | "quarantined"
  | "deleted_by_author"
  | "deleted_by_moderator";

interface ReportTargetPanelProps {
  targetType: string;
  targetId: string;
  /** Raw `text` from the database; narrowed to `TargetStatus` below. */
  targetStatus: string;
  canHide: boolean;
  canQuarantine: boolean;
  canDelete: boolean;
  canRestore: boolean;
}

const KNOWN_STATUSES = new Set<string>([
  "draft",
  "pending_review",
  "published",
  "closed",
  "archived",
  "hidden",
  "quarantined",
  "deleted_by_author",
  "deleted_by_moderator",
]);

function isKnownStatus(value: string): value is TargetStatus {
  return KNOWN_STATUSES.has(value);
}

interface Transition {
  status: TargetStatus;
  label: string;
  allowed: boolean;
  destructive?: boolean;
}

const STATUS_LABELS: Record<TargetStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  closed: "Closed",
  archived: "Archived",
  hidden: "Hidden",
  quarantined: "Quarantined",
  deleted_by_author: "Removed by its author",
  deleted_by_moderator: "Deleted by a moderator",
};

/**
 * Acting on the reported target: hide, quarantine, delete and restore, one
 * click below the evidence. Each destination needs its own permission
 * (migration 0010) and every transition is compare-and-swap against the
 * status this panel currently displays, so a stale click cannot overwrite
 * another moderator or silently republish content its author removed.
 */
export function ReportTargetPanel({
  targetType,
  targetId,
  targetStatus,
  canHide,
  canQuarantine,
  canDelete,
  canRestore,
}: ReportTargetPanelProps) {
  const router = useRouter();
  const id = useId();
  const reasonId = `${id}-reason`;
  const [status, setStatus] = useState<TargetStatus | null>(
    isKnownStatus(targetStatus) ? targetStatus : null,
  );
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState<TargetStatus | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  if ((targetType !== "post" && targetType !== "comment") || status === null) return null;

  const trimmedReason = reason.trim();
  const reasonInvalid = touched && trimmedReason.length < 3;
  const isPending = pending !== null;

  // `deleted_by_author` is terminal for a moderator except further deletion.
  const transitions: Transition[] =
    status === "deleted_by_author"
      ? [{ status: "deleted_by_moderator", label: "Delete further", allowed: canDelete }]
      : [
          ...(status !== "hidden"
            ? [{ status: "hidden" as const, label: "Hide", allowed: canHide }]
            : []),
          ...(status !== "quarantined"
            ? [{ status: "quarantined" as const, label: "Quarantine", allowed: canQuarantine }]
            : []),
          ...(status !== "deleted_by_moderator"
            ? [
                {
                  status: "deleted_by_moderator" as const,
                  label: "Delete",
                  allowed: canDelete,
                  destructive: true,
                },
              ]
            : []),
          ...(status === "hidden" || status === "quarantined" || status === "deleted_by_moderator"
            ? [{ status: "published" as const, label: "Restore", allowed: canRestore }]
            : []),
        ];

  const visibleTransitions = transitions.filter((transition) => transition.allowed);
  if (visibleTransitions.length === 0) return null;

  async function apply(transition: Transition) {
    setTouched(true);
    if (trimmedReason.length < 3) return;

    setConfirmingDelete(false);
    setPending(transition.status);
    setFeedback(null);

    const mutate = targetType === "post" ? setPostStatus : setCommentStatus;
    const idArgs = targetType === "post" ? { postId: targetId } : { commentId: targetId };

    const result = await mutate({
      ...idArgs,
      expectedStatus: status,
      status: transition.status,
      reason: trimmedReason,
    });

    setPending(null);

    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    setStatus(transition.status);
    setReason("");
    setTouched(false);
    setFeedback({ type: "success", message: `${transition.label} applied.` });
    router.refresh();
  }

  function requestTransition(transition: Transition) {
    setTouched(true);
    if (trimmedReason.length < 3) return;

    if (transition.destructive) {
      setFeedback(null);
      setConfirmingDelete(true);
      return;
    }

    void apply(transition);
  }

  const deleteTransition = transitions.find((transition) => transition.destructive);

  return (
    <div className="border-border mt-8 border-t pt-6">
      <h2 className="text-fg text-lg font-semibold">Act on this content</h2>
      <p className="text-fg-muted mt-1 text-sm">
        Current state: <span className="font-medium">{STATUS_LABELS[status]}</span>. Changes are
        permission-checked and recorded in the Council audit log.
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
          rows={2}
          maxLength={500}
          disabled={isPending}
          aria-invalid={reasonInvalid ? true : undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => setReason(event.target.value)}
          className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-16 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Explain the action"
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

      {confirmingDelete && deleteTransition ? (
        <div
          className="bg-bg-raised mt-4 max-w-xl rounded-md p-4"
          role="group"
          aria-live="assertive"
        >
          <p className="text-fg text-sm">
            Delete this {targetType}? It stays in the database and can be restored, but readers will
            no longer see it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              loading={pending === deleteTransition.status}
              disabled={isPending}
              onClick={() => void apply(deleteTransition)}
            >
              Confirm delete
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {visibleTransitions.map((transition) => (
            <Button
              key={transition.status}
              type="button"
              variant={transition.destructive ? "destructive" : "secondary"}
              loading={pending === transition.status}
              disabled={isPending}
              onClick={() => requestTransition(transition)}
            >
              {transition.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
