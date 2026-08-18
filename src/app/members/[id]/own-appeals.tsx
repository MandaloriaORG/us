"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createAppeal } from "@/lib/actions/appeals";
import { Textarea } from "@/components/ui/textarea";

export interface OwnModerationActionItem {
  auditLogId: string;
  action: string;
  actionLabel: string;
  reason: string | null;
  createdAt: string;
  appealId: string | null;
  appealStatus: string | null;
  appealStatusLabel: string | null;
  appealDecision: string | null;
}

export interface OwnAppealsProps {
  actions: OwnModerationActionItem[];
}

/**
 * What was done to you, and the argument you made about it.
 *
 * DATA CONTRACT — implemented (migration 0013):
 * - `list_own_moderation_actions` resolves the member from the session, so this
 *   is only ever your own record.
 * - `create_appeal` allows exactly one appeal per action, ever: filing again
 *   after a decision is refused, which is why an action that already has an
 *   appeal shows its status instead of the form.
 * - Filing survives suspension and banning. That is the whole point, and no
 *   check here may quietly undo it.
 *
 * DESIGN: one entry per action, the argument written inline under the action it
 * argues with. A decided appeal keeps the decision visible: it is the answer the
 * member was waiting for, not something to collapse away.
 */
export function OwnAppeals({ actions }: OwnAppealsProps) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) return null;

  async function submit(auditLogId: string) {
    const trimmed = body.trim();
    if (trimmed.length < 20) {
      setError("Your appeal must be at least 20 characters.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await createAppeal({ auditLogId, body: trimmed });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setBody("");
    setOpenFor(null);
    router.refresh();
  }

  return (
    <section className="border-border mt-8 border-t pt-8" aria-labelledby="own-appeals-title">
      <h2 id="own-appeals-title" className="text-fg text-lg font-semibold">
        Moderation actions
      </h2>
      <p className="text-fg-muted mt-1 text-sm">
        Decisions the Council recorded about you. You can appeal each one once.
      </p>

      <ol className="divide-border border-border mt-4 divide-y border-y">
        {actions.map((action) => (
          <li key={action.auditLogId} className="py-4">
            <p className="text-fg text-sm font-medium">{action.actionLabel}</p>
            <p className="text-fg-subtle mt-0.5 text-xs">
              <time dateTime={action.createdAt}>{new Date(action.createdAt).toLocaleString()}</time>
            </p>
            {action.reason ? (
              <p className="text-fg-muted mt-2 text-sm wrap-break-word">{action.reason}</p>
            ) : null}

            {action.appealId ? (
              <div className="mt-3">
                <p className="text-fg-muted text-sm">
                  Appeal {action.appealStatusLabel?.toLocaleLowerCase() ?? "filed"}.
                </p>
                {action.appealDecision ? (
                  <p className="text-fg mt-1 text-sm wrap-break-word">{action.appealDecision}</p>
                ) : null}
              </div>
            ) : openFor === action.auditLogId ? (
              <div className="mt-3 flex max-w-xl flex-col gap-2">
                <label
                  htmlFor={`appeal-${action.auditLogId}`}
                  className="text-fg text-sm font-medium"
                >
                  Your appeal
                </label>
                <Textarea
                  id={`appeal-${action.auditLogId}`}
                  value={body}
                  rows={4}
                  maxLength={2000}
                  disabled={pending}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-24 resize-y"
                  placeholder="Explain why this decision was wrong"
                />
                <p className="text-fg-muted text-xs">
                  20–2000 characters. You can appeal this decision only once.
                </p>
                {error ? (
                  <p role="alert" className="text-error text-xs">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={pending}
                    disabled={pending}
                    onClick={() => void submit(action.auditLogId)}
                  >
                    Send appeal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setOpenFor(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  setOpenFor(action.auditLogId);
                  setBody("");
                  setError(null);
                }}
              >
                Appeal this
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
