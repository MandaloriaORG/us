"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowClockwiseIcon,
  ChatCircleIcon,
  LockKeyIcon,
  MegaphoneIcon,
  PushPinIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/system/notification-bell";
import type { ReactionType } from "@/lib/content/queries";
import type { ChatChannelDetail, ChatMessage, ChatMessageStatus } from "@/lib/holochat/types";
import {
  deleteChatMessage,
  getChatMessagesPage,
  moderationSetChatMessageStatus,
  moderationToggleChatMessagePin,
  sendChatMessage,
  toggleChatReaction,
  updateChatMessage,
} from "@/lib/actions/holochat";
import { MessageItem } from "./message-item";
import { MessageComposer, type ComposerReply } from "./message-composer";

export interface MessageThreadProps {
  channel: ChatChannelDetail;
  slug: string;
  /** Newest-first, as returned by the read RPC. */
  initialMessages: ChatMessage[];
  nextCursor: string | null;
  initialPinned: ChatMessage[];
  reactionTypes: ReactionType[];
  currentUser: { id: string; displayName: string } | null;
  canSend: boolean;
  canModerate: boolean;
  canManage: boolean;
}

interface EditTarget {
  id: string;
  body: string;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startDay) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const options: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: "long", day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en", options).format(d);
}

export function MessageThread({
  channel,
  slug,
  initialMessages,
  nextCursor,
  initialPinned,
  reactionTypes,
  currentUser,
  canSend,
  canModerate,
  canManage,
}: MessageThreadProps) {
  // Newest-first, matching the RPC; rendering reverses so the oldest shows first.
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [olderCursor, setOlderCursor] = useState<string | null>(nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>(initialPinned);
  const [replyTo, setReplyTo] = useState<ComposerReply | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [reactionBusyKey, setReactionBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const notice = !canSend
    ? channel.kind === "announcements"
      ? "Only the Council can post to this channel."
      : "Sign in to send messages."
    : null;

  const displayed = pinnedOnly ? pinnedMessages : [...messages].reverse();

  function applyMessage(messageId: string, update: (message: ChatMessage) => ChatMessage) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? update(message) : message)),
    );
  }

  function findMessage(messageId: string): ChatMessage | undefined {
    return messages.find((message) => message.id === messageId);
  }

  async function handleLoadOlder() {
    if (!olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    const page = await getChatMessagesPage({
      channelId: channel.id,
      cursor: olderCursor,
    });
    // Newer of the two pages: older rows join the end of the newest-first array.
    setMessages((current) => [...current, ...page.items]);
    setOlderCursor(page.nextCursor);
    setLoadingOlder(false);
  }

  async function handleTogglePinned() {
    const next = !pinnedOnly;
    setPinnedOnly(next);
    if (next) {
      const page = await getChatMessagesPage({
        channelId: channel.id,
        pinnedOnly: true,
        pageSize: 25,
      });
      setPinnedMessages(page.items);
    }
  }

  async function handleSubmit(body: string, parentId: string | null, editingId: string | null) {
    if (editingId) {
      const result = await updateChatMessage({ messageId: editingId, slug, body });
      if (!result.ok) {
        setActionError(result.message);
        return false;
      }
      applyMessage(editingId, (message) => ({
        ...message,
        body,
        edited_at: new Date().toISOString(),
      }));
      setEditing(null);
      return true;
    }

    if (!currentUser) return false;
    const result = await sendChatMessage({ channelId: channel.id, slug, body, parentId });
    if (!result.ok) {
      setActionError(result.message);
      return false;
    }

    const sent: ChatMessage = {
      id: result.messageId,
      parent_id: parentId,
      author_id: currentUser.id,
      author_display_name: currentUser.displayName,
      body,
      status: "visible",
      is_pinned: false,
      replies_count: 0,
      edited_at: null,
      reaction_counts: {},
      caller_reacted: {},
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [sent, ...current]);
    setReplyTo(null);
    return true;
  }

  async function handleEdit(message: ChatMessage) {
    setEditing({ id: message.id, body: message.body ?? "" });
  }

  async function handleDelete(messageId: string) {
    const result = await deleteChatMessage({ messageId, slug });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    applyMessage(messageId, (message) => ({
      ...message,
      status: "deleted",
      author_id: null,
      author_display_name: null,
      body: null,
    }));
  }

  async function handleToggleReaction(messageId: string, reactionKey: string) {
    if (reactionBusyKey) return;
    setReactionBusyKey(reactionKey);
    const result = await toggleChatReaction({ messageId, slug, reactionKey });
    setReactionBusyKey(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    applyMessage(messageId, (message) => {
      const counts = { ...message.reaction_counts };
      counts[result.reactionKey] = result.total;
      const callerReacted = { ...message.caller_reacted };
      if (result.callerReacted) callerReacted[result.reactionKey] = true;
      else delete callerReacted[result.reactionKey];
      return { ...message, reaction_counts: counts, caller_reacted: callerReacted };
    });
  }

  async function handleModerate(
    messageId: string,
    expectedStatus: ChatMessageStatus,
    status: ChatMessageStatus,
    reason: string,
  ) {
    const result = await moderationSetChatMessageStatus({
      messageId,
      expectedStatus,
      status,
      reason,
    });
    if (!result.ok) {
      setActionError(result.message);
      return false;
    }
    applyMessage(messageId, (message) => ({ ...message, status }));
    if (status === "deleted") {
      setPinnedMessages((current) => current.filter((message) => message.id !== messageId));
    }
    return true;
  }

  async function handleTogglePin(messageId: string, expectedPinned: boolean, isPinned: boolean) {
    const result = await moderationToggleChatMessagePin({ messageId, expectedPinned, isPinned });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    applyMessage(messageId, (message) => ({ ...message, is_pinned: isPinned }));
    setPinnedMessages((current) => {
      if (isPinned) {
        const message = findMessage(messageId);
        if (message && !current.some((item) => item.id === messageId)) {
          return [...current, message];
        }
        return current;
      }
      return current.filter((item) => item.id !== messageId);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border bg-bg-raised flex items-start justify-between gap-3 border-b px-3 py-2.5 md:px-4">
        <div className="min-w-0">
          <h1 className="text-fg flex items-center gap-2 text-base font-semibold">
            {channel.kind === "announcements" ? (
              <MegaphoneIcon aria-hidden="true" className="h-4 w-4" />
            ) : null}
            {channel.kind === "private" ? (
              <LockKeyIcon aria-hidden="true" className="text-fg-subtle h-4 w-4" />
            ) : null}
            <span className="truncate">{channel.name}</span>
          </h1>
          {channel.description ? (
            <p className="text-fg-muted mt-0.5 truncate text-xs">{channel.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={pinnedOnly}
            onClick={handleTogglePinned}
          >
            <PushPinIcon aria-hidden="true" className="h-4 w-4" />
            Pinned
          </Button>
          {canManage ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/holochat/manage">Manage</Link>
            </Button>
          ) : null}
          <NotificationBell />
        </div>
      </header>

      {actionError ? (
        <p role="alert" className="text-error border-border border-b px-4 py-2 text-xs">
          {actionError}
        </p>
      ) : null}

      <div
        className="flex-1 overflow-y-auto py-3"
        aria-live="polite"
        aria-label={`Messages in ${channel.name}`}
      >
        {pinnedOnly ? (
          <div className="border-border bg-bg-raised flex items-center gap-2 border-b px-3 py-2 text-xs md:px-4">
            <PushPinIcon aria-hidden="true" className="text-fg-subtle h-3.5 w-3.5" />
            <span className="text-fg-muted">Pinned messages</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setPinnedOnly(false)}
            >
              View all messages
            </Button>
          </div>
        ) : (
          <div className="border-border flex items-center justify-center border-b px-3 py-1.5 md:px-4">
            {olderCursor ? (
              <button
                type="button"
                onClick={handleLoadOlder}
                disabled={loadingOlder}
                className="text-fg-subtle hover:text-fg focus-visible:ring-border-focus inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-wait"
              >
                <ArrowClockwiseIcon aria-hidden="true" className="h-3.5 w-3.5" />
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            ) : null}
          </div>
        )}

        {displayed.length === 0 ? (
          pinnedOnly ? (
            <div className="text-fg-muted flex flex-col items-center gap-2 px-4 py-12 text-center">
              <PushPinIcon aria-hidden="true" className="text-fg-subtle h-6 w-6" />
              <p className="text-sm">Nothing is pinned in this channel.</p>
              <p className="text-fg-subtle text-xs">Pin a message to keep it easy to find.</p>
            </div>
          ) : (
            <div className="text-fg-muted flex flex-col items-center gap-2 px-4 py-12 text-center">
              <ChatCircleIcon aria-hidden="true" className="text-fg-subtle h-6 w-6" />
              <p className="text-sm">Start the conversation.</p>
              <p className="text-fg-subtle text-xs">Be the first to post in #{channel.name}.</p>
            </div>
          )
        ) : (
          <MessageList
            messages={displayed}
            currentUser={currentUser}
            canSend={canSend}
            canModerate={canModerate}
            reactionTypes={reactionTypes}
            reactionBusyKey={reactionBusyKey}
            findMessage={findMessage}
            onReply={(target) =>
              setReplyTo({
                id: target.id,
                authorName: target.author_display_name ?? "a member",
              })
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleReaction={handleToggleReaction}
            onModerate={handleModerate}
            onTogglePin={handleTogglePin}
          />
        )}
      </div>

      {!pinnedOnly ? (
        <MessageComposer
          canSend={canSend}
          notice={notice}
          replyTo={replyTo}
          editing={editing}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

/**
 * The oldest-first scroll feed. Inserts a quiet day divider whenever the date
 * changes and fades the feed in on mount (transform-only, disabled under
 * reduced motion).
 */
function MessageList({
  messages,
  currentUser,
  canSend,
  canModerate,
  reactionTypes,
  reactionBusyKey,
  findMessage,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onModerate,
  onTogglePin,
}: {
  messages: ChatMessage[];
  currentUser: { id: string; displayName: string } | null;
  canSend: boolean;
  canModerate: boolean;
  reactionTypes: ReactionType[];
  reactionBusyKey: string | null;
  findMessage: (messageId: string) => ChatMessage | undefined;
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
}) {
  const reduceMotion = useReducedMotion();
  const now = new Date();

  return (
    <motion.ul
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {messages.map((message, index) => {
        const prev = messages[index - 1];
        const showDivider = !prev || dayKey(prev.created_at) !== dayKey(message.created_at);
        const parent = message.parent_id ? findMessage(message.parent_id) : undefined;
        const parentAuthor =
          parent?.status !== "deleted" && parent?.author_display_name
            ? parent.author_display_name
            : null;
        return (
          <Fragment key={message.id}>
            {showDivider ? (
              <li className="flex items-center gap-3 px-4 py-2">
                <span className="bg-border h-px flex-1" />
                <span className="text-fg-subtle text-xs">{dayLabel(message.created_at, now)}</span>
                <span className="bg-border h-px flex-1" />
              </li>
            ) : null}
            <MessageItem
              message={message}
              parentAuthor={parentAuthor}
              currentUser={currentUser}
              canSend={canSend}
              canModerate={canModerate}
              reactionTypes={reactionTypes}
              reactionBusyKey={reactionBusyKey}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleReaction={onToggleReaction}
              onModerate={onModerate}
              onTogglePin={onTogglePin}
            />
          </Fragment>
        );
      })}
    </motion.ul>
  );
}
