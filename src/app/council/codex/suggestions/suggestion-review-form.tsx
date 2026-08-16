"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/origin/textarea";
import { reviewSuggestion } from "@/lib/actions/codex";
import type { SuggestionQueueRow } from "@/lib/codex/queries";

export function SuggestionReviewForm({
  expectedStatus,
  suggestion,
}: {
  expectedStatus: "open";
  suggestion: SuggestionQueueRow;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex gap-2">
        <Button onClick={() => setOpen(true)} size="sm" type="button" variant="secondary">
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
          Review
        </Button>
      </div>
    );
  }

  function decide(status: "accepted" | "rejected" | "merged") {
    setError(null);
    startTransition(async () => {
      const result = await reviewSuggestion({
        suggestionId: suggestion.suggestion_id,
        expectedStatus,
        status,
        reviewNote: note,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setNote("");
    });
  }

  return (
    <form
      className="border-border bg-surface flex flex-col gap-2 rounded-md border p-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <label
        className="text-fg text-sm font-medium"
        htmlFor={`review-note-${suggestion.suggestion_id}`}
      >
        Review note
      </label>
      <Textarea
        id={`review-note-${suggestion.suggestion_id}`}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Why is this accepted, rejected or merged?"
        rows={2}
        value={note}
      />
      {error ? (
        <p className="text-error text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || note.trim().length < 3}
          loading={pending}
          onClick={() => decide("accepted")}
          size="sm"
          type="button"
        >
          Accept
        </Button>
        <Button
          disabled={pending || note.trim().length < 3}
          onClick={() => decide("rejected")}
          size="sm"
          type="button"
          variant="secondary"
        >
          Reject
        </Button>
        <Button
          onClick={() => decide("merged")}
          disabled={pending || note.trim().length < 3}
          size="sm"
          type="button"
          variant="ghost"
        >
          Mark merged
        </Button>
        <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
