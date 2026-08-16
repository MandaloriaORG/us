"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowBendUpLeftIcon, DotsThreeIcon, PushPinIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renderMarkdown } from "@/lib/content/markdown";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { ReactionType } from "@/lib/content/queries";
import type {
  CallerReactions,
  ChatMessage,
  ChatMessageStatus,
  ReactionCounts,
} from "@/lib/holochat/types";
import { ReactionPicker } from "./reaction-picker";
import { ChatReportControl } from "./chat-report-control";
import { MessageModerationControl, type ModerationAction } from "./message-moderation-control";

export interface MessageItemProps {
  message: ChatMessage;
  /** Author of the parent, when the parent is in the loaded page. */
  parentAuthor: string | null;
  currentUser: { id: string; displayName: string } | null;
  canSend: boolean;
  canModerate: boolean;
  reactionTypes: ReactionType[];
  reactionBusyKey?: string | null;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onToggleReaction: (messageId: string, reactionKey: string) => void;
  onModerate: (
    messageId: string,
    expectedStatus: ChatMessageStatus,
    status: ChatMessageStatus,
    reason: string,
  ) => Promise<boolean>;
  onTogglePin: (messageId: string, expectedPinned: boolean, isPinned: boolean) => void;
}

export function MessageItem({
  message,
  parentAuthor,
  currentUser,
  canSend,
  canModerate,
  reactionTypes,
  reactionBusyKey,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onModerate,
  onTogglePin,
}: MessageItemProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [moderation, setModeration] = useState<ModerationAction | null>(null);

  const own = currentUser?.id === message.author_id;
  const visible = message.status === "visible";

  if (message.status === "deleted") {
    return (
      <li className="text-fg-subtle border-border border-b px-3 py-2 text-xs md:px-4">
        This message was deleted.
      </li>
    );
  }

  const reactions: ReactionCounts = message.reaction_counts ?? {};
  const callerReacted: CallerReactions = message.caller_reacted ?? {};

  function confirmModeration(reason: string) {
    if (!moderation) return Promise.resolve(false);
    const status: ChatMessageStatus =
      moderation === "hide" ? "hidden" : moderation === "restore" ? "visible" : "deleted";
    const ok = onModerate(message.id, message.status, status, reason);
    ok.then((accepted) => {
      if (accepted) setModeration(null);
    });
    return ok;
  }

  return (
    <li
      className={cn(
        "group border-border hover:bg-surface/60 relative border-b px-3 py-2 transition-colors md:px-4",
        message.parent_id && "border-l-2",
      )}
    >
      <div className="flex items-center gap-2">
        {message.is_pinned ? (
          <PushPinIcon aria-label="Pinned" className="text-fg-subtle h-3.5 w-3.5 shrink-0" />
        ) : null}
        {message.author_id ? (
          <Link
            href={`/members/${message.author_id}`}
            className="text-fg focus-visible:ring-border-focus rounded-sm text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
          >
            {message.author_display_name ?? "Member"}
          </Link>
        ) : (
          <span className="text-fg text-sm font-semibold">Member</span>
        )}
        <time className="text-fg-subtle text-xs" dateTime={message.created_at}>
          {formatRelativeTime(message.created_at)}
        </time>
        {message.edited_at ? <span className="text-fg-subtle text-xs">(edited)</span> : null}
      </div>

      {parentAuthor ? (
        <p className="text-fg-subtle mt-0.5 flex items-center gap-1 text-xs">
          <ArrowBendUpLeftIcon aria-hidden="true" className="h-3 w-3" />
          in reply to {parentAuthor}
        </p>
      ) : null}

      {message.body ? (
        <div
          className="text-fg chat-body [&_a]:text-brand [&_pre]:bg-surface-raised [&_code]:bg-surface-raised mt-1 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-sm [&_code]:px-1 [&_li]:my-1 [&_p]:my-1.5 [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-xs"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
        />
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ReactionPicker
          reactionTypes={reactionTypes}
          counts={reactions}
          callerReacted={callerReacted}
          disabled={!canSend}
          busyKey={reactionBusyKey}
          onToggle={(key) => onToggleReaction(message.id, key)}
        />

        {canModerate || own || (canSend && !own && visible) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for a message from ${message.author_display_name ?? "a member"}`}
                className="text-fg-subtle opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              >
                <DotsThreeIcon aria-hidden="true" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canSend && !own && visible ? (
                <DropdownMenuItem onSelect={() => onReply(message)}>Reply</DropdownMenuItem>
              ) : null}
              {own && visible ? (
                <DropdownMenuItem onSelect={() => onEdit(message)}>Edit</DropdownMenuItem>
              ) : null}
              {canSend && !own && visible ? (
                <DropdownMenuItem onSelect={() => setReportOpen(true)}>Report</DropdownMenuItem>
              ) : null}

              {canModerate ? (
                <>
                  {!own && (
                    <>
                      <DropdownMenuSeparator />
                      {message.status === "hidden" ? (
                        <DropdownMenuItem onSelect={() => setModeration("restore")}>
                          Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setModeration("hide")}>
                          Hide
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => setModeration("delete")}
                        className="text-error"
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onTogglePin(message.id, message.is_pinned, !message.is_pinned)}
                  >
                    {message.is_pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                </>
              ) : null}

              {own ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onDelete(message.id)} className="text-error">
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {reportOpen ? (
        <div className="mt-3">
          <ChatReportControl messageId={message.id} onClose={() => setReportOpen(false)} />
        </div>
      ) : null}

      {moderation ? (
        <div className="mt-3">
          <MessageModerationControl
            messageId={message.id}
            action={moderation}
            expectedStatus={message.status}
            onCancel={() => setModeration(null)}
            onConfirm={confirmModeration}
          />
        </div>
      ) : null}
    </li>
  );
}
