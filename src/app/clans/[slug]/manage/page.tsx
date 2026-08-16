import { ArrowLeftIcon, ShieldIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setClanStatus } from "@/lib/actions/clans";
import { CLAN_MEMBER_ROLE_LABELS } from "@/lib/clans/labels";
import { loadClanDetail, loadInternalRoles } from "@/lib/clans/loaders";
import { loadMemberPicker } from "@/lib/clans/member-picker";
import { getAuthorizationSnapshot } from "@/lib/permissions";

import { ClanEditForm } from "../../_components/clan-edit-form";
import { EmblemForm } from "../../_components/emblem-form";
import { InternalRoles } from "../../_components/internal-roles";
import { InviteForm } from "../../_components/invite-form";
import { MemberManageForm } from "../../_components/member-manage-form";
import { MemberSearch } from "../../_components/member-search";
import { ReasonActionForm } from "../../_components/reason-action-form";

interface Props {
  params: { slug: string };
  searchParams?: {
    q?: string | string[];
    target?: string | string[];
    name?: string | string[];
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClanManagePage({ params, searchParams }: Props) {
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
            action={{ label: "Try again", href: `/clans/${params.slug}/manage` }}
          />
        </div>
      </main>
    );
  }

  const { clan, members } = detail;
  if (!clan.can_manage) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div role="alert">
          <EmptyState
            icon={<SlidersHorizontalIcon className="h-8 w-8" />}
            title="Management restricted"
            description="Only the clan leader and administrators can manage this clan."
            action={{ label: "View clan", href: `/clans/${clan.slug}` }}
            secondaryAction={{ label: "All clans", href: "/clans" }}
          />
        </div>
      </main>
    );
  }

  const isAdmin =
    authorization.allowed && authorization.permissionNames.includes("admin.manage_clans");

  const rolesLoad = await loadInternalRoles(clan.id);
  const roles = rolesLoad.status === "ok" ? rolesLoad.roles : [];
  const rolesDenied = rolesLoad.status === "denied";

  const search = (firstValue(searchParams?.q) ?? "").trim().slice(0, 50);
  const memberProfiles = await loadMemberPicker(search);
  const targetId = firstValue(searchParams?.target) ?? "";
  const targetName = firstValue(searchParams?.name) ?? "";
  const manageableMembers = members.filter((member) => member.member_id !== clan.leader_id);
  const selectedTarget =
    targetId && targetName ? { member_id: targetId, display_name: targetName } : null;
  const pickHref = (memberId: string, memberName: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("target", memberId);
    params.set("name", memberName);
    return `/clans/${clan.slug}/manage?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/clans/${clan.slug}`}
        className="text-fg-muted duration-fast hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg mb-8 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        {clan.name}
      </Link>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-semibold">Manage clan</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Membership, roles, emblem and identity for {clan.name}.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/clans/${clan.slug}`}>View clan</Link>
        </Button>
      </div>

      {/* Emblem */}
      <section className="border-border mt-8 border-t pt-6" aria-labelledby="emblem-heading">
        <h2 id="emblem-heading" className="text-fg text-sm font-semibold">
          Emblem
        </h2>
        <EmblemForm
          clanId={clan.id}
          slug={clan.slug}
          currentEmblemUrl={clan.emblemUrl}
          currentPath={clan.emblem_path}
        />
      </section>

      {/* Identity — admin only */}
      {isAdmin ? (
        <section className="border-border mt-8 border-t pt-6" aria-labelledby="identity-heading">
          <h2 id="identity-heading" className="text-fg text-sm font-semibold">
            Identity &amp; privacy
          </h2>
          <ClanEditForm
            clanId={clan.id}
            slug={clan.slug}
            initialName={clan.name}
            initialDescription={clan.description}
            initialPrivacy={clan.privacy}
            initialMission={clan.mission}
          />

          <div className="border-border mt-6 border-t pt-5">
            <h3 className="text-fg text-sm font-semibold">
              {clan.status === "active" ? "Archive clan" : "Restore clan"}
            </h3>
            <div className="mt-2">
              <ReasonActionForm
                action={setClanStatus}
                hidden={{
                  clanId: clan.id,
                  slug: clan.slug,
                  expectedStatus: clan.status,
                  status: clan.status === "active" ? "archived" : "active",
                }}
                buttonLabel={clan.status === "active" ? "Archive clan" : "Restore clan"}
                description={
                  clan.status === "active"
                    ? "Archiving hides the clan from the directory. It can be restored later."
                    : "Restoring returns the clan to the directory."
                }
                variant={clan.status === "active" ? "destructive" : "secondary"}
                successMessage={clan.status === "active" ? "Clan archived." : "Clan restored."}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Members */}
      <section className="border-border mt-8 border-t pt-6" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-fg text-sm font-semibold">
          Members
        </h2>
        {members.length > 0 ? (
          <div className="border-border divide-border mt-3 divide-y rounded-md border">
            {members.map((member) => (
              <div key={member.member_id} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                <Link
                  href={`/members/${member.member_id}`}
                  className="text-fg truncate text-sm hover:underline"
                >
                  {member.display_name}
                </Link>
                <span className="text-fg-subtle ml-auto text-xs">
                  {CLAN_MEMBER_ROLE_LABELS[member.role]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-fg-subtle mt-3 text-sm">No active members.</p>
        )}

        <div className="border-border mt-6 border-t pt-5">
          <h3 className="text-fg text-sm font-semibold">
            Change role, transfer leadership, or expel
          </h3>
          <MemberManageForm
            clanId={clan.id}
            slug={clan.slug}
            members={manageableMembers.map((member) => ({
              memberId: member.member_id,
              displayName: member.display_name,
              role: member.role,
            }))}
          />
        </div>
      </section>

      {/* Internal roles */}
      {!rolesDenied ? (
        <section className="border-border mt-8 border-t pt-6" aria-labelledby="roles-heading">
          <h2 id="roles-heading" className="text-fg text-sm font-semibold">
            Internal roles
          </h2>
          <InternalRoles
            clanId={clan.id}
            slug={clan.slug}
            roles={roles.map((role) => ({
              internalRoleId: role.internal_role_id,
              name: role.name,
              description: role.description,
              permissions: role.permissions,
              memberCount: role.member_count,
            }))}
            members={manageableMembers.map((member) => ({
              memberId: member.member_id,
              displayName: member.display_name,
            }))}
          />
        </section>
      ) : null}

      {/* Invite */}
      <section className="border-border mt-8 border-t pt-6" aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-fg text-sm font-semibold">
          Invite a member
        </h2>
        {selectedTarget ? (
          <>
            <InviteForm
              clanId={clan.id}
              slug={clan.slug}
              memberId={selectedTarget.member_id}
              memberName={selectedTarget.display_name}
            />
            <div className="mt-4">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/clans/${clan.slug}/manage`}>Change member</Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <MemberSearch
              search={search}
              targetId={undefined}
              pickHref={pickHref}
              profiles={memberProfiles}
            />
          </div>
        )}
      </section>
    </main>
  );
}
