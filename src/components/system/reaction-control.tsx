"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";
import { SmileyIcon } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import type { ContentActionResult, ReactionState } from "@/lib/actions/content";
import type { ReactionType } from "@/lib/content/queries";

/**
 * The Discord picker, lazy-loaded so it only downloads when opened; it ships
 * search + categories + a dark theme.
 */
const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
});

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

  /** Resolve a picked emoji to a reaction key: curated catalog match first
   *  (reputation rules apply), otherwise the raw emoji as a free key (Discord
   *  style, upserted server-side). */
  function pick(emoji: string) {
    const key = reactionTypes.find((r) => r.emoji === emoji)?.key ?? emoji;
    toggle(key);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(state)
        .filter(([, entry]) => entry.reacted || (entry.total !== undefined && entry.total > 0))
        .map(([key, entry]) => {
          const reacted = entry.reacted;
          const catalog = reactionTypes.find((r) => r.key === key);
          const emoji = catalog?.emoji ?? key;
          const label = catalog?.label ?? key;
          return (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={reacted}
              aria-label={`React with ${label} to this ${targetLabel}`}
              disabled={isPending}
              onClick={() => toggle(key)}
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
                {emoji}
              </motion.span>
              {entry.total !== undefined ? (
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
        <PopoverContent align="start" className="w-auto border-0 p-0 shadow-none">
          <EmojiPicker
            theme={Theme.DARK}
            skinTonesDisabled
            searchDisabled={false}
            width="360px"
            height={420}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emoji) => {
              setOpen(false);
              pick(emoji.emoji);
            }}
          />
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
