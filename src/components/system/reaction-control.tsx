"use client";

import { useState, useTransition } from "react";
import { SmileyIcon } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
 * Discord-style reaction row. Only reactions with a known positive total (or
 * the caller's own) render as inline pills; the full catalog lives behind a
 * smiley trigger that opens a grid picker, so a 29-entry catalog stays compact.
 * Toggling is optimistic and reversible; the total badge only appears once the
 * server has actually reported one for that key. The emoji pops once when the
 * reaction lands, so the toggle is felt as a small burst rather than a silent
 * colour change; reduced-motion users still get the pressed state and fill.
 */
export function ReactionControl({ targetLabel, reactionTypes, onToggle }: ReactionControlProps) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<Record<string, LocalReaction>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
        const visible = reacted || (entry?.total !== undefined && entry.total > 0);
        if (!visible) return null;
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
            className={cn(
              "gap-1 transition-all active:scale-95",
              reacted && "bg-brand/10 text-brand hover:bg-brand/15 font-medium",
            )}
          >
            <motion.span
              aria-hidden="true"
              animate={!reduced && reacted ? { scale: [1, 1.45, 1] } : { scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="inline-flex"
            >
              {reaction.emoji}
            </motion.span>
            {entry?.total !== undefined ? (
              <span className="text-fg-subtle tabular-nums">{entry.total}</span>
            ) : null}
          </Button>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Add reaction"
            disabled={isPending}
          >
            <SmileyIcon aria-hidden="true" className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-6 gap-1">
            {reactionTypes.map((reaction) => {
              const reacted = state[reaction.key]?.reacted ?? false;
              return (
                <button
                  key={reaction.key}
                  type="button"
                  aria-label={reaction.label}
                  aria-pressed={reacted}
                  disabled={isPending}
                  onClick={() => {
                    setOpen(false);
                    toggle(reaction.key);
                  }}
                  className={cn(
                    "hover:bg-surface focus-visible:ring-border-focus/24 focus-visible:ring-offset-bg flex h-10 w-10 items-center justify-center rounded-md text-[22px] leading-none transition-colors focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 disabled:opacity-50",
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

      {error ? (
        <span role="alert" className="text-error text-xs">
          {error}
        </span>
      ) : null}
    </div>
  );
}
