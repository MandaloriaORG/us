import Link from "next/link";
import { HashIcon, LockKeyIcon, MegaphoneIcon, ShieldIcon } from "@phosphor-icons/react/dist/ssr";

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
 * is marked with `aria-current`, never colour alone.
 */
export function ChannelSidebar({ channels, activeSlug, className }: ChannelSidebarProps) {
  return (
    <nav aria-label="Channels" className={cn("border-border bg-bg-raised", className)}>
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:px-2 md:py-3">
        {channels.map((channel) => {
          const Icon = KIND_ICONS[channel.kind];
          const active = channel.slug === activeSlug;
          return (
            <li key={channel.id} className="shrink-0 md:shrink">
              <Link
                href={`/holochat/${channel.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
                  active && "bg-surface text-fg font-medium",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="max-w-40 truncate">{channel.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The landing channel list: homogeneous rows, each a real navigation link, with
 * the kind as quiet metadata and no fabricated preview content.
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
    <div className="flex flex-col">
      <p className="text-fg-subtle px-1 pb-3 text-xs">
        {signedIn
          ? "Join a channel to take part in the conversation."
          : "Channels are open to read; sign in to send messages."}
      </p>
      <ul className="divide-border divide-y">
        {channels.map((channel) => {
          const Icon = KIND_ICONS[channel.kind];
          return (
            <li key={channel.id}>
              <Link
                href={`/holochat/${channel.slug}`}
                className="duration-fast hover:bg-surface focus-visible:ring-border-focus focus-visible:ring-offset-bg flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <Icon aria-hidden="true" className="text-fg-subtle h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="text-fg flex items-center gap-2 text-sm font-medium">
                    {channel.name}
                    {channel.kind !== "public" ? (
                      <span className="border-border text-fg-subtle rounded-sm border px-1.5 py-0.5 text-[10px] font-normal tracking-wide uppercase">
                        {CHAT_CHANNEL_KIND_LABELS[channel.kind]}
                      </span>
                    ) : null}
                  </span>
                  {channel.description ? (
                    <span className="text-fg-muted mt-0.5 block text-xs">
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
