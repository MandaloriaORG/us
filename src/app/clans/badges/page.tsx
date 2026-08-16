import { ArrowLeftIcon, ShieldIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setBadgeStatus } from "@/lib/actions/clans";
import { loadMemberPicker } from "@/lib/clans/member-picker";
import { canAny } from "@/lib/permissions";

import { AwardBadgeForm } from "../_components/award-badge-form";
import { BadgeForm } from "../_components/badge-form";
import { MemberSearch } from "../_components/member-search";
import { ReasonActionForm } from "../_components/reason-action-form";

interface Props {
  searchParams?: {
    q?: string | string[];
    target?: string | string[];
    name?: string | string[];
    edit?: string | string[];
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BadgesPage({ searchParams }: Props) {
  const access = await canAny(["badge.manage", "badge.award"]);
  if (!access.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div role="alert">
          <EmptyState
            icon={<ShieldIcon className="h-8 w-8" />}
            title="Administration required"
            description="Only holders of badge.manage or badge.award can manage badges."
            action={{ label: "All clans", href: "/clans" }}
          />
        </div>
      </main>
    );
  }

  const search = (firstValue(searchParams?.q) ?? "").trim().slice(0, 50);
  const memberProfiles = await loadMemberPicker(search);
  const targetId = firstValue(searchParams?.target) ?? "";
  const targetName = firstValue(searchParams?.name) ?? "";
  const editSlug = firstValue(searchParams?.edit) ?? "";
  const pickHref = (memberId: string, memberName: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("target", memberId);
    params.set("name", memberName);
    return `/clans/badges?${params.toString()}`;
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

      <h1 className="text-fg text-2xl font-semibold">Badges</h1>
      <p className="text-fg-muted mt-1 text-sm">
        Badges verify achievements. Awards keep their history; revocation is a status, never a
        delete.
      </p>

      <section className="border-border mt-8 border-t pt-6" aria-labelledby="badge-form-heading">
        <h2 id="badge-form-heading" className="text-fg text-sm font-semibold">
          {editSlug ? `Edit badge ${editSlug}` : "New badge"}
        </h2>
        <BadgeForm editSlug={editSlug} />
        {editSlug ? (
          <div className="mt-3">
            <Button asChild variant="secondary" size="sm">
              <Link href="/clans/badges">Cancel edit</Link>
            </Button>
          </div>
        ) : null}
      </section>

      <section className="border-border mt-8 border-t pt-6" aria-labelledby="retire-heading">
        <h2 id="retire-heading" className="text-fg text-sm font-semibold">
          Retire a badge
        </h2>
        <div className="mt-3">
          <ReasonActionForm
            action={setBadgeStatus}
            hidden={{ expectedStatus: "active", status: "retired" }}
            fields={[{ name: "slug", label: "Badge slug", type: "text", required: true }]}
            buttonLabel="Retire badge"
            description="Retired badges stay visible on profiles but can no longer be awarded."
            variant="secondary"
            successMessage="Badge retired."
          />
        </div>
      </section>

      <section className="border-border mt-8 border-t pt-6" aria-labelledby="award-heading">
        <h2 id="award-heading" className="text-fg text-sm font-semibold">
          Award a badge
        </h2>
        {targetId && targetName ? (
          <AwardBadgeForm userId={targetId} userName={targetName} />
        ) : (
          <div className="mt-3">
            <MemberSearch search={search} pickHref={pickHref} profiles={memberProfiles} />
          </div>
        )}
      </section>
    </main>
  );
}
