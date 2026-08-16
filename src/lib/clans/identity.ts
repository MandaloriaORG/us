import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type {
  BadgeInfo,
  BlockEntry,
  FriendEntry,
  FriendRequestEntry,
  RankInfo,
  SocialState,
} from "@/lib/clans/types";

type ProfileRankRow = Database["public"]["Functions"]["get_profile_rank"]["Returns"][number];
type FriendRequestRow =
  Database["public"]["Functions"]["list_own_friend_requests"]["Returns"][number];
type FriendRow = Database["public"]["Functions"]["list_friends"]["Returns"][number];
type BlockRow = Database["public"]["Functions"]["list_own_blocks"]["Returns"][number];

export type { BadgeInfo, BlockEntry, FriendEntry, FriendRequestEntry, RankInfo, SocialState };

export type ProfileIdentity =
  { status: "ok"; rank: RankInfo | null; badges: BadgeInfo[] } | { status: "error" };

/** Load a member's public identity: their global rank and their badge record.
 * `includePrivate` reveals private evidence refs to the holder (and to
 * `admin.view_users` — the RPC re-checks both). */
export async function loadProfileIdentity(
  userId: string,
  includePrivate = false,
): Promise<ProfileIdentity> {
  try {
    const supabase = await createClient();
    const [rankResult, badgesResult] = await Promise.all([
      supabase.rpc("get_profile_rank", { p_user_id: userId }).maybeSingle<ProfileRankRow>(),
      supabase.rpc("list_profile_badges", {
        p_user_id: userId,
        p_include_private: includePrivate,
      }),
    ]);

    const rank: RankInfo | null = rankResult.data
      ? {
          slug: rankResult.data.slug,
          name: rankResult.data.name,
          color: rankResult.data.color,
          assignedAt: rankResult.data.assigned_at,
        }
      : null;

    const badges: BadgeInfo[] = (badgesResult.data ?? []).map((row) => ({
      id: row.badge_id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      issuerName: row.issuer_display_name,
      reason: row.reason,
      evidenceRef: row.evidence_ref,
      evidenceVisibility: row.evidence_visibility,
      status: row.status,
      awardedAt: row.awarded_at,
      revokedReason: row.revoked_reason,
      revokedAt: row.revoked_at,
    }));

    return { status: "ok", rank, badges };
  } catch {
    return { status: "error" };
  }
}

export type ConnectionsState =
  | {
      status: "ok";
      requests: FriendRequestEntry[];
      friends: FriendEntry[];
      blocks: BlockEntry[];
    }
  | { status: "error" };

/** The viewer's own friends, pending requests and blocks — the connections
 * center data. */
export async function loadConnections(): Promise<ConnectionsState> {
  try {
    const supabase = await createClient();
    const [requests, friends, blocks] = await Promise.all([
      supabase.rpc("list_own_friend_requests"),
      supabase.rpc("list_friends"),
      supabase.rpc("list_own_blocks"),
    ]);

    return {
      status: "ok",
      requests: (requests.data ?? []).map((row: FriendRequestRow) => ({
        friendshipId: row.friendship_id,
        peerId: row.peer_id,
        peerName: row.peer_display_name,
        direction: row.direction === "incoming" ? ("incoming" as const) : ("outgoing" as const),
        createdAt: row.created_at,
      })),
      friends: (friends.data ?? []).map((row: FriendRow) => ({
        friendId: row.friend_id,
        displayName: row.display_name,
        avatarPath: row.avatar_path,
        friendsSince: row.friends_since,
      })),
      blocks: (blocks.data ?? []).map((row: BlockRow) => ({
        blockedId: row.blocked_id,
        displayName: row.display_name,
        blockedAt: row.blocked_at,
      })),
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * The viewer's social state toward one member, derived from the viewer's own
 * request, friend and block lists. A person blocked by the target cannot be
 * distinguished through the read contract; the RPCs still refuse their
 * requests, and the action layer maps that to a "blocked" result.
 */
export async function loadSocialState(
  viewerUserId: string | null,
  targetUserId: string,
): Promise<SocialState> {
  if (!viewerUserId || viewerUserId === targetUserId) return { relationship: "none" };

  try {
    const supabase = await createClient();
    const [requests, friends, blocks] = await Promise.all([
      supabase.rpc("list_own_friend_requests"),
      supabase.rpc("list_friends"),
      supabase.rpc("list_own_blocks"),
    ]);

    const block = (blocks.data ?? []).find((row: BlockRow) => row.blocked_id === targetUserId);
    if (block) return { relationship: "blocked_by_me" };

    const request = (requests.data ?? []).find(
      (row: FriendRequestRow) => row.peer_id === targetUserId,
    );
    if (request) {
      return request.direction === "incoming"
        ? {
            relationship: "incoming_request",
            friendshipId: request.friendship_id,
            createdAt: request.created_at,
          }
        : {
            relationship: "outgoing_request",
            friendshipId: request.friendship_id,
            createdAt: request.created_at,
          };
    }

    const friend = (friends.data ?? []).find((row: FriendRow) => row.friend_id === targetUserId);
    if (friend) return { relationship: "friends", friendsSince: friend.friends_since };

    return { relationship: "none" };
  } catch {
    return { relationship: "none" };
  }
}
