import type { ReactNode } from "react";

import { listChannels } from "@/lib/holochat/queries";
import { ChannelSidebar } from "../channel-sidebar";

/**
 * Shared channel shell. Lives at the `(channel)` route group so it is the
 * SAME layout for every `/holochat/<slug>` — Next.js preserves it while the
 * child page swaps, which is what makes channel switching feel like a desktop
 * app: the rail never unmounts and never shows a loading skeleton. The child
 * `[slug]/page.tsx` renders only the message feed.
 */
export default async function ChannelLayout({ children }: { children: ReactNode }) {
  const channels = await listChannels();

  return (
    <div className="flex h-svh flex-col md:flex-row">
      <ChannelSidebar channels={channels} className="shrink-0 md:w-60 md:border-r" />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
