import { can, getAuthorizationSnapshot } from "@/lib/permissions";

export function getCodexEditorAccess() {
  return can("codex.edit");
}

export function getCodexPublisherAccess() {
  return can("codex.publish");
}

/**
 * The Codex work surface inside the Council. `codex.edit` opens it; the
 * publish actions additionally need `codex.publish`. The RPCs re-check both on
 * every mutation, so these flags only decide what the UI offers.
 */
export async function getCodexCouncilAccess() {
  const snapshot = await getAuthorizationSnapshot();
  if (!snapshot.allowed) return snapshot;

  const permissionNames = new Set(snapshot.permissionNames);
  return {
    allowed: true,
    canEdit: permissionNames.has("codex.edit"),
    canPublish: permissionNames.has("codex.publish"),
    userId: snapshot.userId,
  } as const;
}
