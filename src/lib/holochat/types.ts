/**
 * Shared Holochat and notification types.
 *
 * These are the shapes of the read RPCs from migration 0017, with the
 * nullability the migration's `RETURNS TABLE` functions deliberately produce
 * restored at the one boundary where it is known. Supabase type generation
 * types every output column as non-null; deleted messages have their author and
 * body blanked, replies have a null parent, and a notification's actor is null
 * once that profile is gone.
 */

import type { Database } from "@/lib/database.types";

type Functions = Database["public"]["Functions"];

type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type ChatChannelSummary = Nullable<
  Functions["list_chat_channels"]["Returns"][number],
  "description" | "clan_id"
>;

export type ChatChannelDetail = Nullable<
  Functions["get_chat_channel"]["Returns"][number],
  "description" | "clan_id"
>;

/**
 * The Council's channel-administration row: every channel, active or archived,
 * with its status. Only a `chat.manage` holder can read it, so it is never the
 * public summary type.
 */
export type AdminChannel = Nullable<
  Functions["admin_list_chat_channels"]["Returns"][number],
  "description" | "clan_id"
>;

/**
 * A failed outbox event, for the Council's system-health surface. Readable only
 * by an `admin.manage_settings` holder; the payload is ids and metadata, never
 * a private body.
 */
export type FailedOutboxEvent = Nullable<
  Functions["outbox_list_failed"]["Returns"][number],
  "aggregate_type" | "aggregate_id" | "last_error"
>;

/**
 * The read RPC returns reaction data as `jsonb`; the queries module casts it to
 * keyed maps, so the row type declares the cast shape.
 */
export type ChatMessage = Omit<
  Nullable<
    Functions["list_chat_messages"]["Returns"][number],
    "author_id" | "author_display_name" | "body" | "parent_id" | "edited_at"
  >,
  "reaction_counts" | "caller_reacted"
> & {
  reaction_counts: ReactionCounts;
  caller_reacted: CallerReactions;
};

export type ChatMessageEdit = Nullable<
  Functions["list_chat_message_edits"]["Returns"][number],
  "editor_display_name"
>;

export type NotificationItem = Nullable<
  Functions["list_own_notifications"]["Returns"][number],
  "actor_id" | "actor_display_name" | "read_at"
>;

export type ChatMessageStatus = Database["public"]["Enums"]["chat_message_status"];

export type ReactionCounts = Record<string, number>;
export type CallerReactions = Record<string, true>;

export const CHAT_MESSAGE_PAGE_SIZE = 50;
export const NOTIFICATION_PAGE_SIZE = 50;
export const PINNED_PAGE_SIZE = 25;
export const CHAT_EDIT_PAGE_SIZE = 20;

/** Destination statuses a moderator may move a chat message to. */
export const CHAT_MESSAGE_DESTINATIONS = ["visible", "hidden", "deleted"] as const;
export type ChatMessageDestination = (typeof CHAT_MESSAGE_DESTINATIONS)[number];

export const CHAT_MESSAGE_STATUS_LABELS: Record<ChatMessageDestination, string> = {
  visible: "Visible",
  hidden: "Hidden",
  deleted: "Deleted",
};

export const CHAT_CHANNEL_KIND_LABELS: Record<ChatChannelSummary["kind"], string> = {
  public: "Public",
  announcements: "Announcements",
  clan: "Clan",
  private: "Private",
};
