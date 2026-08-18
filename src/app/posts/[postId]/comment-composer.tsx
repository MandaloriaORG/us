"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ContentActionResult } from "@/lib/actions/content";
import { Textarea } from "@/components/ui/textarea";

export interface CommentComposerProps {
  id: string;
  label: string;
  submitLabel: string;
  placeholder?: string;
  initialValue?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<ContentActionResult<{ commentId: string }>>;
  onSuccess: () => void;
  onCancel?: () => void;
}

/**
 * Shared textarea + submit used for the top-level composer, a reply, and an
 * inline comment edit. Never optimistic: it waits for the server's answer
 * before calling `onSuccess`, which is where the caller triggers a refresh.
 */
export function CommentComposer({
  id,
  label,
  submitLabel,
  placeholder,
  initialValue = "",
  autoFocus,
  onSubmit,
  onSuccess,
  onCancel,
}: CommentComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = value.trim();
    if (!body) return;

    setError(null);
    startTransition(async () => {
      const result = await onSubmit(body);
      if (!result.ok) {
        setError(result.fieldErrors?.body ?? result.message);
        return;
      }
      if (!initialValue) setValue("");
      onSuccess();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        required
        disabled={isPending}
        autoFocus={autoFocus}
        placeholder={placeholder ?? "Write a comment…"}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-20 resize-y"
      />
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={isPending} disabled={isPending || !value.trim()}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
