/**
 * The notification vocabulary, shared by the bell, the notification center and
 * the preferences form. Deliberately not `server-only`: the client components
 * that render lists and preference toggles need the labels and route builders.
 *
 * The keys must match the `notification_type` enum in migration 0017 exactly.
 * Adding a type means a migration first, then this list.
 */

export const NOTIFICATION_TYPES = [
  "post_reply",
  "comment_reply",
  "reaction",
  "mention",
  "friend_request",
  "clan_invite",
  "warning",
  "announcement",
  "report_resolved",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Sentence-case labels for the preferences form and list rows. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  post_reply: "Replies to your posts",
  comment_reply: "Replies to your comments",
  reaction: "Reactions to your content",
  mention: "Mentions",
  friend_request: "Friend requests",
  clan_invite: "Clan and house invitations",
  warning: "Warnings and notices",
  announcement: "Important announcements",
  report_resolved: "Report outcomes",
};

/** Short list-row label when the full sentence is too long for a row. */
export const NOTIFICATION_TYPE_SHORT_LABELS: Record<NotificationType, string> = {
  post_reply: "Post reply",
  comment_reply: "Comment reply",
  reaction: "Reaction",
  mention: "Mention",
  friend_request: "Friend request",
  clan_invite: "Clan invitation",
  warning: "Warning",
  announcement: "Announcement",
  report_resolved: "Report resolved",
};

/**
 * Where a notification's payload points. Each builder reads only ids from the
 * payload and returns a link the recipient can actually open; a notification
 * never carries a body, and a link is only offered when the payload names the
 * target the recipient needs.
 */
export function notificationHref(type: NotificationType, payload: Record<string, unknown>): string {
  switch (type) {
    case "post_reply":
    case "comment_reply":
      return typeof payload.post_id === "string" ? `/posts/${payload.post_id}` : "/posts";
    case "reaction":
      return typeof payload.post_id === "string"
        ? `/posts/${payload.post_id}`
        : typeof payload.comment_id === "string"
          ? `/posts/${payload.comment_id}`
          : "/posts";
    case "friend_request":
      return "/members";
    case "clan_invite":
      return typeof payload.clan_slug === "string"
        ? `/clans/${payload.clan_slug}`
        : typeof payload.clan_id === "string"
          ? "/clans"
          : "/clans";
    case "warning":
    case "announcement":
    case "mention":
    case "report_resolved":
      return "/holochat";
    default:
      return "/holochat";
  }
}

/**
 * The human-readable summary of a notification row. Actor names come from the
 * RPC's `actor_display_name`, which is null once that profile is gone; the
 * summary degrades to an impersonal form rather than naming nobody.
 */
export function notificationSummary(
  type: NotificationType,
  actorName: string | null,
  payload: Record<string, unknown>,
): string {
  const actor = actorName ?? "Someone";
  switch (type) {
    case "post_reply":
      return `${actor} replied to your post`;
    case "comment_reply":
      return `${actor} replied to your comment`;
    case "reaction":
      return payload.comment_id
        ? `${actor} reacted to your comment`
        : `${actor} reacted to your post`;
    case "mention":
      return `${actor} mentioned you`;
    case "friend_request":
      return `${actor} sent you a friend request`;
    case "clan_invite":
      return `${actor} invited you to a clan`;
    case "warning":
      return "You received a warning";
    case "announcement":
      return "The Council posted an announcement";
    case "report_resolved":
      return "Your report was resolved";
    default:
      return "New notification";
  }
}

/** A preferences map with every type defaulted to enabled. */
export function defaultNotificationPreferences(): Record<NotificationType, boolean> {
  return Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, true])) as Record<
    NotificationType,
    boolean
  >;
}
