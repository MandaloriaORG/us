import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizationSnapshot: vi.fn(),
  drainOutbox: vi.fn(),
  listOwnNotifications: vi.fn(),
  getNotificationPreferences: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));
vi.mock("@/lib/holochat/queries", () => ({
  drainOutbox: mocks.drainOutbox,
  listOwnNotifications: mocks.listOwnNotifications,
  getNotificationPreferences: mocks.getNotificationPreferences,
}));
vi.mock("@/components/system/notification-bell", () => ({
  NotificationBell: () => null,
}));

import NotificationsPage from "./page";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const notification = {
  notification_id: "20000000-0000-4000-8000-000000000001",
  type: "post_reply" as const,
  actor_id: "30000000-0000-4000-8000-000000000003",
  actor_display_name: "Ada",
  payload: { post_id: "40000000-0000-4000-8000-000000000004" },
  read_at: null,
  created_at: "2026-08-16T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.drainOutbox.mockResolvedValue(undefined);
  mocks.listOwnNotifications.mockResolvedValue({ items: [notification], nextCursor: null });
  mocks.getNotificationPreferences.mockResolvedValue({});
});

async function renderPage() {
  const element = await NotificationsPage();
  return render(element);
}

describe("NotificationsPage", () => {
  it("asks signed-out visitors to sign in", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: false,
      reason: "not_authenticated",
    });
    await renderPage();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login");
    expect(mocks.drainOutbox).not.toHaveBeenCalled();
  });

  it("drains the outbox and lists the caller's notifications", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: "u",
      permissionNames: [],
    });
    await renderPage();
    expect(mocks.drainOutbox).toHaveBeenCalled();
    expect(screen.getByText("Ada replied to your post")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing to read", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: "u",
      permissionNames: [],
    });
    mocks.listOwnNotifications.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage();
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });

  it("seeds every preference toggle, defaulting the unsaved types to enabled", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      userId: "u",
      permissionNames: [],
    });
    mocks.getNotificationPreferences.mockResolvedValue({ post_reply: false });
    await renderPage();
    expect(screen.getByLabelText("Replies to your posts")).not.toBeChecked();
    expect(screen.getByLabelText("Reactions to your content")).toBeChecked();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeInTheDocument();
  });
});
