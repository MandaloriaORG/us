"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  AtIcon,
  BellIcon,
  BellRingingIcon,
  ChatCircleIcon,
  ChatTextIcon,
  CheckIcon,
  EnvelopeIcon,
  HeartIcon,
  MegaphoneIcon,
  ShieldIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  getNotificationBellState,
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
  report_resolved: CheckIcon,
};

const POLL_INTERVAL_MS = 60_000;

/**
 * The notification bell. Self-contained and ready to mount anywhere in the
 * signed-in chrome: it polls the unread state, shows a count badge, and opens a
 * short preview panel that links to the full notification center.
 *
 * The count is capped at 99 — the unread read has no count RPC, so the badge
 * reports the fetched ceiling rather than guessing at a number.
 */
export function NotificationBell({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const state = await getNotificationBellState(8);
    setSignedIn(state.signedIn);
    setUnreadCount(state.unreadCount);
    setRecent(state.recent);
  }, []);

  useEffect(() => {
    refresh();

    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!signedIn) return null;

  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={badge ? `Notifications, ${unreadCount} unread` : "Notifications"}
          aria-haspopup="dialog"
          className={cn(
            "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]",
            className,
          )}
        >
          {unreadCount > 0 ? (
            <BellRingingIcon aria-hidden="true" className="h-5 w-5" />
          ) : (
            <BellIcon aria-hidden="true" className="h-5 w-5" />
          )}
          {badge ? (
            <span className="bg-error text-error-fg absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
              {badge}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-fg text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsRead();
                  setUnreadCount(0);
                  setRecent((current) =>
                    current.map((item) => ({
                      ...item,
                      read_at: item.read_at ?? new Date().toISOString(),
                    })),
                  );
                })
              }
            >
              <CheckIcon aria-hidden="true" className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {recent.length === 0 ? (
            <p className="text-fg-muted px-4 py-8 text-center text-sm">You are all caught up.</p>
          ) : (
            <ul>
              {recent.map((item) => {
                const Icon = TYPE_ICONS[item.type];
                const href = notificationHref(item.type, item.payload as Record<string, unknown>);
                return (
                  <li key={item.notification_id}>
                    <Link
                      href={href}
                      onClick={() => {
                        markNotificationRead(item.notification_id);
                        setOpen(false);
                      }}
                      className="duration-fast hover:bg-surface focus-visible:ring-border-focus flex items-start gap-2.5 px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                    >
                      <span aria-hidden="true" className="text-fg-subtle mt-0.5 shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("text-fg block", !item.read_at && "font-medium")}>
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
                      </span>
                      {!item.read_at ? (
                        <span
                          aria-hidden="true"
                          className="bg-brand mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-border border-t p-2">
          <Button asChild size="sm" variant="ghost" className="w-full">
            <Link href="/holochat/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
