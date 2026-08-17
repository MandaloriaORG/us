"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

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

  const groups = useMemo(() => {
    const now = new Date();
    const grouped: { label: string; items: NotificationItem[] }[] = [];
    for (const item of items) {
      const label = dayLabel(item.created_at, now);
      const last = grouped[grouped.length - 1];
      if (last && last.label === label) last.items.push(item);
      else grouped.push({ label, items: [item] });
    }
    return grouped;
  }, [items]);

  const motionProps = reduceMotion
    ? { transition: { duration: 0 } }
    : { transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } };

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

      {groups.length === 0 ? (
        <div className="text-fg-muted flex flex-col items-center gap-3 py-14 text-center">
          <span className="border-border bg-bg-raised flex h-12 w-12 items-center justify-center rounded-full border">
            <BellRingingIcon aria-hidden="true" className="text-fg-subtle h-5 w-5" />
          </span>
          <p className="text-sm">No notifications yet.</p>
          <p className="text-fg-subtle max-w-sm text-xs">
            Replies, reactions and invitations will land here once the community engages with your
            content.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.label}>
              <h3 className="text-fg-subtle mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
                {group.label}
              </h3>
              <ul className="divide-border border-border divide-y rounded-lg border">
                {group.items.map((item) => {
                  const Icon = TYPE_ICONS[item.type];
                  const href = notificationHref(item.type, item.payload as Record<string, unknown>);
                  const isUnread = !item.read_at;
                  return (
                    <li
                      key={item.notification_id}
                      className={cn(
                        "hover:bg-surface/50 relative flex items-start gap-3 px-3 py-3 transition-colors md:px-4",
                        isUnread && "bg-brand/[0.04]",
                      )}
                    >
                      <AnimatePresence>
                        {isUnread ? (
                          <motion.span
                            key="unread-bar"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scaleY: 0 }}
                            className="bg-brand absolute inset-y-2 left-0 w-0.5 origin-top rounded-full"
                            {...motionProps}
                          />
                        ) : null}
                      </AnimatePresence>
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
                          <span className={cn(isUnread && "font-medium")}>
                            {notificationSummary(
                              item.type,
                              item.actor_display_name,
                              item.payload as Record<string, unknown>,
                            )}
                          </span>
                          <span className="text-fg-subtle mt-0.5 block text-xs">
                            {NOTIFICATION_TYPE_SHORT_LABELS[item.type]} ·{" "}
                            <time dateTime={item.created_at}>
                              {formatRelativeTime(item.created_at)}
                            </time>
                          </span>
                        </Link>
                      </div>
                      <AnimatePresence>
                        {isUnread ? (
                          <motion.div
                            key="mark-read"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="shrink-0"
                            {...motionProps}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              loading={busyId === item.notification_id}
                              disabled={Boolean(busyId)}
                              onClick={() => markRead(item.notification_id)}
                            >
                              Mark read
                            </Button>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
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
