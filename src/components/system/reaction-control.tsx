"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ContentActionResult, ReactionState } from "@/lib/actions/content";
import type { ReactionType } from "@/lib/content/queries";

export interface ReactionControlProps {
  /** Names the target in the accessible label, e.g. "post" or "comment". */
  targetLabel: string;
  /** The administrator-configured catalog from `listReactionTypes()`. */
  reactionTypes: ReactionType[];
  onToggle: (reactionKey: string) => Promise<ContentActionResult<ReactionState>>;
}

interface LocalReaction {
  /** Undefined until the server has answered once: there is no read RPC for
   *  existing totals, so a total is only known after this browser toggles it. */
  total?: number;
  reacted: boolean;
}

/**
 * Renders whatever reaction catalog the administrator configured — never a
 * fixed set. Toggling is optimistic and reversible; the total badge only
 * appears once the server has actually reported one for that key.
 */
export function ReactionControl({ targetLabel, reactionTypes, onToggle }: ReactionControlProps) {
  const [state, setState] = useState<Record<string, LocalReaction>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (reactionTypes.length === 0) return null;

  function toggle(key: string) {
    if (isPending) return;
    const previous = state[key] ?? { reacted: false };
    setState((current) => ({ ...current, [key]: { ...previous, reacted: !previous.reacted } }));
    setError(null);

    startTransition(async () => {
      const result = await onToggle(key);
      if (!result.ok) {
        setState((current) => ({ ...current, [key]: previous }));
        setError(result.message);
        return;
      }
      setState((current) => ({
        ...current,
        [key]: { total: result.total, reacted: result.callerReacted },
      }));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactionTypes.map((reaction) => {
        const entry = state[reaction.key];
        const reacted = entry?.reacted ?? false;
        return (
          <Button
            key={reaction.key}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={reacted}
            aria-label={`React with ${reaction.label} to this ${targetLabel}`}
            disabled={isPending}
            onClick={() => toggle(reaction.key)}
            className={cn(reacted && "bg-brand/10 text-brand hover:bg-brand/15 font-medium")}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.label}</span>
            {entry?.total !== undefined ? (
              <span className="text-fg-subtle tabular-nums">{entry.total}</span>
            ) : null}
          </Button>
        );
      })}
      {error ? (
        <span role="alert" className="text-error text-xs">
          {error}
        </span>
      ) : null}
    </div>
  );
}
