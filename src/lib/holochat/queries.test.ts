import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));

import {
  countUnreadNotifications,
  drainOutbox,
  getChannel,
  getCurrentMember,
  getNotificationPreferences,
  listChannels,
  listMessageEdits,
  listMessages,
  listOwnNotifications,
} from "@/lib/holochat/queries";

const channelId = "10000000-0000-4000-8000-000000000001";
const otherId = "20000000-0000-4000-8000-000000000002";

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: otherId,
    parent_id: null,
    author_id: "30000000-0000-4000-8000-000000000003",
    author_display_name: "Ada",
    body: "Hello",
    status: "visible" as const,
    is_pinned: false,
    replies_count: 0,
    edited_at: null,
    reaction_counts: { thumbs_up: 2 },
    caller_reacted: { thumbs_up: true },
    created_at: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("channel reads", () => {
  it("returns an empty list when the RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listChannels()).resolves.toEqual([]);
  });

  it("returns the channel rows on success", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: channelId, slug: "general" }], error: null });
    const channels = await listChannels();
    expect(channels).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith("list_chat_channels");
  });

  it("returns null for an invisible channel", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    await expect(getChannel("missing")).resolves.toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("get_chat_channel", { p_slug: "missing" });
  });
});

describe("message reads", () => {
  it("shapes reaction jsonb into keyed maps", async () => {
    mocks.rpc.mockResolvedValue({ data: [message()], error: null });
    const page = await listMessages(channelId, {});
    expect(page.items[0].reaction_counts).toEqual({ thumbs_up: 2 });
    expect(page.items[0].caller_reacted).toEqual({ thumbs_up: true });
  });

  it("decodes a URL cursor into the RPC cursor arguments", async () => {
    mocks.rpc.mockResolvedValue({ data: [message()], error: null });
    await listMessages(channelId, {
      cursor: "2026-08-16T10:00:00.000Z~20000000-0000-4000-8000-000000000002",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("list_chat_messages", {
      p_channel_id: channelId,
      p_cursor_created_at: "2026-08-16T10:00:00.000Z",
      p_cursor_id: "20000000-0000-4000-8000-000000000002",
      p_limit: 50,
      p_pinned_only: false,
    });
  });

  it("reports a cursor only when the page is full", async () => {
    const rows = Array.from({ length: 50 }, (_, index) =>
      message({ id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}` }),
    );
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
    const page = await listMessages(channelId, { pageSize: 50 });
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toContain("~");
  });

  it("degrades a failed page to an empty page", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const page = await listMessages(channelId, {});
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

describe("edit history", () => {
  it("returns rows and passes the bounded limit", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ edit_id: otherId, old_body: "before", created_at: "2026-08-16T10:00:00.000Z" }],
      error: null,
    });
    const edits = await listMessageEdits(otherId, 10);
    expect(edits).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith("list_chat_message_edits", {
      p_message_id: otherId,
      p_limit: 10,
    });
  });
});

describe("notification reads", () => {
  it("drains the outbox through process_pending_outbox", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ processed: 0 }], error: null });
    await drainOutbox();
    expect(mocks.rpc).toHaveBeenCalledWith("process_pending_outbox", { p_limit: 200 });
  });

  it("lists notifications and paginates on notification_id", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          notification_id: otherId,
          type: "post_reply",
          actor_id: null,
          actor_display_name: null,
          payload: { post_id: channelId },
          read_at: null,
          created_at: "2026-08-16T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const page = await listOwnNotifications({ unreadOnly: true, pageSize: 5 });
    expect(page.items).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith("list_own_notifications", {
      p_unread_only: true,
      p_cursor_created_at: undefined,
      p_cursor_id: undefined,
      p_limit: 5,
    });
  });

  it("counts unread notifications as the fetched page length", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      notification_id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      created_at: "2026-08-16T10:00:00.000Z",
    }));
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
    await expect(countUnreadNotifications(100)).resolves.toBe(3);
  });

  it("returns an empty preference map when none are stored", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await expect(getNotificationPreferences()).resolves.toEqual({});
  });
});

describe("getCurrentMember", () => {
  it("returns null when the caller is not allowed", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: false,
      reason: "not_authenticated",
    });
    await expect(getCurrentMember()).resolves.toBeNull();
  });

  it("resolves the member's display name from the narrow RPC", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: channelId,
      permissionNames: [],
    });
    mocks.rpc.mockResolvedValue({
      data: [{ display_name: "Ada Lovelace" }],
      error: null,
    });
    await expect(getCurrentMember()).resolves.toEqual({
      id: channelId,
      displayName: "Ada Lovelace",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_member_profile", { p_user_id: channelId });
  });

  it("falls back to a neutral name when the profile read fails", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: channelId,
      permissionNames: [],
    });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getCurrentMember()).resolves.toEqual({ id: channelId, displayName: "Member" });
  });
});
