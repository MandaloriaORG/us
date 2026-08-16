import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChannel: vi.fn(),
  listChannels: vi.fn(),
  listMessages: vi.fn(),
  listReactionTypes: vi.fn(),
  getCurrentMember: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/holochat/queries", () => ({
  getChannel: mocks.getChannel,
  listChannels: mocks.listChannels,
  listMessages: mocks.listMessages,
  listReactionTypes: mocks.listReactionTypes,
  getCurrentMember: mocks.getCurrentMember,
}));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/system/notification-bell", () => ({
  NotificationBell: () => null,
}));

import ChannelPage from "./page";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const channelId = "10000000-0000-4000-8000-000000000001";

const channel = {
  id: channelId,
  slug: "general",
  name: "General",
  description: "Everyday conversation.",
  kind: "public" as const,
  status: "active" as const,
  clan_id: null,
  can_send: true,
  can_announce: false,
};

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "20000000-0000-4000-8000-000000000002",
    parent_id: null,
    author_id: "30000000-0000-4000-8000-000000000003",
    author_display_name: "Ada",
    body: "Hello everyone",
    status: "visible" as const,
    is_pinned: false,
    replies_count: 0,
    edited_at: null,
    reaction_counts: {},
    caller_reacted: {},
    created_at: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.getChannel.mockResolvedValue(channel);
  mocks.listChannels.mockResolvedValue([channel]);
  mocks.listMessages.mockResolvedValue({ items: [message()], nextCursor: null });
  mocks.listReactionTypes.mockResolvedValue([]);
  mocks.getCurrentMember.mockResolvedValue({
    id: "30000000-0000-4000-8000-000000000003",
    displayName: "Ada",
  });
  mocks.getAuthorizationSnapshot.mockResolvedValue({
    allowed: true,
    userId: "30000000-0000-4000-8000-000000000003",
    permissionNames: [],
  });
});

async function renderPage(slug = "general") {
  const element = await ChannelPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("ChannelPage", () => {
  it("404s when the channel is invisible to the caller", async () => {
    mocks.getChannel.mockResolvedValue(null);
    await expect(ChannelPage({ params: Promise.resolve({ slug: "secret" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("shows the channel name, description and the sidebar rail", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Everyday conversation.")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Channels" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the loaded messages with their authors", async () => {
    await renderPage();
    expect(screen.getByText("Hello everyone")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute(
      "href",
      "/members/30000000-0000-4000-8000-000000000003",
    );
  });

  it("shows a tombstone for a deleted message instead of its body", async () => {
    mocks.listMessages.mockResolvedValue({
      items: [
        message({
          status: "deleted" as const,
          body: null,
          author_id: null,
          author_display_name: null,
        }),
      ],
      nextCursor: null,
    });
    await renderPage();
    expect(screen.getByText("This message was deleted.")).toBeInTheDocument();
    expect(screen.queryByText("Hello everyone")).not.toBeInTheDocument();
  });

  it("offers the composer only when the channel grants sending", async () => {
    mocks.getChannel.mockResolvedValue({ ...channel, can_send: false });
    await renderPage();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("keeps the message actions reachable for a moderator on a hidden message", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: "30000000-0000-4000-8000-000000000003",
      permissionNames: ["chat.moderate"],
    });
    mocks.listMessages.mockResolvedValue({
      items: [message({ status: "hidden" as const, body: "Still visible to moderators" })],
      nextCursor: null,
    });
    await renderPage();
    // Regression guard: a hidden message must still expose restore/delete/pin.
    expect(
      screen.getByRole("button", { name: "Actions for a message from Ada" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Still visible to moderators")).toBeInTheDocument();
  });

  it("surfaces the manage link only to channel managers", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: "30000000-0000-4000-8000-000000000003",
      permissionNames: ["chat.manage"],
    });
    await renderPage();
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      "/holochat/manage",
    );
  });
});
