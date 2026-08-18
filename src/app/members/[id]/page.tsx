import { notFound } from "next/navigation";
import {
  CalendarBlankIcon,
  GlobeIcon,
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { safeExternalUrl } from "@/app/members/safe-external-url";
import { ReportControl } from "@/components/system/report-control";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getProfileById } from "@/lib/actions/profile";
import { APPEAL_STATUS_LABELS, appealActionLabel } from "@/lib/content/appeal-labels";
import { listOwnAppeals, listOwnModerationActions } from "@/lib/content/appeals";
import { listOwnWarnings } from "@/lib/content/user-moderation";
import { listFriendsOf, loadProfileIdentity, loadSocialState } from "@/lib/clans/identity";
import { getAuthorizationSnapshot } from "@/lib/permissions";
import { listPostsByAuthor, countAuthorPosts } from "@/lib/content/queries";

import { IdentityBadges } from "./identity-badges";
import { MemberSocial } from "./member-social";
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

  const [identity, social, friends, postsPage, postsTotal] = await Promise.all([
    loadProfileIdentity(params.id, isSelf),
    isSelf || !authorization.allowed
      ? Promise.resolve(null)
      : loadSocialState(authorization.userId, params.id),
    listFriendsOf(params.id),
    listPostsByAuthor(params.id, { pageSize: 5 }),
    countAuthorPosts(params.id),
  ]);

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
        className="text-fg-muted duration-fast group hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
        All members
      </Link>

      {/* Profile header */}
      <section className="border-border bg-bg-raised relative mt-6 overflow-hidden rounded-lg border">
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-8">
          <Avatar
            name={profile.display_name}
            src={profile.avatarUrl}
            alt={`${profile.display_name}'s avatar`}
            className="ring-brand/40 ring-offset-bg h-20 w-20 border-transparent ring-2 ring-offset-2"
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-fg text-2xl font-semibold tracking-tight wrap-break-word">
              {profile.display_name}
            </h1>

            {/* Rank — progression, grants no permissions */}
            {identity.status === "ok" && identity.rank ? (
              <div className="mt-2.5">
                <span
                  className="border-brand/40 bg-brand-muted/10 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={identity.rank.color ? { color: identity.rank.color } : undefined}
                >
                  {identity.rank.name}
                </span>
              </div>
            ) : null}

            {/* Staff badge */}
            {staffRoles.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
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
              <div className="mt-2.5 flex flex-wrap gap-1.5">
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
          </div>
        </div>

        {/* Stats row */}
        <div className="border-border relative border-t px-6 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {joinedLabel && (
              <div className="text-fg-muted flex items-center gap-1.5 text-xs">
                <CalendarBlankIcon aria-hidden="true" className="h-3.5 w-3.5" />
                <span>
                  Joined <time dateTime={profile.created_at}>{joinedLabel}</time>
                </span>
              </div>
            )}
            <div className="text-fg-muted flex items-center gap-1.5 text-xs">
              <ChatCircleDotsIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>
                {postsTotal} {postsTotal === 1 ? "post" : "posts"}
              </span>
            </div>
            <div className="text-fg-muted flex items-center gap-1.5 text-xs">
              <UsersIcon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>
                {friends.length} {friends.length === 1 ? "friend" : "friends"}
              </span>
            </div>
            {identity.status === "ok" && identity.badges.length > 0 ? (
              <div className="text-fg-muted flex items-center gap-1.5 text-xs">
                <span
                  className="text-brand h-1.5 w-1.5 rounded-full bg-current"
                  aria-hidden="true"
                />
                {identity.badges.length} {identity.badges.length === 1 ? "badge" : "badges"}
              </div>
            ) : null}
          </div>
        </div>
      </section>

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
            className="text-brand focus-visible:ring-border-focus focus-visible:ring-offset-bg group inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            <GlobeIcon aria-hidden="true" className="h-4 w-4" />
            <span className="break-all">{website.label}</span>
          </a>
        </div>
      )}

      {/* Badges — identity display with issuer, date, reason and status */}
      {identity.status === "ok" && identity.badges.length > 0 ? (
        <IdentityBadges badges={identity.badges} />
      ) : null}

      {/* Friend and block controls — never on the viewer's own profile */}
      {!isSelf && social ? (
        <div className="border-border mt-8 border-t pt-4">
          <MemberSocial targetUserId={params.id} social={social} />
        </div>
      ) : null}

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

      {/* Recent posts */}
      <section className="border-border mt-8 border-t pt-6" aria-labelledby="member-posts">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="member-posts" className="text-fg text-base font-semibold">
            Recent posts
          </h2>
          {postsTotal > postsPage.items.length ? (
            <Link
              href={`/plazas`}
              className="text-brand focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex min-h-11 items-center text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              See all {postsTotal} posts →
            </Link>
          ) : null}
        </div>

        {postsPage.items.length === 0 ? (
          <p className="text-fg-muted text-sm">No public posts yet.</p>
        ) : (
          <ul className="space-y-3">
            {postsPage.items.map((post) => (
              <li
                key={post.id}
                className="border-border bg-surface/40 hover:bg-surface/70 rounded-lg border px-4 py-3 transition-colors"
              >
                <Link
                  href={`/posts/${post.id}`}
                  className="text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg hover:text-brand block rounded font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                >
                  {post.title}
                </Link>
                <div className="text-fg-muted mt-1 flex items-center gap-3 text-xs">
                  <span>in {post.plaza_name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.comments_count} comments</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.likes_count - post.dislikes_count} score</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Friends */}
      {friends.length > 0 ? (
        <section className="border-border mt-8 border-t pt-6" aria-labelledby="member-friends">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="member-friends" className="text-fg text-base font-semibold">
              Friends
            </h2>
            <Link
              href={`/clans/connections`}
              className="text-fg-muted hover:text-fg inline-flex min-h-11 items-center text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden"
            >
              View connections →
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {friends.slice(0, 8).map((friend) => (
              <li key={friend.friendId}>
                <Link
                  href={`/members/${friend.friendId}`}
                  className="border-border bg-surface/40 hover:bg-surface/70 focus-visible:ring-border-focus focus-visible:ring-offset-bg flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                >
                  <Avatar
                    name={friend.displayName}
                    src={friend.avatarUrl}
                    className="h-8 w-8 shrink-0"
                  />
                  <span className="text-fg truncate text-xs font-medium">{friend.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
