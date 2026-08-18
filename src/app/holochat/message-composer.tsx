"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowBendUpLeftIcon,
  LockKeyIcon,
  PaperPlaneRightIcon,
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
  /** Display name of the open channel, for the contextual placeholder. */
  channelName?: string;
  replyTo: ComposerReply | null;
  editing: { id: string; body: string } | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  /** Returns true when the server accepted the write. */
  onSubmit: (body: string, parentId: string | null, editingId: string | null) => Promise<boolean>;
}

const MAX_ROWS_PX = 156; // ~4 lines at the 38px single-line height.

/**
 * The send / reply / edit composer. Owns the textarea and its pending and error
 * state; the thread owns the action call and the message list. The reply and
 * edit banners are explicit and dismissible, and dismissal never silently loses
 * text the member already typed in the textarea. The textarea auto-grows from
 * one line up to ~4 while typing, Discord-style.
 */
export function MessageComposer({
  canSend,
  notice,
  channelName,
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

  function resizeInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }

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
        requestAnimationFrame(resizeInput);
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

  const hint = channelName ? `Message #${channelName}` : "Write a message…";

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-bg-raised border-t px-3 py-3 md:px-4"
    >
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

        <label htmlFor="chat-message" className="sr-only">
          {hint}
        </label>
        <div className="border-border bg-surface focus-within:ring-border-focus/24 flex items-end gap-2 rounded-lg border p-2 transition-shadow focus-within:ring-[3px]">
          <Textarea
            id="chat-message"
            ref={textareaRef}
            value={body}
            disabled={isPending}
            maxLength={4000}
            rows={1}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setBody(event.target.value);
              resizeInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={hint}
            className="bg-transparent min-h-9 max-h-[156px] resize-none border-0 p-1.5 text-sm shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            loading={isPending}
            disabled={isPending || body.trim().length === 0}
            aria-label={editing ? "Save changes" : "Send message"}
            className="mb-0.5 shrink-0"
          >
            {!isPending ? <PaperPlaneRightIcon aria-hidden="true" className="h-4 w-4" /> : null}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center gap-3 px-1">
          {error ? (
            <p role="alert" className="text-error text-xs">
              {error}
            </p>
          ) : (
            <>
              <span className="text-fg-subtle hidden text-xs sm:inline">
                Enter to send · Shift+Enter for a new line
              </span>
              <span className="text-fg-subtle ml-auto text-xs tabular-nums">
                {body.length}/4000
              </span>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
