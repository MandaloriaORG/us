import { notFound } from "next/navigation";
import { Calendar, Globe, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { safeExternalUrl } from "@/app/members/safe-external-url";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getProfileById } from "@/lib/actions/profile";

interface Props {
  params: { id: string };
}

export default async function MemberProfilePage({ params }: Props) {
  const result = await getProfileById(params.id);

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
        className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
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
          <h1 className="break-words text-2xl font-semibold text-fg">{profile.display_name}</h1>

          {/* Staff badge */}
          {staffRoles.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {staffRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-full border border-brand/40 bg-brand-muted/10 px-2.5 py-0.5 text-xs font-medium text-brand"
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
                  className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs text-fg-muted"
                >
                  {role}
                </span>
              ))}
            </div>
          )}

          {/* Join date */}
          {joinedLabel && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-fg-muted">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
              <span>
                Joined <time dateTime={profile.created_at}>{joinedLabel}</time>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
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
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Globe aria-hidden="true" className="h-4 w-4" />
            <span className="break-all">{website.label}</span>
          </a>
        </div>
      )}
    </main>
  );
}
