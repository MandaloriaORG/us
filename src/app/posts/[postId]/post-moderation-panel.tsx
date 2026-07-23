"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/origin/native-select";
import { movePost, setPostFlags, setPostStatus } from "@/lib/actions/moderation";

export interface PostModerationPanelPlaza {
  id: string;
  name: string;
}

export interface PostModerationPanelProps {
  postId: string;
  plazaId: string;
  /** Raw `post_status`; only `published` and `closed` are actionable here. */
  status: string;
  isPinned: boolean;
  isHighlighted: boolean;
  editLocked: boolean;
  plazas: PostModerationPanelPlaza[];
}

/**
 * Moderator controls that are not removals: pin, highlight, lock editing, lock
 * and reopen the thread, and move the post to another Plaza.
 *
 * DATA CONTRACT — implemented, do not change without the RPCs (migration 0010):
 * - `moderation_set_post_flags`, `moderation_move_post` and the `closed`/
 *   `published` transitions all require `moderation.hide` and re-check it inside
 *   the transaction. The `canModerate` gate at the call site decides what to
 *   render, never what is allowed.
 * - A null flag means "leave alone", so only the boxes the moderator actually
 *   changed are sent; sending no change at all is refused by the database and is
 *   refused here first.
 * - The status change is compare-and-swap against the status this panel was
 *   rendered with. A stale click comes back as `conflict`, not an overwrite.
 * - Moving to the Plaza the post is already in is refused, so the current Plaza
 *   is absent from the select.
 * - Every one of these carries a reason and is written to the audit log.
 *
 * DESIGN:
 * - Routine reading must stay quiet, so the whole panel is a native disclosure,
 *   closed by default, below the post's own actions.
 * - One reason field for the three groups: it is required for all of them and
 *   repeating it three times would read as three unrelated forms.
 * - Removals are not here. Hiding, quarantining and deleting belong to the
 *   report queue, where the evidence and the decision live together.
 */
export function PostModerationPanel({
  postId,
  plazaId,
  status,
  isPinned,
  isHighlighted,
  editLocked,
  plazas,
}: PostModerationPanelProps) {
  const router = useRouter();
  const id = useId();
  const reasonId = `${id}-reason`;

  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [flags, setFlags] = useState({ isPinned, isHighlighted, editLocked });
  const [currentStatus, setCurrentStatus] = useState(status);
  const [targetPlaza, setTargetPlaza] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  const trimmedReason = reason.trim();
  const reasonInvalid = touched && trimmedReason.length < 3;
  const isPending = pending !== null;

  const flagsChanged =
    flags.isPinned !== isPinned ||
    flags.isHighlighted !== isHighlighted ||
    flags.editLocked !== editLocked;

  const otherPlazas = plazas.filter((plaza) => plaza.id !== plazaId);
  const canChangeStatus = currentStatus === "published" || currentStatus === "closed";

  async function run(key: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setTouched(true);
    if (trimmedReason.length < 3) return;

    setPending(key);
    setFeedback(null);

    const result = await action();
    setPending(null);

    if (!result.ok) {
      setFeedback({ type: "error", message: result.message ?? "The change could not be saved." });
      return;
    }

    setReason("");
    setTouched(false);
    router.refresh();
  }

  function saveFlags() {
    void run("flags", async () => {
      const result = await setPostFlags({
        postId,
        reason: trimmedReason,
        // Only what changed; an unchanged flag stays null so the database leaves it alone.
        isPinned: flags.isPinned === isPinned ? null : flags.isPinned,
        isHighlighted: flags.isHighlighted === isHighlighted ? null : flags.isHighlighted,
        editLocked: flags.editLocked === editLocked ? null : flags.editLocked,
      });
      if (result.ok) setFeedback({ type: "success", message: "Flags updated." });
      return result;
    });
  }

  function changeStatus() {
    const destination = currentStatus === "closed" ? "published" : "closed";
    void run("status", async () => {
      const result = await setPostStatus({
        postId,
        expectedStatus: currentStatus,
        status: destination,
        reason: trimmedReason,
      });
      if (result.ok) {
        setCurrentStatus(destination);
        setFeedback({
          type: "success",
          message: destination === "closed" ? "Post locked." : "Post reopened.",
        });
      }
      return result;
    });
  }

  function move() {
    if (!targetPlaza) return;
    void run("move", async () => {
      const result = await movePost({ postId, plazaId: targetPlaza, reason: trimmedReason });
      if (result.ok) {
        setTargetPlaza("");
        setFeedback({ type: "success", message: "Post moved." });
      }
      return result;
    });
  }

  return (
    <details className="border-border mt-4 border-t pt-4">
      <summary className="text-fg-muted hover:text-fg focus-visible:ring-border-focus flex min-h-11 cursor-pointer items-center text-sm focus-visible:ring-2 focus-visible:outline-hidden">
        Moderation
      </summary>

      <div className="mt-2 flex max-w-xl flex-col gap-2">
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

      <fieldset className="mt-6">
        <legend className="text-fg text-sm font-medium">Flags</legend>
        <div className="mt-2 flex flex-col gap-2">
          {(
            [
              { key: "isPinned", label: "Pinned in its Plaza" },
              { key: "isHighlighted", label: "Highlighted" },
              { key: "editLocked", label: "Editing locked for the author" },
            ] as const
          ).map((flag) => (
            <label key={flag.key} className="text-fg flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flags[flag.key]}
                disabled={isPending}
                onChange={(event) =>
                  setFlags((current) => ({ ...current, [flag.key]: event.target.checked }))
                }
                className="border-border accent-brand h-4 w-4 rounded-sm border"
              />
              {flag.label}
            </label>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          loading={pending === "flags"}
          disabled={isPending || !flagsChanged}
          onClick={saveFlags}
        >
          Save flags
        </Button>
      </fieldset>

      {canChangeStatus ? (
        <div className="mt-6">
          <p className="text-fg text-sm font-medium">Thread</p>
          <p className="text-fg-muted mt-1 text-sm">
            {currentStatus === "closed"
              ? "This post is locked; it accepts no new comments."
              : "This post is open to comments."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            loading={pending === "status"}
            disabled={isPending}
            onClick={changeStatus}
          >
            {currentStatus === "closed" ? "Reopen post" : "Lock post"}
          </Button>
        </div>
      ) : null}

      {otherPlazas.length > 0 ? (
        <div className="mt-6 flex max-w-xl flex-col gap-2">
          <NativeSelect
            id={`${id}-plaza`}
            label="Move to another Plaza"
            value={targetPlaza}
            disabled={isPending}
            onChange={(event) => setTargetPlaza(event.target.value)}
          >
            <option value="">Keep it where it is</option>
            {otherPlazas.map((plaza) => (
              <option key={plaza.id} value={plaza.id}>
                {plaza.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            loading={pending === "move"}
            disabled={isPending || targetPlaza === ""}
            onClick={move}
          >
            Move post
          </Button>
        </div>
      ) : null}
    </details>
  );
}
