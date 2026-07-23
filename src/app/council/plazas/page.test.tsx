import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCouncilPlazaAccess: vi.fn(),
  listPlazas: vi.fn(),
}));

vi.mock("@/app/council/access", () => ({ getCouncilPlazaAccess: mocks.getCouncilPlazaAccess }));
vi.mock("@/lib/content/queries", () => ({ listPlazas: mocks.listPlazas }));

import CouncilPlazasPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPlazas.mockResolvedValue([]);
});

describe("CouncilPlazasPage", () => {
  it("denies access without the Plaza administration permission", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    const element = await CouncilPlazasPage();
    render(element);

    expect(screen.getByText("You cannot manage Plazas")).toBeInTheDocument();
    expect(mocks.listPlazas).not.toHaveBeenCalled();
  });

  it("shows an empty state with a New Plaza action when none exist", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({ allowed: true });

    const element = await CouncilPlazasPage();
    render(element);

    expect(screen.getByRole("heading", { name: "No Plazas exist yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New Plaza" })).not.toHaveLength(0);
  });

  it("renders every Plaza, including archived and private ones, with a link to edit it", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({ allowed: true });
    mocks.listPlazas.mockResolvedValue([
      {
        id: "10000000-0000-4000-8000-000000000001",
        slug: "general",
        name: "General",
        description: "Open discussion",
        visibility: "public",
        status: "active",
        sort_order: 0,
        posts_count: 5,
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        slug: "council-only",
        name: "Council Only",
        description: null,
        visibility: "private",
        status: "archived",
        sort_order: 1,
        posts_count: 0,
      },
    ]);

    const element = await CouncilPlazasPage();
    render(element);

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/council/plazas/10000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByRole("link", { name: "Council Only" })).toHaveAttribute(
      "href",
      "/council/plazas/10000000-0000-4000-8000-000000000002",
    );
    expect(screen.getByText("private")).toBeInTheDocument();
    expect(screen.getByText("archived")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Plaza" })).toHaveAttribute(
      "href",
      "/council/plazas/new",
    );
  });
});
