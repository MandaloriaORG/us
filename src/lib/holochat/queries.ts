import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor, type ContentCursor } from "@/lib/content/cursor";
import { listReactionTypes } from "@/lib/content/queries";
import { getAuthorizationSnapshot } from "@/lib/permissions";
import {
  type AdminChannel,
  type CallerReactions,
  type ChatChannelDetail,
  type ChatChannelSummary,
  type ChatMessage,
  type ChatMessageEdit,
  type NotificationItem,
  type ReactionCounts,
  CHAT_MESSAGE_PAGE_SIZE,
  NOTIFICATION_PAGE_SIZE,
} from "@/lib/holochat/types";

/**
 * Read paths for Holochat and notifications.
 *
 * Every read goes through a minimized SECURITY DEFINER RPC; the tables carry no
 * grant for `anon` or `authenticated`, so authority lives entirely in the
 * database and this module only shapes results and bounds pagination. A failed
 * read returns an empty page rather than throwing: the route decides whether
 * that is an empty state or an error, and a database fault must never leak its
 * message into a page.
 */

type Functions = Database["public"]["Functions"];

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null };
}

/**
 * A full page implies there may be another one. Requesting `pageSize` and
 * reporting the last row as the cursor avoids the extra count query that an
 * offset scheme would need, at the cost of one possible empty final page.
 */
function toPage<T>(
  rows: T[] | null,
  pageSize: number,
  cursorOf: (row: T) => ContentCursor,
): Page<T> {
  const items = rows ?? [];
  if (items.length < pageSize) return { items, nextCursor: null };

  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor(cursorOf(last)) };
}

function boundedPageSize(requested: number | undefined, fallback: number, max: number) {
  if (!Number.isInteger(requested) || requested === undefined) return fallback;
  return Math.min(Math.max(requested, 1), max);
}

function parseReactionCounts(value: unknown): ReactionCounts {
  if (typeof value !== "object" || value === null) return {};
  return value as ReactionCounts;
}

function parseCallerReactions(value: unknown): CallerReactions {
  if (typeof value !== "object" || value === null) return {};
  return value as CallerReactions;
}

export function shapeChatMessage(
  row: Functions["list_chat_messages"]["Returns"][number],
): ChatMessage {
  return {
    ...row,
    reaction_counts: parseReactionCounts(row.reaction_counts),
    caller_reacted: parseCallerReactions(row.caller_reacted),
  };
}

export async function listChannels(): Promise<ChatChannelSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_chat_channels");
  if (error) return [];
  return data ?? [];
}

/**
 * The Council's channel list, including archived channels, for the
 * archived-channel reactivation surface. Readable only by a `chat.manage`
 * holder; a failed read degrades to an empty list exactly like the public one.
 */
export async function adminListChannels(): Promise<AdminChannel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_chat_channels");
  if (error) return [];
  return data ?? [];
}

export async function getChannel(slug: string): Promise<ChatChannelDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_chat_channel", { p_slug: slug });
  if (error) return null;
  return data?.[0] ?? null;
}

export interface ListMessagesOptions {
  cursor?: string | null;
  pageSize?: number;
  pinnedOnly?: boolean;
}

export async function listMessages(
  channelId: string,
  options: ListMessagesOptions = {},
): Promise<Page<ChatMessage>> {
  const pageSize = boundedPageSize(options.pageSize, CHAT_MESSAGE_PAGE_SIZE, 100);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_chat_messages", {
    p_channel_id: channelId,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
    p_pinned_only: options.pinnedOnly ?? false,
  });

  if (error) return emptyPage();

  const items = (data ?? []).map(shapeChatMessage);
  return toPage(items, pageSize, (row) => ({ createdAt: row.created_at, id: row.id }));
}

export interface CurrentMember {
  id: string;
  displayName: string;
}

/**
 * The active member's own identity, for the composer to stamp locally-created
 * message rows. Reads the narrow member RPC so no direct profile grant is
 * needed; a failed profile read degrades to a fallback name rather than
 * blocking the channel.
 */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const snapshot = await getAuthorizationSnapshot();
  if (!snapshot.allowed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_member_profile", {
    p_user_id: snapshot.userId,
  });

  if (error || !data?.[0]) return { id: snapshot.userId, displayName: "Member" };
  return { id: snapshot.userId, displayName: data[0].display_name };
}

export async function listMessageEdits(messageId: string, limit = 20): Promise<ChatMessageEdit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_chat_message_edits", {
    p_message_id: messageId,
    p_limit: limit,
  });
  if (error) return [];
  return data ?? [];
}

/**
 * Drains the transactional outbox before the caller reads notifications, so a
 * reply, reaction or invitation that was enqueued alongside its action has
 * materialized. Idempotent: a consumed event is a no-op.
 */
export async function drainOutbox(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("process_pending_outbox", { p_limit: 200 });
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  cursor?: string | null;
  pageSize?: number;
}

export async function listOwnNotifications(
  options: ListNotificationsOptions = {},
): Promise<Page<NotificationItem>> {
  const pageSize = boundedPageSize(options.pageSize, NOTIFICATION_PAGE_SIZE, 100);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_notifications", {
    p_unread_only: options.unreadOnly ?? false,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();

  return toPage(data, pageSize, (row) => ({ createdAt: row.created_at, id: row.notification_id }));
}

/**
 * The unread count for the bell badge. Capped at `limit`; the RPC offers no
 * count, so a full page reports the cap rather than guessing at a number.
 */
export async function countUnreadNotifications(limit = 100): Promise<number> {
  const page = await listOwnNotifications({ unreadOnly: true, pageSize: limit });
  return page.items.length;
}

export async function getNotificationPreferences(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_notification_preferences");
  if (error) return {};
  const types = data?.[0]?.types;
  if (typeof types !== "object" || types === null) return {};
  return types as Record<string, boolean>;
}

export { listReactionTypes };
