"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowBendUpLeftIcon, DotsThreeIcon, PushPinIcon } from "@phosphor-icons/react/dist/ssr";

import { Avatar } from "@/components/ui/avatar";
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
import { EditHistoryViewer } from "./edit-history-viewer";
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

/**
 * A deterministic Beskar-family tint per author, so a thread reads as a
 * conversation of people without leaving the gold/amber identity. The hue is
 * derived from the name and stays inside the brand's warm range.
 */
function authorTone(name: string): { text: string; chip: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = 28 + (hash % 33);
  return {
    text: `hsl(${hue} 42% 70%)`,
    chip: `hsl(${hue} 32% 24% / 0.5)`,
  };
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
  const [editHistoryOpen, setEditHistoryOpen] = useState(false);

  const own = currentUser?.id === message.author_id;
  const visible = message.status === "visible";

  if (message.status === "deleted") {
    return (
      <li className="text-fg-subtle border-border border-b px-4 py-2.5 text-xs md:px-4">
        This message was deleted.
      </li>
    );
  }

  const reactions: ReactionCounts = message.reaction_counts ?? {};
  const callerReacted: CallerReactions = message.caller_reacted ?? {};
  const authorName = message.author_display_name ?? "Member";
  const tone = authorTone(authorName);

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
        "group relative flex items-end gap-2 px-3 py-1.5 md:px-4",
        own && "flex-row-reverse",
      )}
    >
      {message.author_id ? (
        <Avatar
          name={authorName}
          src={message.authorAvatarUrl}
          className="ring-border-raised h-8 w-8 text-[10px] ring-1"
          alt=""
        />
      ) : (
        <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full" />
      )}

      <div
        className={cn("flex max-w-[86%] min-w-0 flex-col gap-1", own ? "items-end" : "items-start")}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-0.5">
          {message.is_pinned ? (
            <PushPinIcon aria-label="Pinned" className="text-fg-subtle h-3.5 w-3.5 shrink-0" />
          ) : null}
          {message.author_id ? (
            <Link
              href={`/members/${message.author_id}`}
              className="focus-visible:ring-border-focus inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors hover:brightness-125 focus-visible:ring-2 focus-visible:outline-hidden"
              style={{ backgroundColor: tone.chip, color: tone.text }}
            >
              {authorName}
            </Link>
          ) : (
            <span
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: tone.chip, color: tone.text }}
            >
              Member
            </span>
          )}
          <time className="text-fg-subtle text-xs" dateTime={message.created_at}>
            {formatRelativeTime(message.created_at)}
          </time>
          {message.edited_at ? <span className="text-fg-subtle text-xs">(edited)</span> : null}
        </div>

        {parentAuthor ? (
          <p className="text-fg-subtle flex items-center gap-1 px-0.5 text-xs">
            <ArrowBendUpLeftIcon aria-hidden="true" className="h-3 w-3" />
            in reply to {parentAuthor}
          </p>
        ) : null}

        {message.body ? (
          <div
            className={cn(
              "[&_pre]:bg-surface-raised [&_code]:bg-surface-raised border px-3 py-2 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-sm [&_code]:px-1 [&_li]:my-1 [&_p]:my-1.5 [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-xs [&_pre]:shadow-[inset_0_1px_0_var(--color-border-raised)]",
              own
                ? "border-brand/40 from-brand to-brand-deep text-brand-fg [&_pre]:text-fg [&_code]:text-fg rounded-lg rounded-tr-sm bg-linear-to-b shadow-[0_1px_0_var(--color-white/10%)] [&_a]:font-semibold"
                : "border-border bg-bg-raised text-fg [&_a]:text-brand rounded-lg rounded-tl-sm shadow-[inset_0_1px_0_var(--color-border-raised)]",
            )}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
          />
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5",
            own ? "justify-end" : "justify-start",
          )}
        >
          <ReactionPicker
            reactionTypes={reactionTypes}
            counts={reactions}
            callerReacted={callerReacted}
            disabled={!canSend}
            busyKey={reactionBusyKey}
            onToggle={(key) => onToggleReaction(message.id, key)}
          />

          {canSend && !own && visible ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onReply(message)}
              className="text-fg-subtle opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
            >
              <ArrowBendUpLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
              Reply
            </Button>
          ) : null}

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
                {(own || canModerate) && message.edited_at ? (
                  <DropdownMenuItem onSelect={() => setEditHistoryOpen(true)}>
                    Edit history
                  </DropdownMenuItem>
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
                      onSelect={() =>
                        onTogglePin(message.id, message.is_pinned, !message.is_pinned)
                      }
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
          <div className="mt-2">
            <ChatReportControl messageId={message.id} onClose={() => setReportOpen(false)} />
          </div>
        ) : null}

        {moderation ? (
          <div className="mt-2">
            <MessageModerationControl
              messageId={message.id}
              action={moderation}
              expectedStatus={message.status}
              onCancel={() => setModeration(null)}
              onConfirm={confirmModeration}
            />
          </div>
        ) : null}

        {editHistoryOpen ? (
          <div className="mt-2">
            <EditHistoryViewer
              currentBody={message.body}
              messageId={message.id}
              onClose={() => setEditHistoryOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
