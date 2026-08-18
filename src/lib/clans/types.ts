/** Pure client-safe types for the clan identity surface. No server imports
 * live here so both Server Components and "use client" components can import
 * the shapes without pulling `server-only` modules into the client bundle. */

export interface RankInfo {
  slug: string;
  name: string;
  color: string | null;
  assignedAt: string;
}

export interface BadgeInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  issuerName: string;
  reason: string;
  /** Null when the evidence is private and the viewer is not entitled to it. */
  evidenceRef: string | null;
  evidenceVisibility: "public" | "private";
  status: "awarded" | "revoked";
  awardedAt: string;
  revokedReason: string | null;
  revokedAt: string | null;
}

export type SocialState =
  | { relationship: "none" }
  | { relationship: "blocked_by_me" }
  | { relationship: "incoming_request"; friendshipId: string; createdAt: string }
  | { relationship: "outgoing_request"; friendshipId: string; createdAt: string }
  | { relationship: "friends"; friendsSince: string };

export interface FriendRequestEntry {
  friendshipId: string;
  peerId: string;
  peerName: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
}

export interface FriendEntry {
  friendId: string;
  displayName: string;
  avatarPath: string | null;
  /** Short-lived signed URL for the friend's avatar, resolved by the loader. */
  avatarUrl: string | null;
  friendsSince: string;
}

export interface BlockEntry {
  blockedId: string;
  displayName: string;
  blockedAt: string;
}
