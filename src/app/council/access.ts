import { can, getAuthorizationSnapshot } from "@/lib/permissions";

const COUNCIL_USER_PERMISSION = "admin.view_users";
const COUNCIL_AUDIT_PERMISSION = "admin.view_audit_logs";
// The report queue is moderation work, not administration, so it is gated on
// the same permission the queue RPCs re-check rather than on an admin one.
const COUNCIL_REPORT_PERMISSION = "moderation.hide";

export function getCouncilUserAccess() {
  return can(COUNCIL_USER_PERMISSION);
}

export function getCouncilAuditAccess() {
  return can(COUNCIL_AUDIT_PERMISSION);
}

export function getCouncilReportAccess() {
  return can(COUNCIL_REPORT_PERMISSION);
}

/**
 * The four moderation permissions split by destination state
 * (`private.require_moderation_permission` in migration 0010): hiding,
 * quarantining, deleting and restoring a post or comment are each their own
 * grant, so a plain Moderator (hide/restore only) sees fewer target actions
 * than a Guardian on the same report.
 */
export async function getReportTargetModerationAccess() {
  const authorization = await getAuthorizationSnapshot();
  if (!authorization.allowed) {
    return { canHide: false, canQuarantine: false, canDelete: false, canRestore: false };
  }

  const permissionNames = new Set(authorization.permissionNames);
  return {
    canHide: permissionNames.has("moderation.hide"),
    canQuarantine: permissionNames.has("moderation.quarantine"),
    canDelete: permissionNames.has("moderation.delete"),
    canRestore: permissionNames.has("moderation.restore"),
  };
}

export async function getCouncilShellAccess() {
  const authorization = await getAuthorizationSnapshot();

  if (!authorization.allowed) {
    return authorization;
  }

  const permissionNames = new Set(authorization.permissionNames);
  const canViewUsers = permissionNames.has(COUNCIL_USER_PERMISSION);
  const canViewAudit = permissionNames.has(COUNCIL_AUDIT_PERMISSION);
  const canViewReports = permissionNames.has(COUNCIL_REPORT_PERMISSION);

  // A moderator who can only work the queue still belongs in the Council shell;
  // the shell opens when any destination inside it is reachable.
  if (!canViewUsers && !canViewAudit && !canViewReports) {
    return { allowed: false, reason: "missing_permission" } as const;
  }

  return {
    allowed: true,
    canViewAudit,
    canViewReports,
    canViewUsers,
    userId: authorization.userId,
  } as const;
}
