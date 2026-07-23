import { notFound } from "next/navigation";
import { CalendarBlankIcon, GlobeIcon, ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { safeExternalUrl } from "@/app/members/safe-external-url";
import { ReportControl } from "@/components/system/report-control";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getProfileById } from "@/lib/actions/profile";
import { APPEAL_STATUS_LABELS, appealActionLabel } from "@/lib/content/appeal-labels";
import { listOwnAppeals, listOwnModerationActions } from "@/lib/content/appeals";
import { listOwnWarnings } from "@/lib/content/user-moderation";
import { getAuthorizationSnapshot } from "@/lib/permissions";

import { OwnAppeals } from "./own-appeals";
import { OwnWarnings } from "./own-warnings";

interface Props {
  params: { id: string };
}

export default async function MemberProfilePage({ params }: Props) {
  const [result, authorization] = await Promise.all([
    getProfileById(params.id),
    getAuthorizationSnapshot(),
  ]);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div role="alert">
          <EmptyState
            title="Profile temporarily unavailable"
            description="We could not load this member profile. Try again."
            action={{ label: "Try again", href: `/members/${params.id}` }}
            secondaryAction={{ label: "All members", href: "/members" }}
          />
        </div>
      </main>
    );
  }

  const { profile } = result;
  // `list_own_warnings` resolves the member from the session, so this is only
  // ever the reader's own history — never the profile they happen to be viewing.
  const isSelf = authorization.allowed && authorization.userId === params.id;
  const [ownWarnings, ownActions, ownAppeals] = isSelf
    ? await Promise.all([listOwnWarnings(), listOwnModerationActions(), listOwnAppeals()])
    : [[], [], []];

  // The action list carries the appeal's id and status; its wording lives on the
  // appeal itself, so the decision is read from there rather than duplicated.
  const decisionsByAppeal = new Map(
    ownAppeals.map((appeal) => [appeal.appeal_id, appeal.decision]),
  );
  const website = safeExternalUrl(profile.website);
  const joinedAt = new Date(profile.created_at);
  const joinedLabel = Number.isNaN(joinedAt.valueOf())
    ? null
    : joinedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

  const isStaffRole = (role: string) =>
    ["moderator", "guardian", "administrator"].includes(role.toLocaleLowerCase());

  const staffRoles = (profile.roles ?? []).filter(isStaffRole);
  const otherRoles = (profile.roles ?? []).filter((r) => !isStaffRole(r));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {/* Back */}
      <Link
        href="/members"
        className="text-fg-muted duration-fast hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg mb-8 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        All members
      </Link>

      {/* Profile header */}
      <div className="flex items-start gap-6">
        <Avatar
          name={profile.display_name}
          src={profile.avatarUrl}
          alt={`${profile.display_name}'s avatar`}
          className="h-20 w-20"
        />

        <div className="min-w-0">
          <h1 className="text-fg text-2xl font-semibold wrap-break-word">{profile.display_name}</h1>

          {/* Staff badge */}
          {staffRoles.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {staffRoles.map((role) => (
                <span
                  key={role}
                  className="border-brand/40 bg-brand-muted/10 text-brand inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                >
                  {role}
                </span>
              ))}
            </div>
          )}

          {/* Other roles */}
          {otherRoles.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {otherRoles.map((role) => (
                <span
                  key={role}
                  className="border-border text-fg-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs"
                >
                  {role}
                </span>
              ))}
            </div>
          )}

          {/* Join date */}
          {joinedLabel && (
            <div className="text-fg-muted mt-3 flex items-center gap-1.5 text-xs">
              <CalendarBlankIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>
                Joined <time dateTime={profile.created_at}>{joinedLabel}</time>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="border-border mt-8 border-t pt-8">
          <p className="text-fg-muted text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {profile.bio}
          </p>
        </div>
      )}

      {/* Website */}
      {website && (
        <div className="mt-4">
          <a
            href={website.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            <GlobeIcon aria-hidden="true" className="h-4 w-4" />
            <span className="break-all">{website.label}</span>
          </a>
        </div>
      )}

      {isSelf ? (
        <OwnAppeals
          actions={ownActions.map((action) => ({
            auditLogId: action.audit_log_id,
            action: action.action,
            actionLabel: appealActionLabel(action.action),
            reason: action.reason,
            createdAt: action.created_at,
            appealId: action.appeal_id,
            appealStatus: action.appeal_status,
            appealStatusLabel: action.appeal_status
              ? APPEAL_STATUS_LABELS[action.appeal_status]
              : null,
            appealDecision: action.appeal_id
              ? (decisionsByAppeal.get(action.appeal_id) ?? null)
              : null,
          }))}
        />
      ) : null}

      {isSelf ? (
        <OwnWarnings
          warnings={ownWarnings.map((warning) => ({
            warningId: warning.warning_id,
            reason: warning.reason,
            createdAt: warning.created_at,
            acknowledgedAt: warning.acknowledged_at,
          }))}
        />
      ) : null}

      {/* Report — never offered on the viewer's own profile */}
      {isSelf ? null : (
        <div className="border-border mt-8 border-t pt-4">
          <ReportControl targetType="profile" targetId={params.id} />
        </div>
      )}
    </main>
  );
}
