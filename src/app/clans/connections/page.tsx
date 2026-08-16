import { ArrowLeftIcon, UserListIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadConnections } from "@/lib/clans/identity";
import { loadMemberPicker } from "@/lib/clans/member-picker";
import { getAuthorizationSnapshot } from "@/lib/permissions";

import { AddFriendForm } from "../_components/add-friend-form";
import { ConnectionsControls } from "../_components/connections-controls";
import { MemberSearch } from "../_components/member-search";

interface Props {
  searchParams?: {
    q?: string | string[];
    target?: string | string[];
    name?: string | string[];
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function joinedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export default async function ConnectionsPage({ searchParams }: Props) {
  const authorization = await getAuthorizationSnapshot();
  if (!authorization.allowed) redirect("/auth/login?next=/clans/connections");

  const [connections] = await Promise.all([loadConnections()]);

  const search = (firstValue(searchParams?.q) ?? "").trim().slice(0, 50);
  const memberProfiles = await loadMemberPicker(search);
  const targetId = firstValue(searchParams?.target) ?? "";
  const targetName = firstValue(searchParams?.name) ?? "";
  const pickHref = (memberId: string, memberName: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("target", memberId);
    params.set("name", memberName);
    return `/clans/connections?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/clans"
        className="text-fg-muted duration-fast hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg mb-8 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        All clans
      </Link>

      <h1 className="text-fg text-2xl font-semibold">Connections</h1>
      <p className="text-fg-muted mt-1 text-sm">
        Friend requests, friends, and the members you block.
      </p>

      {connections.status === "error" ? (
        <div role="alert" className="mt-8">
          <EmptyState
            icon={<UserListIcon className="h-8 w-8" />}
            title="Connections temporarily unavailable"
            description="We could not load your connections. Try again."
            action={{ label: "Try again", href: "/clans/connections" }}
          />
        </div>
      ) : (
        <>
          <section className="border-border mt-8 border-t pt-6" aria-labelledby="requests-heading">
            <h2 id="requests-heading" className="text-fg text-sm font-semibold">
              Friend requests
            </h2>
            <div className="mt-3">
              <ConnectionsControls requests={connections.requests} blocks={[]} />
            </div>
          </section>

          <section className="border-border mt-8 border-t pt-6" aria-labelledby="friends-heading">
            <h2 id="friends-heading" className="text-fg text-sm font-semibold">
              Friends
            </h2>
            {connections.friends.length > 0 ? (
              <div className="border-border divide-border mt-3 divide-y rounded-md border">
                {connections.friends.map((friend) => (
                  <Link
                    key={friend.friendId}
                    href={`/members/${friend.friendId}`}
                    className="duration-fast hover:bg-surface focus-visible:ring-border-focus flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                  >
                    <span className="text-fg flex-1 truncate text-sm">{friend.displayName}</span>
                    <span className="text-fg-subtle text-xs">
                      {joinedLabel(friend.friendsSince)
                        ? `Friends since ${joinedLabel(friend.friendsSince)}`
                        : ""}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-fg-subtle mt-3 text-sm">No friends yet. Send a request below.</p>
            )}
          </section>

          <section className="border-border mt-8 border-t pt-6" aria-labelledby="blocked-heading">
            <h2 id="blocked-heading" className="text-fg text-sm font-semibold">
              Blocked members
            </h2>
            {connections.blocks.length > 0 ? (
              <div className="mt-3">
                <ConnectionsControls requests={[]} blocks={connections.blocks} />
              </div>
            ) : (
              <p className="text-fg-subtle mt-3 text-sm">
                Nobody is blocked. Block a member from their profile.
              </p>
            )}
          </section>

          <section className="border-border mt-8 border-t pt-6" aria-labelledby="add-heading">
            <h2 id="add-heading" className="text-fg text-sm font-semibold">
              Add a friend
            </h2>
            {targetId && targetName ? (
              <>
                <AddFriendForm addresseeId={targetId} addresseeName={targetName} />
                <div className="mt-4">
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/clans/connections">Change member</Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-3">
                <MemberSearch search={search} pickHref={pickHref} profiles={memberProfiles} />
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
