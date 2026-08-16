import {
  HouseLineIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Badge } from "@/components/origin/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getAuthorizationSnapshot } from "@/lib/permissions";
import { CLAN_MEMBER_ROLE_LABELS, CLAN_PRIVACY_SHORT_LABELS } from "@/lib/clans/labels";
import { loadClanList } from "@/lib/clans/loaders";

export default async function ClansPage() {
  const [clansResult, authorization] = await Promise.all([
    loadClanList(),
    getAuthorizationSnapshot(),
  ]);

  const canManageClans =
    authorization.allowed && authorization.permissionNames.includes("admin.manage_clans");
  const canManageRanks =
    authorization.allowed && authorization.permissionNames.includes("rank.manage");
  const canManageBadges =
    authorization.allowed && authorization.permissionNames.includes("badge.manage");
  const authenticated = authorization.allowed;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-fg text-3xl font-semibold">Clans &amp; Casas</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Belong to a Casa, take responsibility for areas of knowledge, and carry its name.
          </p>
        </div>
        {canManageClans ? (
          <Button asChild>
            <Link href="/clans/new">
              <UserPlusIcon aria-hidden="true" className="h-4 w-4" />
              Create clan
            </Link>
          </Button>
        ) : null}
      </div>

      <nav
        aria-label="Clan tools"
        className="text-fg-muted mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"
      >
        {canManageRanks ? (
          <Link className="hover:text-fg hover:underline" href="/clans/ranks">
            Manage ranks
          </Link>
        ) : null}
        {canManageBadges ? (
          <Link className="hover:text-fg hover:underline" href="/clans/badges">
            Manage badges
          </Link>
        ) : null}
        {authenticated ? (
          <Link className="hover:text-fg hover:underline" href="/clans/connections">
            Friends &amp; blocks
          </Link>
        ) : null}
      </nav>

      {clansResult.status === "error" ? (
        <div role="alert" className="mt-8">
          <EmptyState
            icon={<ShieldIcon className="h-8 w-8" />}
            title="Clans temporarily unavailable"
            description="We could not load the clans and casas. Try again."
            action={{ label: "Try again", href: "/clans" }}
          />
        </div>
      ) : clansResult.data.length > 0 ? (
        <div className="border-border divide-border mt-8 divide-y rounded-md border">
          {clansResult.data.map((clan) => (
            <Link
              key={clan.id}
              href={`/clans/${clan.slug}`}
              className="duration-fast hover:bg-surface focus-visible:ring-border-focus flex min-h-16 items-center gap-4 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
            >
              <div className="text-brand-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent">
                <HouseLineIcon aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-fg flex items-center gap-2 text-sm font-medium wrap-break-word">
                  {clan.name}
                  {clan.caller_role ? (
                    <Badge variant="outline" size="sm">
                      {CLAN_MEMBER_ROLE_LABELS[clan.caller_role]}
                    </Badge>
                  ) : null}
                </span>
                {clan.description ? (
                  <p className="text-fg-muted truncate text-xs">{clan.description}</p>
                ) : null}
                <p className="text-fg-subtle mt-0.5 text-xs">Led by {clan.leader_display_name}</p>
              </div>
              <div className="text-right">
                <p className="text-fg-muted flex items-center justify-end gap-1.5 text-xs">
                  <UsersThreeIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  {clan.member_count}
                </p>
                <p className="text-fg-subtle mt-0.5 text-xs">
                  {CLAN_PRIVACY_SHORT_LABELS[clan.privacy]}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<HouseLineIcon className="h-8 w-8" />}
          title={canManageClans ? "No clans yet" : "No clans yet"}
          description={
            canManageClans
              ? "Create the first Casa to give the community a place to belong."
              : "The first Casa has not been created yet. Come back soon."
          }
          action={canManageClans ? { label: "Create clan", href: "/clans/new" } : undefined}
          className="mt-8"
        />
      )}
    </main>
  );
}
