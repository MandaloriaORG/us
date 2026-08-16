import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNotificationBellState: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("@/lib/actions/holochat", () => ({
  getNotificationBellState: mocks.getNotificationBellState,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}));

// Radix Popover positions itself with @floating-ui, which reads ResizeObserver
// and scroll offsets that jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

import { NotificationBell } from "./notification-bell";

const recent = [
  {
    notification_id: "20000000-0000-4000-8000-000000000001",
    type: "post_reply" as const,
    actor_id: "30000000-0000-4000-8000-000000000003",
    actor_display_name: "Ada",
    payload: { post_id: "40000000-0000-4000-8000-000000000004" },
    read_at: null,
    created_at: "2026-08-16T10:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markAllNotificationsRead.mockResolvedValue({ ok: true, updated: 0 });
});

describe("NotificationBell", () => {
  it("renders nothing for signed-out visitors", async () => {
    mocks.getNotificationBellState.mockResolvedValue({
      signedIn: false,
      unreadCount: 0,
      recent: [],
    });
    render(<NotificationBell />);
    await waitFor(() => expect(mocks.getNotificationBellState).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Notifications/ })).not.toBeInTheDocument();
  });

  it("shows the unread count badge and opens a preview of the newest rows", async () => {
    mocks.getNotificationBellState.mockResolvedValue({
      signedIn: true,
      unreadCount: 3,
      recent,
    });
    render(<NotificationBell />);

    const trigger = await screen.findByRole("button", { name: "Notifications, 3 unread" });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(await screen.findByText("Ada replied to your post")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all notifications/ })).toHaveAttribute(
      "href",
      "/holochat/notifications",
    );
  });

  it("caps the badge at 99 when the unread count exceeds the fetched ceiling", async () => {
    mocks.getNotificationBellState.mockResolvedValue({
      signedIn: true,
      unreadCount: 120,
      recent: [],
    });
    render(<NotificationBell />);
    const trigger = await screen.findByRole("button", { name: "Notifications, 120 unread" });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
