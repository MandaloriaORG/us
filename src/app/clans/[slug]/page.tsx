import {
  ArrowLeftIcon,
  CrownIcon,
  UsersThreeIcon,
  ShieldIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CLAN_MEMBER_ROLE_LABELS, CLAN_PRIVACY_LABELS } from "@/lib/clans/labels";
import { loadClanDetail, loadClanInvitation, loadInternalRoles } from "@/lib/clans/loaders";
import { getAuthorizationSnapshot } from "@/lib/permissions";

import { ClanEntryActions } from "../_components/clan-entry-actions";
import { ReasonActionForm } from "../_components/reason-action-form";
import { leaveClan } from "@/lib/actions/clans";

interface Props {
  params: { slug: string };
}

export default async function ClanDetailPage({ params }: Props) {
  const [detail, authorization] = await Promise.all([
    loadClanDetail(params.slug),
    getAuthorizationSnapshot(),
  ]);

  if (detail.status === "not_found") notFound();

  if (detail.status === "error") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div role="alert">
          <EmptyState
            icon={<ShieldIcon className="h-8 w-8" />}
            title="Clan temporarily unavailable"
            description="We could not load this clan. Try again."
            action={{ label: "Try again", href: `/clans/${params.slug}` }}
            secondaryAction={{ label: "All clans", href: "/clans" }}
          />
        </div>
      </main>
    );
  }

  const { clan, members } = detail;
  const authenticated = authorization.allowed;

  const [invitation, rolesLoad] = await Promise.all([
    authenticated ? loadClanInvitation(clan.id) : Promise.resolve(null),
    clan.can_manage ? loadInternalRoles(clan.id) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/clans"
        className="text-fg-muted duration-fast group hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        All clans
      </Link>

      {/* Hero card */}
      <section className="border-border bg-bg-raised relative mt-6 overflow-hidden rounded-xl border">
        <div
          aria-hidden="true"
          className="from-brand/25 via-brand-muted/10 absolute inset-x-0 top-0 h-28 bg-gradient-to-br to-transparent"
        />
        <div
          aria-hidden="true"
          className="via-brand/50 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent"
        />
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-8">
          {clan.emblemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clan.emblemUrl}
              alt={`${clan.name} emblem`}
              className="border-brand/30 bg-bg ring-brand/40 ring-offset-bg h-20 w-20 shrink-0 rounded-lg border object-cover shadow-[0_0_24px_-6px_hsl(42_40%_55%/0.45)] ring-1 ring-offset-2"
            />
          ) : (
            <div
              aria-hidden="true"
              className="border-brand/30 bg-brand-muted/15 text-brand ring-brand/40 ring-offset-bg flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border shadow-[0_0_24px_-6px_hsl(42_40%_55%/0.45)] ring-1 ring-offset-2"
            >
              <span className="font-display text-3xl font-semibold">
                {clan.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-fg from-brand bg-gradient-to-r to-amber-400 bg-clip-text text-3xl font-semibold tracking-tight wrap-break-word text-transparent">
              {clan.name}
            </h1>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="border-brand/40 bg-brand-muted/10 text-brand inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-[0_0_12px_-2px_hsl(42_40%_55%/0.35)]">
                {CLAN_PRIVACY_LABELS[clan.privacy]}
              </span>
              {clan.status === "archived" ? (
                <span className="border-border text-fg-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs">
                  Archived
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="border-border relative border-t px-6 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs">
            <div className="text-fg-muted flex items-center gap-1.5">
              <UsersThreeIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>
                {clan.member_count} {clan.member_count === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="text-fg-muted flex items-center gap-1.5">
              <CrownIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Led by {clan.leader_display_name}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Entry / membership actions */}
      {clan.status === "active" ? (
        <div className="border-border mt-8 border-t pt-6">
          {clan.caller_is_member ? (
            clan.can_manage ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href={`/clans/${clan.slug}/manage`}>Manage clan</Link>
                </Button>
              </div>
            ) : (
              <ReasonActionForm
                action={leaveClan}
                hidden={{ clanId: clan.id, slug: clan.slug }}
                buttonLabel="Leave clan"
                reasonRequired={false}
                reasonLabel="Reason (optional)"
                variant="secondary"
                description="The leaders can invite you back."
                successMessage="You left the clan."
              />
            )
          ) : authenticated ? (
            <ClanEntryActions
              clanId={clan.id}
              slug={clan.slug}
              privacy={clan.privacy}
              invitation={invitation}
            />
          ) : null}
        </div>
      ) : null}

      {/* Mission */}
      {clan.mission ? (
        <section className="border-border mt-8 border-t pt-8" aria-labelledby="mission-heading">
          <h2
            id="mission-heading"
            className="text-fg flex items-center gap-2 text-sm font-semibold"
          >
            <span aria-hidden="true" className="bg-brand h-3.5 w-0.5 rounded-full" />
            Mission
          </h2>
          <p className="text-fg-muted mt-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {clan.mission}
          </p>
        </section>
      ) : null}

      {/* Description */}
      {clan.description ? (
        <section className="border-border mt-8 border-t pt-8" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-fg flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="bg-brand h-3.5 w-0.5 rounded-full" />
            About
          </h2>
          <p className="text-fg-muted mt-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {clan.description}
          </p>
        </section>
      ) : null}

      {/* Members */}
      <section className="border-border mt-8 border-t pt-8" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-fg flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="bg-brand h-3.5 w-0.5 rounded-full" />
          Members
        </h2>
        {members.length > 0 ? (
          <div className="mt-4 space-y-2">
            {members.map((member) => (
              <Link
                key={member.member_id}
                href={`/members/${member.member_id}`}
                className="duration-normal group border-border bg-bg-raised hover:border-brand/30 focus-visible:ring-border-focus flex items-center gap-3 rounded-lg border px-4 py-3 transition-[border-color,box-shadow,transform] ease-out hover:-translate-y-px hover:shadow-[0_6px_16px_-8px_hsl(42_40%_55%/0.25)] focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <Avatar
                  name={member.display_name}
                  className="ring-border duration-normal group-hover:ring-brand/40 border-transparent ring-1 transition-shadow"
                />
                <span className="text-fg min-w-0 flex-1 truncate text-sm font-medium">
                  {member.display_name}
                </span>
                <span className="text-fg-subtle shrink-0 text-xs">
                  {CLAN_MEMBER_ROLE_LABELS[member.role]}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-fg-subtle mt-3 text-sm">No active members.</p>
        )}
      </section>

      {/* Internal roles — only for the leader/admin who can see them */}
      {rolesLoad && rolesLoad.status === "ok" && rolesLoad.roles.length > 0 ? (
        <section className="border-border mt-8 border-t pt-8" aria-labelledby="roles-heading">
          <h2 id="roles-heading" className="text-fg flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="bg-brand h-3.5 w-0.5 rounded-full" />
            Internal roles
          </h2>
          <ul className="mt-4 space-y-2">
            {rolesLoad.roles.map((role) => (
              <li
                key={role.internal_role_id}
                className="border-border bg-bg-raised flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-fg text-sm font-medium">{role.name}</p>
                  <p className="text-fg-muted mt-0.5 text-xs">{role.member_count} assigned</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
