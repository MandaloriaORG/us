import Link from "next/link";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { EmptyState } from "@/components/ui/empty-state";
import { NotificationBell } from "@/components/system/notification-bell";
import { getAuthorizationSnapshot } from "@/lib/permissions";
import { listChannels } from "@/lib/holochat/queries";
import { ChannelList } from "./channel-sidebar";

export const metadata = {
  title: "Holochat",
  description: "Live conversation channels for daily coexistence.",
};

export default async function HolochatPage() {
  const channels = await listChannels();
  const snapshot = await getAuthorizationSnapshot();
  const signedIn = snapshot.allowed;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 md:px-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Holochat</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Live conversation channels. Pick one and join in.
          </p>
        </div>
        <NotificationBell />
      </header>

      {channels.length === 0 ? (
        <EmptyState
          icon={<ChatCircleIcon aria-hidden="true" className="h-8 w-8" />}
          title="No channels yet"
          description="The Council has not opened any channels. Check back soon."
        />
      ) : (
        <ChannelList channels={channels} signedIn={signedIn} />
      )}

      {!signedIn && channels.length > 0 ? (
        <p className="text-fg-muted mt-8 text-sm">
          Want to talk?{" "}
          <Link
            href="/auth/login"
            className="text-brand underline underline-offset-2 hover:opacity-80"
          >
            Sign in
          </Link>{" "}
          to send messages and get notified.
        </p>
      ) : null}
    </div>
  );
}
