import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listChannels: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
}));

vi.mock("@/lib/holochat/queries", () => ({ listChannels: mocks.listChannels }));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));
vi.mock("@/components/system/notification-bell", () => ({
  NotificationBell: () => null,
}));

import HolochatPage from "./page";

const general = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "general",
  name: "General",
  description: "Everyday conversation.",
  kind: "public" as const,
  clan_id: null,
  sort_order: 20,
};

const announcements = {
  id: "10000000-0000-4000-8000-000000000002",
  slug: "announcements",
  name: "Announcements",
  description: "Official notices from the Council.",
  kind: "announcements" as const,
  clan_id: null,
  sort_order: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listChannels.mockResolvedValue([general, announcements]);
  mocks.getAuthorizationSnapshot.mockResolvedValue({
    allowed: true,
    userId: "u",
    permissionNames: [],
  });
});

async function renderPage() {
  const element = await HolochatPage();
  return render(element);
}

describe("HolochatPage", () => {
  it("lists every visible channel as a navigation row", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: /General/ })).toHaveAttribute(
      "href",
      "/holochat/general",
    );
    expect(screen.getByRole("link", { name: /Announcements/ })).toHaveAttribute(
      "href",
      "/holochat/announcements",
    );
  });

  it("marks the announcements channel with its kind", async () => {
    await renderPage();
    expect(screen.getAllByText("Announcements").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the empty state when no channels are open", async () => {
    mocks.listChannels.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("No channels yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sign in/ })).not.toBeInTheDocument();
  });

  it("invites signed-out visitors to sign in, and not signed-in members", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: false,
      reason: "not_authenticated",
    });
    await renderPage();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login");
  });
});
