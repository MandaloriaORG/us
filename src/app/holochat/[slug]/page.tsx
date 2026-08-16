import { notFound } from "next/navigation";

import { getAuthorizationSnapshot } from "@/lib/permissions";
import {
  getChannel,
  getCurrentMember,
  listChannels,
  listMessages,
  listReactionTypes,
} from "@/lib/holochat/queries";
import { ChannelSidebar } from "../channel-sidebar";
import { MessageThread } from "../message-thread";

interface ChannelPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ChannelPageProps) {
  const { slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) return { title: "Holochat" };
  return { title: `${channel.name} · Holochat`, description: channel.description ?? undefined };
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();

  const [channels, page, pinned, reactionTypes, currentMember, snapshot] = await Promise.all([
    listChannels(),
    listMessages(channel.id, {}),
    listMessages(channel.id, { pinnedOnly: true, pageSize: 25 }),
    listReactionTypes(),
    getCurrentMember(),
    getAuthorizationSnapshot(),
  ]);

  const canModerate = snapshot.allowed && snapshot.permissionNames.includes("chat.moderate");
  const canManage = snapshot.allowed && snapshot.permissionNames.includes("chat.manage");

  return (
    <div className="flex h-svh flex-col md:flex-row">
      <ChannelSidebar
        channels={channels}
        activeSlug={slug}
        className="shrink-0 md:w-60 md:border-r"
      />
      <MessageThread
        key={channel.id}
        channel={channel}
        slug={slug}
        initialMessages={page.items}
        nextCursor={page.nextCursor}
        initialPinned={pinned.items}
        reactionTypes={reactionTypes}
        currentUser={currentMember}
        canSend={channel.can_send}
        canModerate={canModerate}
        canManage={canManage}
      />
    </div>
  );
}
