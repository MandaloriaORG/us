import { notFound } from "next/navigation";

import { getAuthorizationSnapshot } from "@/lib/permissions";
import {
  getChannel,
  getCurrentMember,
  listMessages,
  listReactionTypes,
} from "@/lib/holochat/queries";
import { MessageThread } from "../../message-thread";
import { HolochatRealtimeBridge } from "../../realtime-bridge";

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

  const [page, pinned, reactionTypes, currentMember, snapshot] = await Promise.all([
    listMessages(channel.id, {}),
    listMessages(channel.id, { pinnedOnly: true, pageSize: 25 }),
    listReactionTypes(),
    getCurrentMember(),
    getAuthorizationSnapshot(),
  ]);

  const canModerate = snapshot.allowed && snapshot.permissionNames.includes("chat.moderate");
  const canManage = snapshot.allowed && snapshot.permissionNames.includes("chat.manage");

  // The channel rail and shell live in the shared (channel) layout; only the
  // message feed re-renders here, so switching channels never remounts the
  // sidebar or flashes a full-page skeleton.
  return (
    <>
      <HolochatRealtimeBridge channelId={channel.id} enabled={currentMember !== null} />
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
    </>
  );
}
