"use client";

import { useState, useTransition } from "react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { ReactionControl } from "@/components/system/reaction-control";
import { VoteControl } from "@/components/system/vote-control";
import { Button } from "@/components/ui/button";
import { setPostVote, toggleBookmark, togglePostReaction } from "@/lib/actions/content";
import { cn } from "@/lib/cn";
import type { ReactionType } from "@/lib/content/queries";

export interface PostEngagementProps {
  postId: string;
  initialLikes: number;
  initialDislikes: number;
  initialVote: number;
  initialBookmarked: boolean;
  reactionTypes: ReactionType[];
}

/**
 * Vote, bookmark and reaction controls for a post. All three are cheap and
 * reversible, so all three are optimistic: the toggle applies immediately and
 * rolls back on a refused request.
 */
export function PostEngagement({
  postId,
  initialLikes,
  initialDislikes,
  initialVote,
  initialBookmarked,
  reactionTypes,
}: PostEngagementProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    const next = !bookmarked;
    setBookmarked(next);
    setError(null);

    startTransition(async () => {
      const result = await toggleBookmark(postId);
      if (!result.ok) {
        setBookmarked(!next);
        setError(result.message);
        return;
      }
      setBookmarked(result.bookmarked);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <VoteControl
          targetLabel="post"
          initialLikes={initialLikes}
          initialDislikes={initialDislikes}
          initialVote={initialVote}
          onVote={(value) => setPostVote(postId, value)}
        />
        <Button
          type="button"
          variant="ghost"
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark this post"}
          disabled={isPending}
          onClick={toggle}
          className={cn(bookmarked && "bg-brand/10 text-brand hover:bg-brand/15")}
        >
          <BookmarkSimpleIcon
            aria-hidden="true"
            weight={bookmarked ? "fill" : "regular"}
            className="h-4 w-4"
          />
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </Button>
      </div>
      <ReactionControl
        targetLabel="post"
        reactionTypes={reactionTypes}
        onToggle={(key) => togglePostReaction(postId, key)}
      />
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
