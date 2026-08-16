import type { Database } from "@/lib/database.types";

type ClanPrivacy = Database["public"]["Enums"]["clan_privacy"];
type ClanStatus = Database["public"]["Enums"]["clan_status"];
type ClanMemberRole = Database["public"]["Enums"]["clan_member_role"];
type ClanMemberStatus = Database["public"]["Enums"]["clan_member_status"];
type RankStatus = Database["public"]["Enums"]["rank_status"];
type BadgeStatus = Database["public"]["Enums"]["badge_status"];
type UserBadgeStatus = Database["public"]["Enums"]["user_badge_status"];
type EvidenceVisibility = Database["public"]["Enums"]["evidence_visibility"];

/** Human-readable labels for clan privacy. Private data never leaks; these are
 * the same sentence-case terms used everywhere in the product. */
export const CLAN_PRIVACY_LABELS: Record<ClanPrivacy, string> = {
  open: "Open — anyone can join",
  invite: "Invite — members request entry, leaders decide",
  closed: "Closed — leaders invite",
};

/** Short labels for list rows and badges. */
export const CLAN_PRIVACY_SHORT_LABELS: Record<ClanPrivacy, string> = {
  open: "Open",
  invite: "Invite only",
  closed: "Closed",
};

export const CLAN_STATUS_LABELS: Record<ClanStatus, string> = {
  active: "Active",
  archived: "Archived",
};

export const CLAN_MEMBER_ROLE_LABELS: Record<ClanMemberRole, string> = {
  leader: "Leader",
  officer: "Officer",
  member: "Member",
};

export const CLAN_MEMBER_STATUS_LABELS: Record<ClanMemberStatus, string> = {
  pending: "Pending",
  active: "Active",
  invited: "Invited",
  rejected: "Rejected",
  left: "Left",
  expelled: "Expelled",
};

export const RANK_STATUS_LABELS: Record<RankStatus, string> = {
  active: "Active",
  retired: "Retired",
};

export const BADGE_STATUS_LABELS: Record<BadgeStatus, string> = {
  active: "Active",
  retired: "Retired",
};

export const USER_BADGE_STATUS_LABELS: Record<UserBadgeStatus, string> = {
  awarded: "Awarded",
  revoked: "Revoked",
};

export const EVIDENCE_VISIBILITY_LABELS: Record<EvidenceVisibility, string> = {
  public: "Public",
  private: "Private",
};

/** The internal permission names a clan role may carry. These are capability
 * names the database RPCs check; the UI only ever renders the stored set. */
export const KNOWN_CLAN_INTERNAL_PERMISSIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "clan.announce", label: "Post clan announcements" },
  { value: "clan.manage_expeditions", label: "Manage expeditions" },
  { value: "clan.moderate_chat", label: "Moderate clan chat" },
];
