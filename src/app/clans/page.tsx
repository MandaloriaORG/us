import {
  CaretRightIcon,
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
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-fg font-display text-3xl font-semibold tracking-tight">
            Clans &amp; Casas
          </h1>
          <p className="text-fg-muted mt-2 text-sm">
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
        className="text-fg-muted mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm"
      >
        {canManageRanks ? (
          <Link
            className="duration-fast group hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            href="/clans/ranks"
          >
            Manage ranks
            <CaretRightIcon
              aria-hidden="true"
              className="duration-fast h-3.5 w-3.5 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            />
          </Link>
        ) : null}
        {canManageBadges ? (
          <Link
            className="duration-fast group hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            href="/clans/badges"
          >
            Manage badges
            <CaretRightIcon
              aria-hidden="true"
              className="duration-fast h-3.5 w-3.5 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            />
          </Link>
        ) : null}
        {authenticated ? (
          <Link
            className="duration-fast group hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            href="/clans/connections"
          >
            Friends &amp; blocks
            <CaretRightIcon
              aria-hidden="true"
              className="duration-fast h-3.5 w-3.5 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            />
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
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {clansResult.data.map((clan) => (
            <Link
              key={clan.id}
              href={`/clans/${clan.slug}`}
              className="duration-normal group border-border bg-bg-raised focus-visible:ring-border-focus hover:border-brand/40 focus-visible:ring-offset-bg relative overflow-hidden rounded-lg border transition-[border-color,box-shadow,transform] ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_hsl(42_40%_55%/0.28)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              <div
                aria-hidden="true"
                className="from-brand/70 via-brand-muted/40 h-1 w-full bg-gradient-to-r to-amber-500/25"
              />
              <div className="flex items-start gap-4 p-5">
                <div
                  aria-hidden="true"
                  className="border-brand/30 bg-brand-muted/15 text-brand ring-brand/40 ring-offset-bg flex h-11 w-11 shrink-0 items-center justify-center rounded-md border shadow-[0_0_0_1px_hsl(42_40%_55%/0.14),0_0_18px_-6px_hsl(42_40%_55%/0.5)] ring-1 ring-offset-2"
                >
                  <span className="font-display text-base font-semibold">
                    {clan.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-fg font-display flex items-center gap-2 text-base font-semibold wrap-break-word">
                    {clan.name}
                    {clan.caller_role ? (
                      <Badge variant="outline" size="sm">
                        {CLAN_MEMBER_ROLE_LABELS[clan.caller_role]}
                      </Badge>
                    ) : null}
                  </span>
                  {clan.description ? (
                    <p className="text-fg-muted mt-1 truncate text-xs">{clan.description}</p>
                  ) : null}
                  <p className="text-fg-subtle mt-1.5 text-xs">Led by {clan.leader_display_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-fg-muted flex items-center justify-end gap-1.5 text-xs">
                    <UsersThreeIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    {clan.member_count}
                  </p>
                  <p className="text-fg-subtle mt-1 text-xs">
                    {CLAN_PRIVACY_SHORT_LABELS[clan.privacy]}
                  </p>
                </div>
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
