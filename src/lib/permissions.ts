import { createClient } from "@/lib/supabase/server";

export type PermissionDenialReason =
  | "not_authenticated"
  | "profile_not_found"
  | "account_suspended"
  | "account_banned"
  | "verification_failed"
  | "missing_permission";

/**
 * Represents the permission check result.
 */
export type PermissionCheck =
  { allowed: true; reason?: never } | { allowed: false; reason: PermissionDenialReason };

type AuthorizationContext =
  | {
      ok: true;
      permissionNames: ReadonlySet<string>;
      userId: string;
    }
  | {
      ok: false;
      reason: Exclude<PermissionDenialReason, "missing_permission">;
    };

const verificationFailed: AuthorizationContext = {
  ok: false,
  reason: "verification_failed",
};

export type AuthorizationSnapshot =
  | {
      allowed: true;
      permissionNames: string[];
      userId: string;
      reason?: never;
    }
  | {
      allowed: false;
      permissionNames?: never;
      userId?: never;
      reason: Exclude<PermissionDenialReason, "missing_permission">;
    };

async function loadAuthorizationContext(): Promise<AuthorizationContext> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) return verificationFailed;
    if (!authData.user) {
      return { ok: false, reason: "not_authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) return verificationFailed;
    if (!profile) {
      return { ok: false, reason: "profile_not_found" };
    }
    if (profile.status === "suspended") {
      return { ok: false, reason: "account_suspended" };
    }
    if (profile.status === "banned") {
      return { ok: false, reason: "account_banned" };
    }

    // The role/permission graph is intentionally not readable through the Data
    // API. This SECURITY DEFINER RPC exposes only the active caller's names.
    const { data: permissions, error: permissionsError } = await supabase.rpc(
      "current_user_permissions",
    );

    if (permissionsError) return verificationFailed;

    const permissionNames: ReadonlySet<string> = new Set(
      (permissions ?? []).map(({ permission_name }) => permission_name),
    );

    return { ok: true, permissionNames, userId: authData.user.id };
  } catch {
    console.error("Permission verification failed");
    return verificationFailed;
  }
}

/**
 * Resolve the active actor and the complete narrow permission-name projection
 * in one request-bound authorization load.
 */
export async function getAuthorizationSnapshot(): Promise<AuthorizationSnapshot> {
  const context = await loadAuthorizationContext();

  if (!context.ok) {
    return { allowed: false, reason: context.reason };
  }

  return {
    allowed: true,
    permissionNames: Array.from(context.permissionNames).sort(),
    userId: context.userId,
  };
}

/**
 * Check if the current user has a specific permission.
 */
export async function can(permission: string): Promise<PermissionCheck> {
  const context = await loadAuthorizationContext();

  if (!context.ok) {
    return { allowed: false, reason: context.reason };
  }

  return context.permissionNames.has(permission)
    ? { allowed: true }
    : { allowed: false, reason: "missing_permission" };
}

/**
 * Check if the current user has any of the given permissions.
 */
export async function canAny(permissions: string[]): Promise<PermissionCheck> {
  if (permissions.length === 0) {
    return { allowed: false, reason: "missing_permission" };
  }

  const context = await loadAuthorizationContext();

  if (!context.ok) {
    return { allowed: false, reason: context.reason };
  }

  return permissions.some((permission) => context.permissionNames.has(permission))
    ? { allowed: true }
    : { allowed: false, reason: "missing_permission" };
}

/**
 * Get all permissions for the current user.
 */
export async function getUserPermissions(): Promise<string[]> {
  const context = await loadAuthorizationContext();

  if (!context.ok) return [];

  return Array.from(context.permissionNames).sort();
}

export interface CurrentAuthorization {
  permissionNames: string[];
  userId: string;
}

/**
 * Return the active actor and their narrow permission-name projection.
 * Consumers must still rely on database authorization for every mutation.
 */
export async function getCurrentAuthorization(): Promise<CurrentAuthorization | null> {
  const snapshot = await getAuthorizationSnapshot();

  if (!snapshot.allowed) return null;

  return {
    permissionNames: snapshot.permissionNames,
    userId: snapshot.userId,
  };
}

/**
 * Check if the current user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  const { allowed } = await can("admin.manage_roles");
  return allowed;
}

/**
 * Check if the current user has staff access (Moderator, Guardian, or Admin).
 */
export async function isStaff(): Promise<boolean> {
  const { allowed } = await canAny(["moderation.hide", "admin.manage_roles"]);
  return allowed;
}
