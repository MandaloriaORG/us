"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ContentActionResult, VoteState } from "@/lib/actions/content";

type VoteValue = -1 | 0 | 1;

export interface VoteControlProps {
  /** Names the target in the accessible label, e.g. "post" or "comment". */
  targetLabel: string;
  initialLikes: number;
  initialDislikes: number;
  initialVote: number;
  onVote: (value: VoteValue) => Promise<ContentActionResult<VoteState>>;
  size?: "sm" | "md";
}

/**
 * A tactile up/down vote group. The two directions stack vertically, like a
 * physical lever: each button carries its own count, warms to the brand on
 * hover, and presses down a pixel when clicked. The active vote fills its icon
 * and pops once, so the change is felt, not just read. Reduced-motion users get
 * the colour/fill change without the pop.
 *
 * Vote/reaction/bookmark are the cheap, reversible mutations the design brief
 * allows to be optimistic: the count updates immediately, then is corrected
 * from the server's answer, or rolled back with an inline error if the request
 * is refused.
 *
 * The pressed vote is never colour-only: it also sets `aria-pressed`, swaps
 * the icon to its filled weight, and changes background/foreground together.
 */
export function VoteControl({
  targetLabel,
  initialLikes,
  initialDislikes,
  initialVote,
  onVote,
  size = "md",
}: VoteControlProps) {
  const reduced = useReducedMotion();
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [vote, setVote] = useState<VoteValue>((initialVote as VoteValue) || 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cast(next: VoteValue) {
    if (isPending) return;
    const target: VoteValue = vote === next ? 0 : next;
    const previous = { likes, dislikes, vote };

    setLikes(likes - (vote === 1 ? 1 : 0) + (target === 1 ? 1 : 0));
    setDislikes(dislikes - (vote === -1 ? 1 : 0) + (target === -1 ? 1 : 0));
    setVote(target);
    setError(null);

    startTransition(async () => {
      const result = await onVote(target);
      if (!result.ok) {
        setLikes(previous.likes);
        setDislikes(previous.dislikes);
        setVote(previous.vote);
        setError(result.message);
        return;
      }
      setLikes(result.likesCount);
      setDislikes(result.dislikesCount);
      setVote((result.callerVote as VoteValue) || 0);
    });
  }

  function VoteGlyph({ active, direction }: { active: boolean; direction: 1 | -1 }) {
    const Icon = direction === 1 ? ThumbsUpIcon : ThumbsDownIcon;
    return (
      <motion.span
        aria-hidden="true"
        animate={!reduced && active ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="inline-flex"
      >
        <Icon weight={active ? "fill" : "regular"} className="h-4 w-4" />
      </motion.span>
    );
  }

  const compact = size === "sm";
  const buttonClass = cn(
    "gap-1.5 transition-all active:scale-95",
    compact ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
  );

  return (
    <div className="border-border bg-surface/40 flex flex-col items-stretch gap-px overflow-hidden rounded-lg border p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={vote === 1}
        aria-label={`Like this ${targetLabel}`}
        disabled={isPending}
        onClick={() => cast(1)}
        className={cn(
          buttonClass,
          "rounded-md",
          vote === 1
            ? "bg-brand/10 text-brand hover:bg-brand/15"
            : "hover:bg-brand/5 hover:text-brand",
        )}
      >
        <VoteGlyph active={vote === 1} direction={1} />
        <span className="tabular-nums">{likes}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={vote === -1}
        aria-label={`Dislike this ${targetLabel}`}
        disabled={isPending}
        onClick={() => cast(-1)}
        className={cn(
          buttonClass,
          "rounded-md",
          vote === -1
            ? "bg-error/10 text-error hover:bg-error/15"
            : "hover:bg-error/5 hover:text-error",
        )}
      >
        <VoteGlyph active={vote === -1} direction={-1} />
        <span className="tabular-nums">{dislikes}</span>
      </Button>
      {error ? (
        <span role="alert" className="text-error px-1 pt-1 text-xs">
          {error}
        </span>
      ) : null}
    </div>
  );
}
