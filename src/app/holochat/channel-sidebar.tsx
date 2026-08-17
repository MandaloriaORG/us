"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { HashIcon, LockKeyIcon, MegaphoneIcon, ShieldIcon } from "@phosphor-icons/react/dist/ssr";

import { plazaHue } from "@/components/system/plaza-chip";
import { cn } from "@/lib/cn";
import { CHAT_CHANNEL_KIND_LABELS, type ChatChannelSummary } from "@/lib/holochat/types";

const KIND_ICONS = {
  public: HashIcon,
  announcements: MegaphoneIcon,
  clan: ShieldIcon,
  private: LockKeyIcon,
} as const;

export interface ChannelSidebarProps {
  channels: ChatChannelSummary[];
  /** The slug of the open channel, for `aria-current`. */
  activeSlug?: string;
  className?: string;
}

/**
 * The channel navigation rail. A vertical list on desktop and a horizontal
 * scroller on narrow viewports; every row is a real link and the open channel
 * is marked with `aria-current` and a Beskar accent bar that slides between
 * rows (transform-only, disabled under reduced motion).
 */
export function ChannelSidebar({ channels, activeSlug, className }: ChannelSidebarProps) {
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Channels" className={cn("border-border bg-bg-raised", className)}>
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:px-2 md:py-3">
        {channels.map((channel) => {
          const Icon = KIND_ICONS[channel.kind];
          const active = channel.slug === activeSlug;
          return (
            <li key={channel.id} className="relative shrink-0 md:shrink">
              <Link
                href={`/holochat/${channel.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
                  active && "bg-surface text-fg font-medium",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-brand" : "text-fg-subtle",
                  )}
                />
                <span className="max-w-40 truncate">{channel.name}</span>
              </Link>
              {active ? (
                reduceMotion ? (
                  <span
                    aria-hidden="true"
                    className="bg-brand absolute inset-x-2 bottom-0 h-0.5 rounded-full md:inset-x-auto md:inset-y-0 md:left-0 md:my-auto md:h-5 md:w-0.5"
                  />
                ) : (
                  <motion.span
                    layoutId="channel-active-bar"
                    aria-hidden="true"
                    className="bg-brand absolute inset-x-2 bottom-0 h-0.5 rounded-full md:inset-x-auto md:inset-y-0 md:left-0 md:my-auto md:h-5 md:w-0.5"
                    transition={{ type: "spring", stiffness: 480, damping: 42 }}
                  />
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The landing channel directory: each channel is a destination with its own
 * identity, so it renders as a card with a monogram emblem tinted from its slug
 * (same treatment as the Plaza directory), its name in the display face, a
 * truncated description preview, and a kind badge for anything but public. A
 * private channel keeps the lock so restricted access never reads as an
 * ordinary public room.
 */
export function ChannelList({
  channels,
  signedIn,
}: {
  channels: ChatChannelSummary[];
  signedIn: boolean;
}) {
  if (channels.length === 0) {
    return (
      <p className="text-fg-muted px-1 py-8 text-center text-sm">No channels are open right now.</p>
    );
  }

  return (
    <div>
      <p className="text-fg-subtle px-1 pb-3 text-xs">
        {signedIn
          ? "Join a channel to take part in the conversation."
          : "Channels are open to read; sign in to send messages."}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {channels.map((channel) => {
          const hue = plazaHue(channel.slug);
          const Icon = KIND_ICONS[channel.kind];
          return (
            <li key={channel.id} className="min-w-0">
              <Link
                href={`/holochat/${channel.slug}`}
                className="group border-border bg-bg-raised duration-fast hover:border-brand/45 focus-visible:ring-border-focus grid min-h-11 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border p-4 transition-all hover:-translate-y-px hover:shadow-lg focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
                  style={{
                    backgroundColor: `hsl(${hue} 26% 19%)`,
                    color: `hsl(${hue} 42% 78%)`,
                    boxShadow: `inset 0 0 0 1px hsl(${hue} 42% 38% / 0.35)`,
                  }}
                >
                  {channel.name.trim().charAt(0).toLocaleUpperCase() || "?"}
                </span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-fg duration-fast group-hover:text-brand text-lg leading-tight font-semibold tracking-tight transition-colors">
                      {channel.name}
                    </span>
                    {channel.kind !== "public" ? (
                      <span className="border-border text-fg-subtle inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
                        <Icon aria-hidden="true" className="h-3 w-3" />
                        {CHAT_CHANNEL_KIND_LABELS[channel.kind]}
                      </span>
                    ) : null}
                  </span>
                  {channel.description ? (
                    <span className="text-fg-muted line-clamp-2 text-sm">
                      {channel.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
