"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LinkSimpleIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/origin/text-input";
import { Textarea } from "@/components/origin/textarea";
import { createProposal } from "@/lib/actions/codex";

interface ProposeFormProps {
  initialExternal?: string;
  initialPostId?: string | null;
  initialCommentId?: string | null;
}

export function ProposeForm({
  initialExternal = "",
  initialPostId = null,
  initialCommentId = null,
}: ProposeFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState(initialExternal);

  const hasLinkedSource = Boolean(initialPostId || initialCommentId);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") ?? "");
    const workingTitle = String(formData.get("workingTitle") ?? "").trim();

    setFieldErrors(undefined);
    setError(null);

    startTransition(async () => {
      const result = await createProposal({
        reason,
        workingTitle,
        source: initialPostId
          ? { postId: initialPostId }
          : initialCommentId
            ? { commentId: initialCommentId }
            : { externalUrl: externalUrl.trim() },
      });

      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        return;
      }

      router.push(`/codex/proposals/${result.proposalId}`);
      router.refresh();
    });
  }

  return (
    <form className="mt-6 flex max-w-xl flex-col gap-5" onSubmit={onSubmit}>
      {hasLinkedSource ? (
        <div className="border-border bg-surface rounded-md border p-4">
          <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">Source</p>
          <p className="text-fg mt-1 text-sm">
            {initialPostId
              ? "A conversation you are proposing to preserve."
              : "A comment in a conversation you are proposing to preserve."}
          </p>
        </div>
      ) : (
        <TextInput
          error={fieldErrors?.source}
          icon={LinkSimpleIcon}
          id="proposal-external"
          label="External source"
          onChange={(event) => setExternalUrl(event.target.value)}
          placeholder="https://…"
          type="url"
          value={externalUrl}
        />
      )}

      <TextInput
        error={fieldErrors?.workingTitle}
        id="proposal-working-title"
        label={
          <>
            Working title <span className="text-fg-subtle">(optional)</span>
          </>
        }
        name="workingTitle"
        placeholder="A short title for the article it could become"
      />

      <div className="flex flex-col gap-2">
        <label className="text-fg text-sm font-medium" htmlFor="proposal-reason">
          Why should this be preserved?
        </label>
        <Textarea
          aria-invalid={fieldErrors?.reason ? true : undefined}
          id="proposal-reason"
          maxLength={2000}
          name="reason"
          rows={5}
        />
        {fieldErrors?.reason ? (
          <p className="text-error text-xs" role="alert">
            {fieldErrors.reason}
          </p>
        ) : null}
      </div>

      {error && !fieldErrors ? (
        <p className="text-error text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Button disabled={pending} loading={pending} type="submit">
          <PaperPlaneTiltIcon aria-hidden="true" className="h-4 w-4" />
          Submit proposal
        </Button>
      </div>
    </form>
  );
}
