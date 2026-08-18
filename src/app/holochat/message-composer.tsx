"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowBendUpLeftIcon,
  LockKeyIcon,
  PencilSimpleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ComposerReply {
  id: string;
  authorName: string;
}

export interface MessageComposerProps {
  canSend: boolean;
  /** Shown instead of the form when the caller cannot send. */
  notice?: string | null;
  replyTo: ComposerReply | null;
  editing: { id: string; body: string } | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  /** Returns true when the server accepted the write. */
  onSubmit: (body: string, parentId: string | null, editingId: string | null) => Promise<boolean>;
}

/**
 * The send / reply / edit composer. Owns the textarea and its pending and error
 * state; the thread owns the action call and the message list. The reply and
 * edit banners are explicit and dismissible, and dismissal never silently loses
 * text the member already typed in the textarea.
 */
export function MessageComposer({
  canSend,
  notice,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSubmit,
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setBody(editing.body);
      textareaRef.current?.focus();
    }
  }, [editing]);

  if (!canSend) {
    return (
      <div className="border-border bg-bg-raised border-t px-3 py-3 md:px-4">
        <div className="border-border mx-auto flex w-full max-w-3xl items-center gap-3 rounded-lg border border-dashed px-4 py-3">
          <LockKeyIcon aria-hidden="true" className="text-fg-subtle h-4 w-4 shrink-0" />
          <p className="text-fg-muted min-w-0 flex-1 truncate text-sm">{notice}</p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = body.trim();
    if (clean.length === 0) {
      setError("The message cannot be empty.");
      return;
    }
    if (clean.length > 4000) {
      setError("The message must be at most 4000 characters.");
      return;
    }

    setError(null);
    const parentId = replyTo?.id ?? null;
    const editingId = editing?.id ?? null;

    startTransition(async () => {
      const ok = await onSubmit(clean, parentId, editingId);
      if (ok) {
        setBody("");
        return;
      }
      setError("The message could not be sent. Try again.");
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a new line. Touch keyboards need Enter
    // for a newline, so coarse pointers keep the default behavior.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const banner = editing
    ? { label: "Editing a message", onClose: onCancelEdit, icon: PencilSimpleIcon }
    : replyTo
      ? {
          label: `Replying to ${replyTo.authorName}`,
          onClose: onCancelReply,
          icon: ArrowBendUpLeftIcon,
        }
      : null;

  return (
    <form onSubmit={handleSubmit} className="border-border bg-bg-raised border-t px-3 py-3 md:px-4">
      <div className="mx-auto w-full max-w-3xl">
        {banner ? (
          <div className="mb-2 flex items-center gap-2">
            <banner.icon aria-hidden="true" className="text-fg-subtle h-4 w-4" />
            <span className="text-fg-muted text-xs">{banner.label}</span>
            <button
              type="button"
              onClick={banner.onClose}
              aria-label={editing ? "Cancel edit" : "Cancel reply"}
              className="text-fg-subtle hover:text-fg focus-visible:ring-border-focus ml-auto flex h-8 w-8 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-hidden"
            >
              <XIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <label htmlFor="chat-message" className="text-fg mb-1 block text-sm font-medium">
          Message
        </label>
        <Textarea
          id="chat-message"
          ref={textareaRef}
          value={body}
          disabled={isPending}
          maxLength={4000}
          rows={3}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          className="min-h-24 resize-y"
        />
        {error ? (
          <p role="alert" className="text-error mt-2 text-xs">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-fg-subtle hidden text-xs sm:inline">
            Enter to send · Shift+Enter for a new line
          </span>
          <span className="text-fg-subtle mr-auto text-xs tabular-nums sm:mr-auto">
            {body.length}/4000
          </span>
          <Button
            type="submit"
            size="sm"
            loading={isPending}
            disabled={isPending || body.trim().length === 0}
          >
            {editing ? "Save changes" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
