"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { addUserNote, deleteUserNote, warnUser } from "@/lib/actions/user-moderation";
import { Textarea } from "@/components/ui/textarea";

export interface CouncilUserNote {
  noteId: string;
  body: string;
  createdAt: string;
  actorId: string | null;
  actorDisplayName: string | null;
}

export interface UserModerationPanelProps {
  targetUserId: string;
  /** `moderation.warn`; the RPC re-checks it, and refuses a protected target. */
  canWarn: boolean;
  notes: CouncilUserNote[];
  /** Only a note's own author may remove it, which the RPC also enforces. */
  viewerId: string | null;
}

/**
 * Warning a member and keeping Council notes about them.
 *
 * DATA CONTRACT — implemented (migration 0011), the two records are opposites:
 * - A **warning** is addressed to the member. `moderation_warn_user` requires
 *   `moderation.warn`, refuses a self-warning and refuses a protected target,
 *   and the member acknowledges it themselves — no moderator can acknowledge on
 *   their behalf, so nothing here offers to.
 * - A **note** is addressed to other moderators and the subject can never read
 *   it. The audit row records that a note was added, never its body, so this is
 *   the only place the wording is ever shown.
 * - Only a note's own author may remove it; the delete control is rendered for
 *   nobody else, and the RPC refuses it regardless.
 *
 * DESIGN:
 * - Two separate forms, because confusing "the member will read this" with "the
 *   member must never read this" is the one mistake this screen must prevent.
 *   Each says who its audience is, next to the field, not in a tooltip.
 * - Notes are a plain list: author, when, body. Not cards — they are homogeneous
 *   entries in one thread of Council commentary.
 */
export function UserModerationPanel({
  targetUserId,
  canWarn,
  notes,
  viewerId,
}: UserModerationPanelProps) {
  const router = useRouter();
  const id = useId();
  const warningId = `${id}-warning`;
  const noteId = `${id}-note`;

  const [warning, setWarning] = useState("");
  const [warningState, setWarningState] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [warningPending, setWarningPending] = useState(false);

  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notePending, setNotePending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function submitWarning() {
    const trimmed = warning.trim();
    if (trimmed.length < 3) {
      setWarningState({ type: "error", message: "The warning must be at least 3 characters." });
      return;
    }

    setWarningPending(true);
    setWarningState(null);

    const result = await warnUser({ userId: targetUserId, reason: trimmed });
    setWarningPending(false);

    if (!result.ok) {
      setWarningState({ type: "error", message: result.message });
      return;
    }

    setWarning("");
    setWarningState({ type: "success", message: "Warning sent to the member." });
    router.refresh();
  }

  async function submitNote() {
    const trimmed = note.trim();
    if (trimmed.length < 3) {
      setNoteError("The note must be at least 3 characters.");
      return;
    }

    setNotePending(true);
    setNoteError(null);

    const result = await addUserNote({ userId: targetUserId, body: trimmed });
    setNotePending(false);

    if (!result.ok) {
      setNoteError(result.message);
      return;
    }

    setNote("");
    router.refresh();
  }

  async function removeNote(id: string) {
    setRemoving(id);
    setNoteError(null);

    const result = await deleteUserNote(id, targetUserId);
    setRemoving(null);

    if (!result.ok) {
      setNoteError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <>
      {canWarn ? (
        <section className="border-border mt-8 border-t pt-6" aria-labelledby={`${id}-warn-title`}>
          <h2 id={`${id}-warn-title`} className="text-fg text-lg font-semibold">
            Warn this member
          </h2>
          <p className="text-fg-muted mt-1 text-sm">
            The member reads this wording and acknowledges it themselves. It is also recorded in the
            audit log.
          </p>

          <div className="mt-4 flex max-w-xl flex-col gap-2">
            <label htmlFor={warningId} className="text-fg text-sm font-medium">
              Warning
            </label>
            <Textarea
              id={warningId}
              value={warning}
              rows={3}
              maxLength={1000}
              disabled={warningPending}
              onChange={(event) => setWarning(event.target.value)}
              className="min-h-20 resize-y"
              placeholder="Explain what must change"
            />
            <p className="text-fg-muted text-xs">3–1000 characters.</p>
          </div>

          {warningState ? (
            <p
              className={`mt-3 text-sm ${warningState.type === "error" ? "text-error" : "text-success"}`}
              role={warningState.type === "error" ? "alert" : "status"}
            >
              {warningState.message}
            </p>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            loading={warningPending}
            disabled={warningPending}
            onClick={() => void submitWarning()}
          >
            Send warning
          </Button>
        </section>
      ) : null}

      <section className="border-border mt-8 border-t pt-6" aria-labelledby={`${id}-notes-title`}>
        <h2 id={`${id}-notes-title`} className="text-fg text-lg font-semibold">
          Council notes
        </h2>
        <p className="text-fg-muted mt-1 text-sm">
          Internal to the Council. This member never sees these, and the audit log records only that
          a note was added.
        </p>

        {notes.length > 0 ? (
          <ol className="divide-border border-border mt-4 divide-y border-y">
            {notes.map((entry) => (
              <li key={entry.noteId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-fg-subtle text-xs">
                    {entry.actorDisplayName ?? "Account removed"} ·{" "}
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </p>
                  {viewerId !== null && entry.actorId === viewerId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={removing === entry.noteId}
                      disabled={removing !== null}
                      onClick={() => void removeNote(entry.noteId)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-fg mt-1 text-sm wrap-break-word whitespace-pre-wrap">
                  {entry.body}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-fg-muted mt-4 text-sm">No notes about this member yet.</p>
        )}

        <div className="mt-4 flex max-w-xl flex-col gap-2">
          <label htmlFor={noteId} className="text-fg text-sm font-medium">
            New note
          </label>
          <Textarea
            id={noteId}
            value={note}
            rows={3}
            maxLength={2000}
            disabled={notePending}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20 resize-y"
            placeholder="Context for other moderators"
          />
          <p className="text-fg-muted text-xs">3–2000 characters.</p>
        </div>

        {noteError ? (
          <p role="alert" className="text-error mt-3 text-sm">
            {noteError}
          </p>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          loading={notePending}
          disabled={notePending}
          onClick={() => void submitNote()}
        >
          Add note
        </Button>
      </section>
    </>
  );
}
