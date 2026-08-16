"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AtIcon,
  BellRingingIcon,
  ChatCircleIcon,
  ChatTextIcon,
  EnvelopeIcon,
  HeartIcon,
  MegaphoneIcon,
  ShieldIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { NotificationItem } from "@/lib/holochat/types";
import {
  NOTIFICATION_TYPE_SHORT_LABELS,
  notificationHref,
  notificationSummary,
  type NotificationType,
} from "@/lib/holochat/notifications";
import {
  getNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/holochat";

const TYPE_ICONS: Record<NotificationType, typeof ChatCircleIcon> = {
  post_reply: ChatCircleIcon,
  comment_reply: ChatTextIcon,
  reaction: HeartIcon,
  mention: AtIcon,
  friend_request: EnvelopeIcon,
  clan_invite: ShieldIcon,
  warning: WarningIcon,
  announcement: MegaphoneIcon,
};

export interface NotificationCenterProps {
  initialItems: NotificationItem[];
  nextCursor: string | null;
}

export function NotificationCenter({ initialItems, nextCursor }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markRead(notificationId: string) {
    if (busyId) return;
    setBusyId(notificationId);
    startTransition(async () => {
      await markNotificationRead(notificationId);
      setItems((current) =>
        current.map((item) =>
          item.notification_id === notificationId
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
      setBusyId(null);
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
      );
    });
  }

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    const page = await getNotificationsPage({ cursor });
    setItems((current) => [...current, ...page.items]);
    setCursor(page.nextCursor);
    setLoadingOlder(false);
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-fg-muted text-sm">
          {unread === 0
            ? "You are all caught up."
            : `${unread} unread notification${unread === 1 ? "" : "s"}.`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={unread === 0 || isPending}
          onClick={markAllRead}
        >
          Mark all as read
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-fg-muted flex flex-col items-center gap-3 py-12 text-center">
          <BellRingingIcon aria-hidden="true" className="text-fg-subtle h-8 w-8" />
          <p className="text-sm">No notifications yet.</p>
        </div>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            const href = notificationHref(item.type, item.payload as Record<string, unknown>);
            const unread = !item.read_at;
            return (
              <li key={item.notification_id} className="flex items-start gap-3 px-3 py-3 md:px-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-fg-subtle mt-0.5 shrink-0",
                    item.type === "warning" ? "text-error" : undefined,
                    item.type === "announcement" ? "text-brand" : undefined,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className="text-fg duration-fast hover:bg-surface focus-visible:ring-border-focus focus-visible:ring-offset-bg -m-1 block rounded-md p-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                  >
                    <span className={cn(unread ? "font-medium" : undefined)}>
                      {notificationSummary(
                        item.type,
                        item.actor_display_name,
                        item.payload as Record<string, unknown>,
                      )}
                    </span>
                    <span className="text-fg-subtle mt-0.5 block text-xs">
                      {NOTIFICATION_TYPE_SHORT_LABELS[item.type]} ·{" "}
                      <time dateTime={item.created_at}>{formatRelativeTime(item.created_at)}</time>
                    </span>
                  </Link>
                </div>
                {unread ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={busyId === item.notification_id}
                    disabled={Boolean(busyId)}
                    onClick={() => markRead(item.notification_id)}
                    className="shrink-0"
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {cursor ? (
        <div className="mt-4 text-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={loadingOlder}
            onClick={loadOlder}
          >
            {loadingOlder ? "Loading…" : "Load older notifications"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
