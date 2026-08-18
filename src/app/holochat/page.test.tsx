import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listChannels: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/holochat/queries", () => ({ listChannels: mocks.listChannels }));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
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
  it("redirects straight into the announcements channel when one exists", async () => {
    await renderPage();
    expect(mocks.redirect).toHaveBeenCalledWith("/holochat/announcements");
  });

  it("redirects to the first channel when there is no announcements channel", async () => {
    mocks.listChannels.mockResolvedValue([general]);
    await renderPage();
    expect(mocks.redirect).toHaveBeenCalledWith("/holochat/general");
  });

  it("shows the empty state when no channels are open", async () => {
    mocks.listChannels.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("No channels yet")).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
