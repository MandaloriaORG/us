import { ArrowLeft, Calendar, Globe } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCouncilUserAccess } from "@/app/council/access";
import { StatusBadge, type StatusBadgeTone } from "@/components/origin/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentAuthorization } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { UserManagementPanel, type CouncilRoleOption } from "./user-management-panel";

interface CouncilUserDetailPageProps {
  params: { id: string };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ProfileStatus = "active" | "banned" | "suspended" | "unknown";

interface CouncilRole {
  description: string | null;
  id: string;
  is_protected: boolean;
  name: string;
}

interface CouncilUserDetail {
  bio: string | null;
  createdAt: string | null;
  displayName: string;
  id: string;
  roles: CouncilRole[];
  status: ProfileStatus;
  website: string | null;
}

const statusTones = {
  active: "success",
  suspended: "warning",
  banned: "danger",
} satisfies Record<string, StatusBadgeTone>;

function statusTone(status: ProfileStatus): StatusBadgeTone {
  if (status === "active" || status === "suspended" || status === "banned") {
    return statusTones[status];
  }
  return "neutral";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRoles(value: unknown): CouncilRole[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((role) => {
    if (
      !isRecord(role) ||
      typeof role.id !== "string" ||
      typeof role.name !== "string" ||
      !(role.description === null || typeof role.description === "string") ||
      typeof role.is_protected !== "boolean"
    ) {
      return [];
    }

    return [
      {
        description: role.description,
        id: role.id,
        is_protected: role.is_protected,
        name: role.name,
      },
    ];
  });
}

function normalizeStatus(value: unknown): ProfileStatus {
  return value === "active" || value === "suspended" || value === "banned" ? value : "unknown";
}

function normalizeProfile(value: unknown, requestedId: string): CouncilUserDetail | null {
  if (!isRecord(value) || value.id !== requestedId) return null;

  return {
    bio: typeof value.bio === "string" ? value.bio : null,
    createdAt:
      typeof value.created_at === "string" && !Number.isNaN(Date.parse(value.created_at))
        ? value.created_at
        : null,
    displayName:
      typeof value.display_name === "string" && value.display_name.trim()
        ? value.display_name
        : "Unnamed member",
    id: requestedId,
    roles: parseRoles(value.roles),
    status: normalizeStatus(value.status),
    website: typeof value.website === "string" ? value.website : null,
  };
}

function safeWebsite(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export default async function CouncilUserDetailPage({ params }: CouncilUserDetailPageProps) {
  const access = await getCouncilUserAccess();
  if (!access.allowed) {
    if (access.reason === "verification_failed") {
      throw new Error("Council authorization could not be verified");
    }
    return null;
  }

  if (!uuidPattern.test(params.id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("council_get_user", { p_user_id: params.id })
    .maybeSingle();

  if (error) {
    throw new Error("Council user profile could not be loaded");
  }
  if (!data) notFound();

  const profile = normalizeProfile(data, params.id);
  if (!profile) notFound();

  const authorization = await getCurrentAuthorization();
  const permissionNames = new Set(authorization?.permissionNames ?? []);
  const isSelf = authorization?.userId === profile.id;
  const canManageRoles = !isSelf && permissionNames.has("admin.manage_roles");
  let assignableRoles: CouncilRoleOption[] = [];

  if (canManageRoles) {
    const { data: roleRows, error: rolesError } = await supabase
      .from("roles")
      .select("id, name, description, is_protected")
      .order("name", { ascending: true });

    if (rolesError) {
      throw new Error("Council roles could not be loaded");
    }

    assignableRoles = parseRoles(roleRows).map((role) => ({
      description: role.description,
      id: role.id,
      isProtected: role.is_protected,
      name: role.name,
    }));
  }

  const assignedRoles: CouncilRoleOption[] = profile.roles.map((role) => ({
    description: role.description,
    id: role.id,
    isProtected: role.is_protected,
    name: role.name,
  }));
  const website = safeWebsite(profile.website);
  const hasKnownStatus = profile.status !== "unknown";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/council/users"
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-border-focus"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All users
      </Link>

      <div className="flex items-start gap-4 sm:gap-6">
        <Avatar alt="" className="h-16 w-16 sm:h-20 sm:w-20" name={profile.displayName} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="break-words text-2xl font-semibold text-fg">{profile.displayName}</h1>
            <StatusBadge className="capitalize" tone={statusTone(profile.status)}>
              {profile.status}
            </StatusBadge>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
            <Calendar aria-hidden="true" className="h-4 w-4" />
            <span>
              Joined{" "}
              {profile.createdAt ? (
                <time dateTime={profile.createdAt}>
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              ) : (
                "Unknown"
              )}
            </span>
          </div>

          {website && (
            <a
              href={website.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 max-w-full items-center gap-1.5 break-all text-xs text-brand underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <Globe aria-hidden="true" className="h-4 w-4 shrink-0" />
              {website.hostname}
            </a>
          )}
        </div>
      </div>

      {profile.bio && (
        <section className="mt-8 border-t border-border pt-6" aria-label="Biography">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
            {profile.bio}
          </p>
        </section>
      )}

      {!canManageRoles || !hasKnownStatus ? (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-fg">Roles</h2>
          {profile.roles.length > 0 ? (
            <div className="mt-3 divide-y divide-border border-y border-border">
              {profile.roles.map((role) => (
                <div key={role.id} className="px-1 py-3 sm:px-3">
                  <span className="text-sm font-medium text-fg">{role.name}</span>
                  {role.description && (
                    <p className="mt-1 text-xs text-fg-muted">{role.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-fg-muted">This member has no assigned roles.</p>
          )}
        </section>
      ) : null}

      {isSelf && profile.status !== "unknown" ? (
        <section
          className="mt-8 border-t border-border pt-6"
          aria-labelledby="self-management-title"
        >
          <h2 id="self-management-title" className="text-lg font-semibold text-fg">
            Manage user
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            You cannot change your own account status or role assignments.
          </p>
        </section>
      ) : profile.status !== "unknown" ? (
        <UserManagementPanel
          targetUserId={profile.id}
          currentStatus={profile.status}
          assignedRoles={assignedRoles}
          assignableRoles={assignableRoles}
          canSuspend={permissionNames.has("moderation.suspend")}
          canBan={permissionNames.has("moderation.ban")}
          canManageRoles={canManageRoles}
          canManageProtectedRoles={permissionNames.has("admin.manage_protected_roles")}
        />
      ) : null}
    </div>
  );
}
