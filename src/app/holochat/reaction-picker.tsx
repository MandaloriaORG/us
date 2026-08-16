"use client";

import { cn } from "@/lib/cn";
import type { ReactionType } from "@/lib/content/queries";
import type { CallerReactions, ReactionCounts } from "@/lib/holochat/types";

export interface ReactionPickerProps {
  /** The administrator-configured catalog from `listReactionTypes()`. */
  reactionTypes: ReactionType[];
  counts: ReactionCounts;
  callerReacted: CallerReactions;
  disabled?: boolean;
  /** A single in-flight key, so toggling the same reaction twice is not a race. */
  busyKey?: string | null;
  onToggle: (reactionKey: string) => void;
}

/**
 * Compact inline reaction row for a chat message. Counts come from the message
 * row's `reaction_counts`; toggling is a confirmed round-trip through the
 * thread, which applies the server's answer to the row.
 */
export function ReactionPicker({
  reactionTypes,
  counts,
  callerReacted,
  disabled,
  busyKey,
  onToggle,
}: ReactionPickerProps) {
  if (reactionTypes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactionTypes.map((reaction) => {
        const reacted = callerReacted[reaction.key] === true;
        const total = counts[reaction.key];
        return (
          <button
            key={reaction.key}
            type="button"
            aria-pressed={reacted}
            aria-label={`React with ${reaction.label}`}
            disabled={disabled || busyKey === reaction.key}
            onClick={() => onToggle(reaction.key)}
            className={cn(
              "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex min-h-8 items-center gap-1 rounded-full border border-transparent px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-50",
              reacted && "border-border-raised bg-surface text-fg",
            )}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            {total !== undefined ? (
              <span className="text-fg-subtle tabular-nums">{total}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
