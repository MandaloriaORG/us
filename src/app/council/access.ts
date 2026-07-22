import { can, getAuthorizationSnapshot } from "@/lib/permissions";

const COUNCIL_USER_PERMISSION = "admin.view_users";
const COUNCIL_AUDIT_PERMISSION = "admin.view_audit_logs";

export function getCouncilUserAccess() {
  return can(COUNCIL_USER_PERMISSION);
}

export function getCouncilAuditAccess() {
  return can(COUNCIL_AUDIT_PERMISSION);
}

export async function getCouncilShellAccess() {
  const authorization = await getAuthorizationSnapshot();

  if (!authorization.allowed) {
    return authorization;
  }

  const permissionNames = new Set(authorization.permissionNames);
  const canViewUsers = permissionNames.has(COUNCIL_USER_PERMISSION);
  const canViewAudit = permissionNames.has(COUNCIL_AUDIT_PERMISSION);

  if (!canViewUsers && !canViewAudit) {
    return { allowed: false, reason: "missing_permission" } as const;
  }

  return {
    allowed: true,
    canViewAudit,
    canViewUsers,
    userId: authorization.userId,
  } as const;
}
