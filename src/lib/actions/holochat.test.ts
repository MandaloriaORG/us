import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));

import {
  adminAddChatChannelMember,
  adminCreateChatChannel,
  adminSetChatChannelStatus,
  adminUpdateChatChannel,
  deleteChatMessage,
  getChatMessagesPage,
  getNotificationBellState,
  markAllNotificationsRead,
  markNotificationRead,
  moderationSetChatMessageStatus,
  moderationToggleChatMessagePin,
  reportChatMessage,
  sendChatMessage,
  setNotificationPreferences,
  toggleChatReaction,
  updateChatMessage,
} from "@/lib/actions/holochat";

const channelId = "10000000-0000-4000-8000-000000000001";
const messageId = "20000000-0000-4000-8000-000000000002";
const userId = "30000000-0000-4000-8000-000000000003";
const reportId = "40000000-0000-4000-8000-000000000004";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function rpcReturns(data: unknown) {
  mocks.rpc.mockResolvedValue({ data, error: null });
}

function rpcFails(code: string) {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "database said no" } });
}

describe("message writes", () => {
  it("sends a normalised message and returns the new id", async () => {
    rpcReturns([{ message_id: messageId }]);
    const result = await sendChatMessage({
      channelId,
      slug: "general",
      body: "  Hello  ",
    });
    expect(result).toEqual({ ok: true, messageId });
    expect(mocks.rpc).toHaveBeenCalledWith("send_chat_message", {
      p_channel_id: channelId,
      p_body: "Hello",
      p_parent_id: undefined,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/holochat/general");
  });

  it("refuses an empty message before reaching the database", async () => {
    const result = await sendChatMessage({ channelId, slug: "general", body: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_input");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("passes a reply parent through to the RPC", async () => {
    rpcReturns([{ message_id: messageId }]);
    await sendChatMessage({ channelId, slug: "general", body: "Reply", parentId: messageId });
    expect(mocks.rpc).toHaveBeenCalledWith("send_chat_message", {
      p_channel_id: channelId,
      p_body: "Reply",
      p_parent_id: messageId,
    });
  });

  it("maps a rate limit to rate_limited", async () => {
    rpcFails("53400");
    const result = await sendChatMessage({ channelId, slug: "general", body: "Hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("updates an own message with the previous wording kept by the database", async () => {
    rpcReturns([{ message_id: messageId }]);
    const result = await updateChatMessage({ messageId, slug: "general", body: "Rewritten" });
    expect(result).toEqual({ ok: true, messageId });
    expect(mocks.rpc).toHaveBeenCalledWith("update_own_chat_message", {
      p_message_id: messageId,
      p_body: "Rewritten",
    });
  });

  it("soft-deletes an own message", async () => {
    rpcReturns([{ message_id: messageId }]);
    const result = await deleteChatMessage({ messageId, slug: "general" });
    expect(result).toEqual({ ok: true, messageId });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_own_chat_message", {
      p_message_id: messageId,
    });
  });
});

describe("reactions and reports", () => {
  it("toggles a reaction and returns the server's authoritative state", async () => {
    rpcReturns([{ reaction_key: "well-forged", total: 3, caller_reacted: true }]);
    const result = await toggleChatReaction({
      messageId,
      slug: "general",
      reactionKey: "well-forged",
    });
    expect(result).toEqual({
      ok: true,
      reactionKey: "well-forged",
      total: 3,
      callerReacted: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("toggle_chat_reaction", {
      p_message_id: messageId,
      p_reaction_key: "well-forged",
    });
  });

  it("rejects a malformed reaction key", async () => {
    const result = await toggleChatReaction({
      messageId,
      slug: "general",
      reactionKey: "bad key!",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_input");
  });

  it("files a chat report that reaches the shared queue", async () => {
    rpcReturns([{ report_id: reportId }]);
    const result = await reportChatMessage({ messageId, reason: "harassment", details: "  " });
    expect(result).toEqual({ ok: true, reportId });
    expect(mocks.rpc).toHaveBeenCalledWith("report_chat_message", {
      p_message_id: messageId,
      p_reason: "harassment",
      p_details: null,
    });
  });
});

describe("chat moderation", () => {
  it("hides a message with a compare-and-swap guard and an audit reason", async () => {
    rpcReturns([{ message_id: messageId }]);
    const result = await moderationSetChatMessageStatus({
      messageId,
      expectedStatus: "visible",
      status: "hidden",
      reason: "  Spam  ",
    });
    expect(result).toEqual({ ok: true, messageId });
    expect(mocks.rpc).toHaveBeenCalledWith("moderation_set_chat_message_status", {
      p_message_id: messageId,
      p_expected_status: "visible",
      p_status: "hidden",
      p_reason: "Spam",
    });
  });

  it("maps a stale CAS submission to conflict", async () => {
    rpcFails("40001");
    const result = await moderationSetChatMessageStatus({
      messageId,
      expectedStatus: "visible",
      status: "hidden",
      reason: "Spam",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("pins and unpins through the CAS pin RPC", async () => {
    rpcReturns([{ message_id: messageId }]);
    const result = await moderationToggleChatMessagePin({
      messageId,
      expectedPinned: false,
      isPinned: true,
    });
    expect(result).toEqual({ ok: true, messageId });
    expect(mocks.rpc).toHaveBeenCalledWith("moderation_toggle_chat_message_pin", {
      p_message_id: messageId,
      p_expected_pinned: false,
      p_is_pinned: true,
    });
  });
});

describe("channel administration", () => {
  it("creates a channel and refreshes Holochat paths", async () => {
    rpcReturns([{ channel_id: channelId }]);
    const result = await adminCreateChatChannel({
      slug: "new-channel",
      name: "  New Channel  ",
      kind: "public",
      description: null,
      sortOrder: 90,
    });
    expect(result).toEqual({ ok: true, channelId });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_create_chat_channel", {
      p_slug: "new-channel",
      p_name: "New Channel",
      p_kind: "public",
      p_description: null,
      p_sort_order: 90,
    });
  });

  it("rejects an invalid channel address", async () => {
    const result = await adminCreateChatChannel({
      slug: "Bad Slug!",
      name: "New Channel",
      kind: "public",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_input");
  });

  it("updates a channel's editable fields", async () => {
    rpcReturns([{ channel_id: channelId }]);
    const result = await adminUpdateChatChannel({
      channelId,
      name: "Renamed",
      description: null,
      sortOrder: 10,
    });
    expect(result).toEqual({ ok: true, channelId });
  });

  it("archives a channel with the CAS status RPC", async () => {
    rpcReturns([{ channel_id: channelId }]);
    const result = await adminSetChatChannelStatus({
      channelId,
      expectedStatus: "active",
      status: "archived",
      reason: "Retiring this channel",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.channelId).toBe(channelId);
  });

  it("adds and removes a private-channel member", async () => {
    rpcReturns([{ channel_member_id: messageId }]);
    const added = await adminAddChatChannelMember({ channelId, memberId: userId, remove: false });
    expect(added.ok).toBe(true);

    rpcReturns([{ channel_member_id: null }]);
    const removed = await adminAddChatChannelMember({ channelId, memberId: userId, remove: true });
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.channelMemberId).toBeNull();
  });
});

describe("notifications", () => {
  it("marks a notification read", async () => {
    rpcReturns([{ notification_id: messageId }]);
    const result = await markNotificationRead(messageId);
    expect(result).toEqual({ ok: true, notificationId: messageId });
  });

  it("marks all notifications read and reports the count", async () => {
    rpcReturns([{ updated: 4 }]);
    const result = await markAllNotificationsRead();
    expect(result).toEqual({ ok: true, updated: 4 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/holochat/notifications");
  });

  it("saves the full preference map and rejects unknown types", async () => {
    rpcReturns([{ types: { post_reply: false } }]);
    const ok = await setNotificationPreferences({ types: { post_reply: false } });
    expect(ok.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("set_notification_preferences", {
      p_types: { post_reply: false },
    });

    const bad = await setNotificationPreferences({ types: { made_up: true } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("invalid_input");
  });
});

describe("read surfaces", () => {
  it("returns an empty page for an oversized cursor without calling the database", async () => {
    const page = await getChatMessagesPage({ channelId, cursor: "c".repeat(200) });
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports signed-out as an empty bell state without draining", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: false,
      reason: "not_authenticated",
    });
    await expect(getNotificationBellState(8)).resolves.toEqual({
      signedIn: false,
      unreadCount: 0,
      recent: [],
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("drains the outbox and reports the unread count and recent rows", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId,
      permissionNames: [],
    });
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ processed: 2 }], error: null }) // process_pending_outbox
      .mockResolvedValueOnce({
        data: [
          {
            notification_id: "20000000-0000-4000-8000-000000000010",
            created_at: "2026-08-16T10:00:00.000Z",
          },
          {
            notification_id: "20000000-0000-4000-8000-000000000011",
            created_at: "2026-08-16T10:00:00.000Z",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            notification_id: "20000000-0000-4000-8000-000000000010",
            type: "post_reply",
            actor_id: null,
            actor_display_name: "Ada",
            payload: { post_id: channelId },
            read_at: null,
            created_at: "2026-08-16T10:00:00.000Z",
          },
        ],
        error: null,
      });

    const state = await getNotificationBellState(8);
    expect(state.signedIn).toBe(true);
    expect(state.unreadCount).toBe(2);
    expect(state.recent).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith("process_pending_outbox", { p_limit: 200 });
  });
});
