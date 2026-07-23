import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
  pending: false,
  push: vi.fn(),
}));

vi.mock("@/lib/actions/plazas", () => ({
  createPlaza: vi.fn(),
  updatePlaza: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: () => [mocks.state, vi.fn()],
    useFormStatus: () => ({ pending: mocks.pending }),
  };
});

import { PlazaForm } from "./plaza-form";

const plazaId = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = null;
  mocks.pending = false;
});

describe("PlazaForm", () => {
  it("create mode has no rules field and defaults visibility to public", () => {
    render(<PlazaForm mode="create" />);

    expect(screen.getByLabelText(/Slug/)).toHaveValue("");
    expect(screen.getByLabelText(/Name/)).toHaveValue("");
    expect(screen.getByLabelText("Who can see this Plaza")).toHaveValue("public");
    expect(screen.getByLabelText("Sort order")).toHaveValue(0);
    expect(screen.queryByLabelText("Rules")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Plaza" })).toBeInTheDocument();
  });

  it("edit mode pre-fills every field, including rules", () => {
    render(
      <PlazaForm
        mode="edit"
        plazaId={plazaId}
        initialSlug="the-forge"
        initialName="The Forge"
        initialDescription="Where work is shown."
        initialRules="Be precise."
        initialVisibility="members"
        initialSortOrder={3}
      />,
    );

    expect(screen.getByLabelText(/Slug/)).toHaveValue("the-forge");
    expect(screen.getByLabelText(/Name/)).toHaveValue("The Forge");
    expect(screen.getByLabelText("Description")).toHaveValue("Where work is shown.");
    expect(screen.getByLabelText("Rules")).toHaveValue("Be precise.");
    expect(screen.getByLabelText("Who can see this Plaza")).toHaveValue("members");
    expect(screen.getByLabelText("Sort order")).toHaveValue(3);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("shows invalid_input field errors beside their fields without navigating", () => {
    mocks.state = {
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { slug: "Use lowercase words separated by hyphens" },
    };
    render(<PlazaForm mode="create" />);

    expect(
      screen.getByText("Use lowercase words separated by hyphens"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check the highlighted fields and try again."),
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("navigates to the new Plaza's edit screen once creation succeeds", () => {
    mocks.state = { ok: true, plazaId };
    render(<PlazaForm mode="create" />);

    expect(mocks.push).toHaveBeenCalledWith(`/council/plazas/${plazaId}`);
  });

  it("shows an inline success message on edit without navigating away", () => {
    mocks.state = { ok: true, plazaId };
    render(
      <PlazaForm
        mode="edit"
        plazaId={plazaId}
        initialSlug="the-forge"
        initialName="The Forge"
        initialDescription={null}
        initialRules={null}
        initialVisibility="public"
        initialSortOrder={0}
      />,
    );

    expect(screen.getByText("Plaza updated.")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("surfaces a conflict message on edit and does not treat it as success", () => {
    mocks.state = {
      ok: false,
      code: "conflict",
      message: "This Plaza changed while you were viewing it. Reload and try again.",
    };
    render(
      <PlazaForm
        mode="edit"
        plazaId={plazaId}
        initialSlug="the-forge"
        initialName="The Forge"
        initialDescription={null}
        initialRules={null}
        initialVisibility="public"
        initialSortOrder={0}
      />,
    );

    expect(
      screen.getByText("This Plaza changed while you were viewing it. Reload and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Plaza updated.")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows a pending submit label while the mutation is in flight", () => {
    mocks.pending = true;
    render(<PlazaForm mode="create" />);

    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });
});
