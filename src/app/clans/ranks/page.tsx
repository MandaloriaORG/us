import { ArrowLeftIcon, MedalIcon, ShieldIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setRankStatus } from "@/lib/actions/clans";
import { RANK_STATUS_LABELS } from "@/lib/clans/labels";
import { loadMemberPicker } from "@/lib/clans/member-picker";
import { loadRankList } from "@/lib/clans/loaders";
import { can } from "@/lib/permissions";

import { AssignRankForm } from "../_components/assign-rank-form";
import { MemberSearch } from "../_components/member-search";
import { RankForm } from "../_components/rank-form";
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

export default async function RanksPage({ searchParams }: Props) {
  const access = await can("rank.manage");
  if (!access.allowed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div role="alert">
          <EmptyState
            icon={<ShieldIcon className="h-8 w-8" />}
            title="Administration required"
            description="Only holders of rank.manage can define global ranks."
            action={{ label: "All clans", href: "/clans" }}
          />
        </div>
      </main>
    );
  }

  const [ranksResult] = await Promise.all([loadRankList()]);

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
    return `/clans/ranks?${params.toString()}`;
  };

  const ranks = ranksResult.status === "ok" ? ranksResult.data : [];
  const activeRanks = ranks.filter((rank) => rank.status === "active");
  const editingRank = editSlug ? ranks.find((rank) => rank.slug === editSlug) : undefined;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/clans"
        className="text-fg-muted duration-fast hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg mb-8 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        All clans
      </Link>

      <h1 className="text-fg text-2xl font-semibold">Ranks</h1>
      <p className="text-fg-muted mt-1 text-sm">
        Global ranks show progression next to a member&apos;s name. Ranks grant no permissions.
      </p>

      {ranksResult.status === "error" ? (
        <div role="alert" className="mt-8">
          <EmptyState
            icon={<MedalIcon className="h-8 w-8" />}
            title="Ranks temporarily unavailable"
            description="We could not load the ranks. Try again."
            action={{ label: "Try again", href: "/clans/ranks" }}
          />
        </div>
      ) : (
        <>
          <section className="border-border mt-8 border-t pt-6" aria-labelledby="ranks-heading">
            <h2 id="ranks-heading" className="text-fg text-sm font-semibold">
              Defined ranks
            </h2>
            {ranks.length > 0 ? (
              <div className="border-border divide-border mt-3 divide-y rounded-md border">
                {ranks.map((rank) => (
                  <div
                    key={rank.slug}
                    className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2.5"
                  >
                    <span className="text-fg flex items-center gap-2 text-sm font-medium">
                      {rank.color ? (
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: rank.color }}
                        />
                      ) : null}
                      {rank.name}
                    </span>
                    <span className="text-fg-subtle text-xs">
                      {RANK_STATUS_LABELS[rank.status]}
                    </span>
                    {rank.description ? (
                      <span className="text-fg-muted min-w-0 flex-1 truncate text-xs">
                        {rank.description}
                      </span>
                    ) : (
                      <span className="min-w-0 flex-1" />
                    )}
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/clans/ranks?edit=${rank.slug}`}>Edit</Link>
                      </Button>
                      <ReasonActionForm
                        action={setRankStatus}
                        hidden={{
                          slug: rank.slug,
                          expectedStatus: rank.status,
                          status: rank.status === "active" ? "retired" : "active",
                        }}
                        buttonLabel={rank.status === "active" ? "Retire" : "Restore"}
                        variant={rank.status === "active" ? "ghost" : "secondary"}
                        successMessage={
                          rank.status === "active" ? "Rank retired." : "Rank restored."
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-fg-subtle mt-3 text-sm">
                No ranks defined yet. Create the first one below.
              </p>
            )}
          </section>

          <section className="border-border mt-8 border-t pt-6" aria-labelledby="rank-form-heading">
            <h2 id="rank-form-heading" className="text-fg text-sm font-semibold">
              {editingRank ? `Edit ${editingRank.name}` : "New rank"}
            </h2>
            <RankForm
              editSlug={editingRank?.slug}
              initialName={editingRank?.name ?? ""}
              initialDescription={editingRank?.description ?? null}
              initialColor={editingRank?.color ?? null}
              initialSortOrder={editingRank?.sort_order ?? 0}
            />
            {editingRank ? (
              <div className="mt-3">
                <Button asChild variant="secondary" size="sm">
                  <Link href="/clans/ranks">Cancel edit</Link>
                </Button>
              </div>
            ) : null}
          </section>

          <section className="border-border mt-8 border-t pt-6" aria-labelledby="assign-heading">
            <h2 id="assign-heading" className="text-fg text-sm font-semibold">
              Assign a rank
            </h2>
            {targetId && targetName ? (
              <AssignRankForm
                userId={targetId}
                userName={targetName}
                ranks={activeRanks.map((rank) => ({ slug: rank.slug, name: rank.name }))}
              />
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
