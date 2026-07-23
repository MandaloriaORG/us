import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCouncilPlazaAccess: vi.fn(),
  getPlaza: vi.fn(),
  listPlazas: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/app/council/access", () => ({ getCouncilPlazaAccess: mocks.getCouncilPlazaAccess }));
vi.mock("@/lib/content/queries", () => ({
  getPlaza: mocks.getPlaza,
  listPlazas: mocks.listPlazas,
}));
vi.mock("@/lib/actions/plazas", () => ({ setPlazaStatus: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/system/plaza-form", () => ({
  PlazaForm: (props: Record<string, unknown>) => (
    <div data-testid="plaza-form">{JSON.stringify(props)}</div>
  ),
}));

import CouncilPlazaDetailPage from "./page";

const plazaId = "10000000-0000-4000-8000-000000000001";

const summary = {
  id: plazaId,
  slug: "the-forge",
  name: "The Forge",
  description: "Where work is shown.",
  visibility: "members" as const,
  status: "active" as const,
  sort_order: 3,
  posts_count: 12,
};

const detail = {
  id: plazaId,
  slug: "the-forge",
  name: "The Forge",
  description: "Where work is shown.",
  rules: "Be precise.",
  visibility: "members" as const,
  status: "active" as const,
  posts_count: 12,
  can_post: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.listPlazas.mockResolvedValue([summary]);
  mocks.getPlaza.mockResolvedValue(detail);
});

describe("CouncilPlazaDetailPage", () => {
  it("denies access without the Plaza administration permission", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    const element = await CouncilPlazaDetailPage({ params: Promise.resolve({ plazaId }) });
    render(element);

    expect(screen.getByText("You cannot manage this Plaza")).toBeInTheDocument();
    expect(mocks.listPlazas).not.toHaveBeenCalled();
  });

  it("404s on a malformed Plaza id", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({ allowed: true });

    await expect(
      CouncilPlazaDetailPage({ params: Promise.resolve({ plazaId: "not-a-uuid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when no Plaza with that id is visible to the caller", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({ allowed: true });
    mocks.listPlazas.mockResolvedValue([]);

    await expect(
      CouncilPlazaDetailPage({ params: Promise.resolve({ plazaId }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("resolves the id to a slug, then loads the full detail for the form", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({ allowed: true });

    const element = await CouncilPlazaDetailPage({ params: Promise.resolve({ plazaId }) });
    render(element);

    expect(mocks.getPlaza).toHaveBeenCalledWith("the-forge");
    expect(screen.getByRole("heading", { name: "The Forge" })).toBeInTheDocument();

    const form = JSON.parse(screen.getByTestId("plaza-form").textContent ?? "{}");
    expect(form).toMatchObject({
      mode: "edit",
      plazaId,
      initialSlug: "the-forge",
      initialName: "The Forge",
      initialDescription: "Where work is shown.",
      initialRules: "Be precise.",
      initialVisibility: "members",
      initialSortOrder: 3,
    });

    expect(screen.getByRole("button", { name: "Archive Plaza" })).toBeInTheDocument();
  });
});
