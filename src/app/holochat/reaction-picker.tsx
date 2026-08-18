"use client";

import { useState } from "react";
import { SmileyIcon } from "@phosphor-icons/react/dist/ssr";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
 * Discord-style inline reaction row for a chat message. Only reactions with a
 * positive total (or the caller's own) render as pills; the full catalog lives
 * behind a smiley trigger that opens a grid picker, so a 29-entry catalog stays
 * compact. Counts come from the message row's `reaction_counts`; toggling is a
 * confirmed round-trip through the thread, which applies the server's answer.
 */
export function ReactionPicker({
  reactionTypes,
  counts,
  callerReacted,
  disabled,
  busyKey,
  onToggle,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  if (reactionTypes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactionTypes.map((reaction) => {
        const reacted = callerReacted[reaction.key] === true;
        const total = counts[reaction.key];
        const visible = reacted || (total !== undefined && total > 0);
        if (!visible) return null;
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add reaction"
            disabled={disabled}
            className={cn(
              "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex min-h-8 items-center justify-center rounded-full border border-transparent px-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-50",
            )}
          >
            <SmileyIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-6 gap-1">
            {reactionTypes.map((reaction) => {
              const reacted = callerReacted[reaction.key] === true;
              return (
                <button
                  key={reaction.key}
                  type="button"
                  aria-label={reaction.label}
                  aria-pressed={reacted}
                  disabled={disabled || busyKey === reaction.key}
                  onClick={() => {
                    setOpen(false);
                    onToggle(reaction.key);
                  }}
                  className={cn(
                    "hover:bg-surface focus-visible:ring-border-focus/24 focus-visible:ring-offset-bg flex h-10 w-10 items-center justify-center rounded-md text-[22px] leading-none transition-colors focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 disabled:cursor-wait disabled:opacity-50",
                    reacted && "bg-brand/10",
                  )}
                >
                  <span aria-hidden="true">{reaction.emoji}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
