import { ArrowLeftIcon, ShieldIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadMemberPicker } from "@/lib/clans/member-picker";
import { can } from "@/lib/permissions";

import { ClanCreateForm } from "../_components/clan-create-form";
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

export default async function NewClanPage({ searchParams }: Props) {
  const access = await can("admin.manage_clans");

  if (!access.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div role="alert">
          <EmptyState
            icon={<ShieldIcon className="h-8 w-8" />}
            title="Administration required"
            description="Only administrators can create clans and casas."
            action={{ label: "All clans", href: "/clans" }}
          />
        </div>
      </main>
    );
  }

  const search = (firstValue(searchParams?.q) ?? "").trim().slice(0, 50);
  const memberProfiles = await loadMemberPicker(search);
  const targetId = firstValue(searchParams?.target) ?? "";
  const leaderName = firstValue(searchParams?.name) ?? "the selected member";
  const pickHref = (memberId: string, memberName: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("target", memberId);
    params.set("name", memberName);
    return `/clans/new?${params.toString()}`;
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

      <h1 className="text-fg text-2xl font-semibold">Create a clan</h1>
      <p className="text-fg-muted mt-1 text-sm">
        Choose a leader first — they become the clan&apos;s first member.
      </p>

      <section className="border-border mt-8 border-t pt-6" aria-labelledby="leader-heading">
        <h2 id="leader-heading" className="text-fg text-sm font-semibold">
          Leader
        </h2>
        <div className="mt-3">
          <MemberSearch search={search} pickHref={pickHref} profiles={memberProfiles} />
        </div>
      </section>

      {targetId ? (
        <section className="border-border mt-8 border-t pt-6" aria-labelledby="create-heading">
          <h2 id="create-heading" className="text-fg text-sm font-semibold">
            Clan details
          </h2>
          <ClanCreateForm leaderId={targetId} leaderName={leaderName} />
        </section>
      ) : (
        <p className="text-fg-subtle mt-8 text-sm">
          The clan form appears once a leader is chosen.
        </p>
      )}

      {search ? (
        <div className="mt-4">
          <Button asChild variant="secondary" size="sm">
            <Link href="/clans/new">Clear search</Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
}
