import {
  ArrowLeftIcon,
  HouseLineIcon,
  UsersThreeIcon,
  ShieldIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

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
        className="text-fg-muted duration-fast hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg mb-8 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        All clans
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5">
        {clan.emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clan.emblemUrl}
            alt={`${clan.name} emblem`}
            className="border-border bg-bg-raised h-20 w-20 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div className="border-border bg-bg-raised text-brand-muted flex h-20 w-20 shrink-0 items-center justify-center rounded-md border">
            <HouseLineIcon aria-hidden="true" className="h-8 w-8" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-fg text-3xl font-semibold wrap-break-word">
            {clan.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="border-brand/40 bg-brand-muted/10 text-brand inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
              {CLAN_PRIVACY_LABELS[clan.privacy]}
            </span>
            {clan.status === "archived" ? (
              <span className="border-border text-fg-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs">
                Archived
              </span>
            ) : null}
          </div>
          <p className="text-fg-muted mt-2 flex items-center gap-1.5 text-xs">
            <UsersThreeIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {clan.member_count} {clan.member_count === 1 ? "member" : "members"} · led by{" "}
            {clan.leader_display_name}
          </p>
        </div>
      </div>

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
          <h2 id="mission-heading" className="text-fg text-sm font-semibold">
            Mission
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {clan.mission}
          </p>
        </section>
      ) : null}

      {/* Description */}
      {clan.description ? (
        <section className="border-border mt-8 border-t pt-8" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-fg text-sm font-semibold">
            About
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {clan.description}
          </p>
        </section>
      ) : null}

      {/* Members */}
      <section className="border-border mt-8 border-t pt-8" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-fg text-sm font-semibold">
          Members
        </h2>
        {members.length > 0 ? (
          <div className="border-border divide-border mt-3 divide-y rounded-md border">
            {members.map((member) => (
              <Link
                key={member.member_id}
                href={`/members/${member.member_id}`}
                className="duration-fast hover:bg-surface focus-visible:ring-border-focus flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
              >
                <span className="text-fg flex-1 truncate text-sm">{member.display_name}</span>
                <span className="text-fg-subtle text-xs">
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
          <h2 id="roles-heading" className="text-fg text-sm font-semibold">
            Internal roles
          </h2>
          <ul className="mt-3 space-y-2">
            {rolesLoad.roles.map((role) => (
              <li key={role.internal_role_id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-fg text-sm">{role.name}</p>
                  <p className="text-fg-muted text-xs">{role.member_count} assigned</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
