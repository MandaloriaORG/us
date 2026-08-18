import Link from "next/link";
import { ArrowLeftIcon, GearIcon } from "@phosphor-icons/react/dist/ssr";

import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/permissions";
import { adminListChannels, listChannels } from "@/lib/holochat/queries";
import { ArchivedChannels } from "./archived-channels";
import { ChannelAdmin } from "./channel-admin";

export const metadata = {
  title: "Manage channels · Holochat",
  description: "Create, edit and archive Holochat channels.",
};

export default async function ManageChannelsPage() {
  const { allowed } = await can("chat.manage");

  if (!allowed) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 md:px-6">
        <EmptyState
          icon={<GearIcon aria-hidden="true" className="h-8 w-8" />}
          title="Channel administration is restricted"
          description="Only the Council can create, edit or archive channels."
          action={{ label: "Back to Holochat", href: "/holochat" }}
        />
      </div>
    );
  }

  const [channels, admin] = await Promise.all([listChannels(), adminListChannels()]);
  const archivedChannels = admin.filter((channel) => channel.status === "archived");

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-6 md:px-6">
      <header className="mb-6">
        <Link
          href="/holochat"
          className="text-fg-subtle hover:text-fg focus-visible:ring-border-focus mb-3 inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
          Back to Holochat
        </Link>
        <h1 className="text-fg text-xl font-semibold">Manage channels</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Create channels, edit their details, and control who can reach them.
        </p>
      </header>

      <ChannelAdmin channels={channels} />
      <ArchivedChannels archived={archivedChannels} />
    </div>
  );
}
