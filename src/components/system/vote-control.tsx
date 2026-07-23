"use client";

import { useState, useTransition } from "react";
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
 * Like/dislike control for a post or a comment. Vote/reaction/bookmark are the
 * cheap, reversible mutations the design brief allows to be optimistic: the
 * count updates immediately, then is corrected from the server's answer, or
 * rolled back with an inline error if the request is refused.
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

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size={size}
        aria-pressed={vote === 1}
        aria-label={`Like this ${targetLabel}`}
        disabled={isPending}
        onClick={() => cast(1)}
        className={cn(vote === 1 && "bg-brand/10 text-brand hover:bg-brand/15")}
      >
        <ThumbsUpIcon
          aria-hidden="true"
          weight={vote === 1 ? "fill" : "regular"}
          className="h-4 w-4"
        />
        <span className="tabular-nums">{likes}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={size}
        aria-pressed={vote === -1}
        aria-label={`Dislike this ${targetLabel}`}
        disabled={isPending}
        onClick={() => cast(-1)}
        className={cn(vote === -1 && "bg-error/10 text-error hover:bg-error/15")}
      >
        <ThumbsDownIcon
          aria-hidden="true"
          weight={vote === -1 ? "fill" : "regular"}
          className="h-4 w-4"
        />
        <span className="tabular-nums">{dislikes}</span>
      </Button>
      {error ? (
        <span role="alert" className="text-error text-xs">
          {error}
        </span>
      ) : null}
    </div>
  );
}
