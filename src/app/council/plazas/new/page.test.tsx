import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCouncilPlazaAccess: vi.fn(),
  listPermissions: vi.fn(),
}));

vi.mock("@/app/council/access", () => ({ getCouncilPlazaAccess: mocks.getCouncilPlazaAccess }));
vi.mock("@/lib/content/queries", () => ({ listPermissions: mocks.listPermissions }));
vi.mock("@/components/system/plaza-form", () => ({
  PlazaForm: (props: Record<string, unknown>) => (
    <div data-testid="plaza-form">{JSON.stringify(props)}</div>
  ),
}));

import NewPlazaPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPermissions.mockResolvedValue([]);
});

describe("NewPlazaPage", () => {
  it("denies access without the Plaza administration permission, with no form", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    const element = await NewPlazaPage();
    render(element);

    expect(screen.getByText("You cannot create a Plaza")).toBeInTheDocument();
    expect(screen.queryByTestId("plaza-form")).not.toBeInTheDocument();
  });

  it("renders the create form in create mode when allowed", async () => {
    mocks.getCouncilPlazaAccess.mockResolvedValue({ allowed: true });

    const element = await NewPlazaPage();
    render(element);

    expect(screen.getByTestId("plaza-form")).toHaveTextContent('"mode":"create"');
  });
});
