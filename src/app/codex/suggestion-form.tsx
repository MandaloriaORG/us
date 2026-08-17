"use client";

import { useRef, useState, useTransition } from "react";
import { SealQuestionIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/origin/textarea";
import { createSuggestion } from "@/lib/actions/codex";

/**
 * Member correction form on a published article. The database enforces one open
 * suggestion per member per article, so a second submission while the first is
 * still open surfaces the database's "already exists" answer.
 */
export function SuggestionForm({ articleId }: { articleId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = String(formData.get("body") ?? "");

    setError(null);
    startTransition(async () => {
      const result = await createSuggestion({ articleId, body });
      if (!result.ok) {
        setError(result.message);
        setFieldError(result.fieldErrors?.body);
        return;
      }
      setOpen(false);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <p className="text-fg-muted text-sm" role="status">
        Thanks — your correction is in the review queue.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-fg-muted text-sm">
          Spotted an error or a gap? Send the Archivists a correction.
        </p>
        <Button
          className="shadow-[0_1px_2px_var(--color-black/20%),0_0_18px_var(--color-brand/20%)]"
          onClick={() => setOpen(true)}
          type="button"
        >
          <SealQuestionIcon aria-hidden="true" className="h-4 w-4" />
          Suggest a correction
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={onSubmit}>
      <label className="text-fg text-sm font-medium" htmlFor={`suggestion-${articleId}`}>
        Suggest a correction
      </label>
      <Textarea
        aria-invalid={fieldError ? true : undefined}
        id={`suggestion-${articleId}`}
        maxLength={2000}
        name="body"
        ref={textareaRef}
        rows={4}
      />
      {fieldError ? (
        <p className="text-error text-xs" role="alert">
          {fieldError}
        </p>
      ) : null}
      {error && !fieldError ? (
        <p className="text-error text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button disabled={pending} loading={pending} size="md" type="submit">
          Send suggestion
        </Button>
        <Button onClick={() => setOpen(false)} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
