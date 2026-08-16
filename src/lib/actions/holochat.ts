"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAuthorizationSnapshot } from "@/lib/permissions";
import { REPORT_REASONS } from "@/lib/content/report-reasons";
import {
  CHAT_MESSAGE_DESTINATIONS,
  CHAT_MESSAGE_PAGE_SIZE,
  type ChatMessage,
  type NotificationItem,
} from "@/lib/holochat/types";
import {
  countUnreadNotifications,
  drainOutbox,
  listMessages,
  listOwnNotifications,
} from "@/lib/holochat/queries";

/**
 * Write paths for Holochat and notifications.
 *
 * Authority is never decided here. Every mutation calls an RPC that re-checks
 * the actor, the permission, the target's state, blocks and the rate limit
 * inside the database transaction; this module validates shape, maps database
 * error codes onto stable result codes, and refreshes the affected routes. A
 * client that skips these actions and calls the RPC directly gets exactly the
 * same answer.
 *
 * Moderation and channel administration are compare-and-swap: the caller sends
 * the state it displayed and a stale submission comes back as `conflict` rather
 * than overwriting another moderator.
 */

const uuidSchema = z.string().uuid();

const slugSchema = z
  .string({ invalid_type_error: "Enter a channel address" })
  .transform((value) => value.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(2, "The address must be at least 2 characters")
      .max(48, "The address must be at most 48 characters")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  );

const nameSchema = z
  .string({ invalid_type_error: "Enter a channel name" })
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "The name must be at least 2 characters")
      .max(60, "The name must be at most 60 characters"),
  );

const descriptionSchema = z
  .string()
  .max(600, "The description is too long")
  .nullish()
  .transform((value) => {
    if (!value) return null;
    const clean = value
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim();
    return clean.length === 0 ? null : clean;
  })
  .pipe(z.string().max(500, "The description must be at most 500 characters").nullable());

function chatBodySchema() {
  return z
    .string({ invalid_type_error: "Enter a message" })
    .max(5000, "The message is too long")
    .transform((value) =>
      value
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(1, "The message cannot be empty")
        .max(4000, "The message must be at most 4000 characters"),
    );
}

const reactionKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(32);

const reportReasonSchema = z.enum(REPORT_REASONS, {
  invalid_type_error: "Choose a reason",
  required_error: "Choose a reason",
});

const chatMessageStatusSchema = z.enum(CHAT_MESSAGE_DESTINATIONS);

const chatChannelKindSchema = z.enum(["public", "announcements", "clan", "private"]);

const sendMessageSchema = z.object({
  channelId: uuidSchema,
  slug: slugSchema,
  body: chatBodySchema(),
  parentId: uuidSchema.nullable().default(null),
});

const updateMessageSchema = z.object({
  messageId: uuidSchema,
  slug: slugSchema,
  body: chatBodySchema(),
});

const deleteMessageSchema = z.object({
  messageId: uuidSchema,
  slug: slugSchema,
});

const toggleReactionSchema = z.object({
  messageId: uuidSchema,
  slug: slugSchema,
  reactionKey: reactionKeySchema,
});

const reportMessageSchema = z.object({
  messageId: uuidSchema,
  reason: reportReasonSchema,
  details: z
    .string()
    .max(1500, "Details are too long")
    .nullish()
    .transform((value) => {
      if (!value) return null;
      const clean = value
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim();
      return clean.length === 0 ? null : clean;
    })
    .pipe(z.string().max(1000, "Details must be at most 1000 characters").nullable()),
});

const moderationStatusSchema = z.object({
  messageId: uuidSchema,
  expectedStatus: chatMessageStatusSchema,
  status: chatMessageStatusSchema,
  reason: z
    .string({ invalid_type_error: "Give a reason" })
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(3, "Give a reason of at least 3 characters")
        .max(500, "The reason must be at most 500 characters"),
    ),
});

const togglePinSchema = z.object({
  messageId: uuidSchema,
  expectedPinned: z.boolean(),
  isPinned: z.boolean(),
});

const createChannelSchema = z.object({
  slug: slugSchema,
  name: nameSchema,
  kind: chatChannelKindSchema.default("public"),
  description: descriptionSchema,
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
});

const updateChannelSchema = z.object({
  channelId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  sortOrder: z.number().int().min(-1000).max(1000),
});

const setChannelStatusSchema = z.object({
  channelId: uuidSchema,
  expectedStatus: z.enum(["active", "archived"]),
  status: z.enum(["active", "archived"]),
  reason: z
    .string({ invalid_type_error: "Give a reason" })
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(3, "Give a reason of at least 3 characters")
        .max(500, "The reason must be at most 500 characters"),
    ),
});

const channelMemberSchema = z.object({
  channelId: uuidSchema,
  memberId: uuidSchema,
  remove: z.boolean().default(false),
});

const KNOWN_NOTIFICATION_TYPES = new Set([
  "post_reply",
  "comment_reply",
  "reaction",
  "mention",
  "friend_request",
  "clan_invite",
  "warning",
  "announcement",
]);

const notificationPreferencesSchema = z
  .object({
    types: z.record(z.string(), z.boolean()),
  })
  .refine((value) => Object.keys(value.types).every((key) => KNOWN_NOTIFICATION_TYPES.has(key)), {
    message: "Unknown notification type",
    path: ["types"],
  });

export type HolochatActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code:
        | "access_denied"
        | "conflict"
        | "duplicate"
        | "invalid_input"
        | "invalid_request"
        | "not_found"
        | "rate_limited"
        | "retry";
      message: string;
      /** Field-level messages, present only when validation rejected the input. */
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: HolochatActionResult<never> = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): HolochatActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  return {
    ok: false,
    code: "invalid_input",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function databaseFailure(error: unknown): HolochatActionResult<never> {
  switch (databaseErrorCode(error)) {
    case "42501":
      return {
        ok: false,
        code: "access_denied",
        message: "You do not have permission to do this.",
      };
    case "P0002":
      return {
        ok: false,
        code: "not_found",
        message: "That is no longer available.",
      };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This changed while you were viewing it. Reload and try again.",
      };
    case "23505":
      return {
        ok: false,
        code: "duplicate",
        message: "You already did this. A moderator is looking at it.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "That is not valid for the current state.",
      };
    case "53400":
      return {
        ok: false,
        code: "rate_limited",
        message: "You have done that too many times. Wait a moment and try again.",
      };
    default:
      return RETRY_RESULT;
  }
}

/**
 * The mutation is already committed by the time the cache is refreshed, so a
 * revalidation fault must never be reported as a failed write.
 */
function refresh(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Intentionally ignored; see above.
    }
  }
}

export interface ChatMessageResult {
  messageId: string;
}

export async function sendChatMessage(
  input: unknown,
): Promise<HolochatActionResult<ChatMessageResult>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("send_chat_message", {
      p_channel_id: parsed.data.channelId,
      p_body: parsed.data.body,
      p_parent_id: parsed.data.parentId ?? undefined,
    });

    if (error) return databaseFailure(error);

    const messageId = data?.[0]?.message_id;
    if (!messageId) return RETRY_RESULT;

    refresh([`/holochat/${parsed.data.slug}`]);
    return { ok: true, messageId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function updateChatMessage(
  input: unknown,
): Promise<HolochatActionResult<ChatMessageResult>> {
  const parsed = updateMessageSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_own_chat_message", {
      p_message_id: parsed.data.messageId,
      p_body: parsed.data.body,
    });

    if (error) return databaseFailure(error);

    refresh([`/holochat/${parsed.data.slug}`]);
    return { ok: true, messageId: parsed.data.messageId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function deleteChatMessage(
  input: unknown,
): Promise<HolochatActionResult<ChatMessageResult>> {
  const parsed = deleteMessageSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_own_chat_message", {
      p_message_id: parsed.data.messageId,
    });

    if (error) return databaseFailure(error);

    refresh([`/holochat/${parsed.data.slug}`]);
    return { ok: true, messageId: parsed.data.messageId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export interface ChatReactionResult {
  reactionKey: string;
  total: number;
  callerReacted: boolean;
}

export async function toggleChatReaction(
  input: unknown,
): Promise<HolochatActionResult<ChatReactionResult>> {
  const parsed = toggleReactionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_chat_reaction", {
      p_message_id: parsed.data.messageId,
      p_reaction_key: parsed.data.reactionKey,
    });

    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    refresh([`/holochat/${parsed.data.slug}`]);
    return {
      ok: true,
      reactionKey: row.reaction_key,
      total: row.total,
      callerReacted: row.caller_reacted,
    };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type ChatReportResult = HolochatActionResult<{ reportId: string }>;

export async function reportChatMessage(input: unknown): Promise<ChatReportResult> {
  const parsed = reportMessageSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("report_chat_message", {
      p_message_id: parsed.data.messageId,
      p_reason: parsed.data.reason,
      p_details: parsed.data.details as string,
    });

    if (error) return databaseFailure(error);

    const reportId = data?.[0]?.report_id;
    if (!reportId) return RETRY_RESULT;

    // Nothing the reporter sees changes, so nothing is revalidated.
    return { ok: true, reportId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type ModerationResult = HolochatActionResult<{ messageId: string }>;

export async function moderationSetChatMessageStatus(input: unknown): Promise<ModerationResult> {
  const parsed = moderationStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_set_chat_message_status", {
      p_message_id: parsed.data.messageId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat"]);
    return { ok: true, messageId: parsed.data.messageId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function moderationToggleChatMessagePin(input: unknown): Promise<ModerationResult> {
  const parsed = togglePinSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("moderation_toggle_chat_message_pin", {
      p_message_id: parsed.data.messageId,
      p_expected_pinned: parsed.data.expectedPinned,
      p_is_pinned: parsed.data.isPinned,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat"]);
    return { ok: true, messageId: parsed.data.messageId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type ChannelResult = HolochatActionResult<{ channelId: string }>;

export async function adminCreateChatChannel(input: unknown): Promise<ChannelResult> {
  const parsed = createChannelSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_create_chat_channel", {
      p_slug: parsed.data.slug,
      p_name: parsed.data.name,
      p_kind: parsed.data.kind,
      p_description: parsed.data.description as string,
      p_sort_order: parsed.data.sortOrder,
    });

    if (error) return databaseFailure(error);

    const channelId = data?.[0]?.channel_id;
    if (!channelId) return RETRY_RESULT;

    refresh(["/holochat", "/holochat/manage"]);
    return { ok: true, channelId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function adminUpdateChatChannel(input: unknown): Promise<ChannelResult> {
  const parsed = updateChannelSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_chat_channel", {
      p_channel_id: parsed.data.channelId,
      p_name: parsed.data.name,
      p_description: parsed.data.description as string,
      p_sort_order: parsed.data.sortOrder,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat", "/holochat/manage"]);
    return { ok: true, channelId: parsed.data.channelId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function adminSetChatChannelStatus(input: unknown): Promise<ChannelResult> {
  const parsed = setChannelStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_chat_channel_status", {
      p_channel_id: parsed.data.channelId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat", "/holochat/manage"]);
    return { ok: true, channelId: parsed.data.channelId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type ChannelMemberResult = HolochatActionResult<{ channelMemberId: string | null }>;

export async function adminAddChatChannelMember(input: unknown): Promise<ChannelMemberResult> {
  const parsed = channelMemberSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_add_chat_channel_member", {
      p_channel_id: parsed.data.channelId,
      p_member_id: parsed.data.memberId,
      p_remove: parsed.data.remove,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat/manage"]);
    return { ok: true, channelMemberId: data?.[0]?.channel_member_id ?? null };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type NotificationResult = HolochatActionResult<{ notificationId: string }>;

export async function markNotificationRead(input: unknown): Promise<NotificationResult> {
  const parsed = uuidSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: parsed.data,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat/notifications"]);
    return { ok: true, notificationId: parsed.data };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type MarkAllResult = HolochatActionResult<{ updated: number }>;

export async function markAllNotificationsRead(): Promise<MarkAllResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_all_notifications_read");

    if (error) return databaseFailure(error);

    refresh(["/holochat/notifications"]);
    return { ok: true, updated: data?.[0]?.updated ?? 0 };
  } catch (error) {
    return databaseFailure(error);
  }
}

export type PreferencesResult = HolochatActionResult<{ types: Record<string, boolean> }>;

export async function setNotificationPreferences(input: unknown): Promise<PreferencesResult> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_notification_preferences", {
      p_types: parsed.data.types,
    });

    if (error) return databaseFailure(error);

    refresh(["/holochat/notifications"]);
    return { ok: true, types: parsed.data.types };
  } catch (error) {
    return databaseFailure(error);
  }
}

export interface ChatMessagesPage {
  items: ChatMessage[];
  nextCursor: string | null;
}

const messagesPageSchema = z.object({
  channelId: uuidSchema,
  cursor: z.string().max(128).nullable().default(null),
  pageSize: z.number().int().min(1).max(100).default(CHAT_MESSAGE_PAGE_SIZE),
  pinnedOnly: z.boolean().default(false),
});

/**
 * An extra page of messages for the client thread. Reads go through the same
 * minimized RPC as the Server Component, so visibility is identical; a failed
 * read degrades to an empty page rather than throwing.
 */
export async function getChatMessagesPage(input: unknown): Promise<ChatMessagesPage> {
  const parsed = messagesPageSchema.safeParse(input);
  if (!parsed.success) return { items: [], nextCursor: null };

  const page = await listMessages(parsed.data.channelId, {
    cursor: parsed.data.cursor,
    pageSize: parsed.data.pageSize,
    pinnedOnly: parsed.data.pinnedOnly,
  });

  return { items: page.items, nextCursor: page.nextCursor };
}

export interface NotificationsPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

const notificationsPageSchema = z.object({
  cursor: z.string().max(128).nullable().default(null),
  pageSize: z.number().int().min(1).max(100).default(50),
  unreadOnly: z.boolean().default(false),
});

/** An extra page of notifications for the client notification center. */
export async function getNotificationsPage(input: unknown): Promise<NotificationsPage> {
  const parsed = notificationsPageSchema.safeParse(input);
  if (!parsed.success) return { items: [], nextCursor: null };

  const page = await listOwnNotifications({
    cursor: parsed.data.cursor,
    pageSize: parsed.data.pageSize,
    unreadOnly: parsed.data.unreadOnly,
  });

  return { items: page.items, nextCursor: page.nextCursor };
}

export interface MemberSearchResult {
  id: string;
  display_name: string;
}

const memberSearchSchema = z.object({
  query: z.string().trim().max(60).default(""),
  limit: z.number().int().min(1).max(25).default(10),
});

/**
 * Member lookup for private-channel administration. Uses the narrow member
 * directory RPC so an administrator can add or remove a named member without
 * the channel's member list being readable anywhere.
 */
export async function searchMembers(input: unknown): Promise<MemberSearchResult[]> {
  const parsed = memberSearchSchema.safeParse(input);
  if (!parsed.success) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_member_profiles", {
      p_search: parsed.data.query || undefined,
      p_limit: parsed.data.limit,
      p_offset: 0,
    });

    if (error) return [];
    return (data ?? []).map((row) => ({ id: row.id, display_name: row.display_name }));
  } catch {
    return [];
  }
}

export interface BellState {
  signedIn: boolean;
  unreadCount: number;
  recent: NotificationItem[];
}

/**
 * Read surface for the notification bell. Drains the outbox so newly enqueued
 * events materialize, then reports the unread count and the newest few rows.
 * The bell is a client component, so this is a Server Action rather than a
 * Server Component read.
 */
export async function getNotificationBellState(limit = 8): Promise<BellState> {
  const snapshot = await getAuthorizationSnapshot();
  if (!snapshot.allowed) return { signedIn: false, unreadCount: 0, recent: [] };

  await drainOutbox();
  const [unreadCount, recent] = await Promise.all([
    countUnreadNotifications(100),
    listOwnNotifications({ pageSize: limit }),
  ]);

  return { signedIn: true, unreadCount, recent: recent.items };
}
