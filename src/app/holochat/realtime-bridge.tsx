"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

interface HolochatRealtimeBridgeProps {
  channelId: string;
  /** Channel-level refresh triggers a soft re-fetch; message-level changes
   * trickle through optimistic local state in `MessageThread`. */
  enabled: boolean;
}

/**
 * Subscribes the current page to Supabase Realtime for `chat_messages` on the
 * given channel. Any insert/update/delete refreshes the route so the server-
 * rendered list stays the source of truth for moderation visibility and pin
 * changes. The companion `<MessageThread>` uses `router.refresh()` as its
 * hook — we keep this thin and silent so the bridge can be dropped into any
 * page that owns a chat channel.
 *
 * Errors from the realtime transport degrade silently: the page already loads
 * via SSR and polling is not implemented, so a logged-out client simply sees no
 * live updates without breaking the read path.
 */
export function HolochatRealtimeBridge({ channelId, enabled }: HolochatRealtimeBridgeProps) {
  const router = useRouter();
  const ref = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !channelId) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat_messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          // Soft refresh: server re-renders the thread with the canonical list,
          // preserving client focus/scroll state for the composer.
          router.refresh();
        },
      )
      .subscribe();

    ref.current = channel;

    return () => {
      if (ref.current) {
        supabase.removeChannel(ref.current);
        ref.current = null;
      }
    };
  }, [channelId, enabled, router]);

  return null;
}