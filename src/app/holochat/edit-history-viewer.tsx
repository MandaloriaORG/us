"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon, ClockCounterClockwiseIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { getChatMessageEdits } from "@/lib/actions/holochat";
import type { ChatMessageEdit } from "@/lib/holochat/types";
import { formatRelativeTime } from "@/lib/time";
import { Button } from "@/components/ui/button";

export interface EditHistoryViewerProps {
  messageId: string;
  /** The message's current body, shown as the "after" of the latest edit. */
  currentBody: string | null;
  onClose: () => void;
}

type LoadState =
  { status: "loading" } | { status: "error" } | { status: "ready"; edits: ChatMessageEdit[] };

/**
 * Edit history for one chat message. Reads `list_chat_message_edits` through a
 * server action; that RPC is scoped to the message author and chat moderators,
 * so anyone else sees the empty state rather than the wording the author has
 * since removed. Each edit row shows the wording it replaced (`old_body`) and
 * the message's current body as the final "after". Read-only, inline, and
 * keyboard-accessible (the trigger is a real button, the panel a labelled
 * region).
 */
export function EditHistoryViewer({ messageId, currentBody, onClose }: EditHistoryViewerProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void getChatMessageEdits({ messageId }).then((edits) => {
      if (!cancelled) setState({ status: "ready", edits });
    });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const titleId = `edit-history-title-${messageId}`;

  return (
    <section
      aria-labelledby={titleId}
      className="border-border bg-bg-raised mt-2 rounded-lg border p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="text-fg flex items-center gap-1.5 text-sm font-semibold">
          <ClockCounterClockwiseIcon aria-hidden="true" className="text-brand h-4 w-4" />
          Edit history
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close edit history"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>

      {state.status === "loading" ? (
        <p className="text-fg-muted mt-2 text-xs" role="status">
          Loading edit history…
        </p>
      ) : state.status === "error" ? (
        <p role="alert" className="text-error mt-2 text-xs">
          Edit history could not be loaded.
        </p>
      ) : state.edits.length === 0 ? (
        <p className="text-fg-muted mt-2 text-xs">This message has not been edited.</p>
      ) : (
        <ol className="divide-border mt-2 flex flex-col divide-y">
          {state.edits.map((edit, index) => {
            const latest = index === 0;
            const after = latest && currentBody ? currentBody : edit.old_body;
            return (
              <li
                key={edit.edit_id}
                className="flex flex-col gap-1 py-2 text-xs first:pt-0 last:pb-0"
              >
                <p className="text-fg-muted">
                  <span className="text-fg font-medium">
                    {edit.editor_display_name ?? "A member"}
                  </span>{" "}
                  edited{" "}
                  <time dateTime={edit.created_at}>{formatRelativeTime(edit.created_at)}</time>
                </p>
                <div className="flex items-start gap-1.5">
                  <span className="text-fg-subtle line-clamp-2 min-w-0 flex-1 break-words">
                    {edit.old_body}
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="text-fg-subtle mt-0.5 h-3 w-3 shrink-0"
                  />
                  <span className="text-fg-subtle line-clamp-2 min-w-0 flex-1 break-words">
                    {after}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
