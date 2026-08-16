"use client";

import { useTransition, useState } from "react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { toggleBookmark } from "@/lib/actions/codex";

/**
 * Save/unsave an article. The mutation is idempotent and safe to repeat, so the
 * button waits for the server answer rather than guessing optimistically.
 */
export function BookmarkButton({
  articleId,
  initialBookmarked,
}: {
  articleId: string;
  initialBookmarked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleBookmark(articleId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBookmarked(result.bookmarked);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        aria-pressed={bookmarked}
        disabled={pending}
        onClick={onToggle}
        size="md"
        variant={bookmarked ? "secondary" : "ghost"}
      >
        <BookmarkSimpleIcon
          aria-hidden="true"
          className="h-4 w-4"
          weight={bookmarked ? "fill" : "regular"}
        />
        {bookmarked ? "Saved" : "Save article"}
      </Button>
      {error ? (
        <span className="text-error text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
