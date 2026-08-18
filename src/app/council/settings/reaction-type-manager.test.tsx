import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setReactionTypeActive: vi.fn(),
  upsertReactionType: vi.fn(),
}));

vi.mock("@/lib/actions/reaction-types", () => ({
  setReactionTypeActive: mocks.setReactionTypeActive,
  upsertReactionType: mocks.upsertReactionType,
}));

import { ReactionTypeManager, type AdminReactionType } from "./reaction-type-manager";

const types: AdminReactionType[] = [
  {
    key: "this-is-the-way",
    label: "This is the Way",
    emoji: "🛡️",
    is_active: true,
    affects_reputation: true,
    sort_order: 10,
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    key: "laughs",
    label: "Laughs",
    emoji: "😄",
    is_active: false,
    affects_reputation: false,
    sort_order: 50,
    created_at: "2026-08-01T10:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setReactionTypeActive.mockResolvedValue({ ok: true, key: "laughs" });
  mocks.upsertReactionType.mockResolvedValue({ ok: true, key: "shiny" });
});

describe("ReactionTypeManager", () => {
  it("lists every type with its active state", () => {
    render(<ReactionTypeManager types={types} />);
    expect(screen.getByText("This is the Way")).toBeInTheDocument();
    expect(screen.getByText("Laughs")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("🛡️")).toBeInTheDocument();
  });

  it("shows an empty state when the catalog is empty", () => {
    render(<ReactionTypeManager types={[]} />);
    expect(screen.getByText("No reaction types yet. Create the first one.")).toBeInTheDocument();
  });

  it("deactivates an active type via the CAS RPC with the shown state", async () => {
    render(<ReactionTypeManager types={types} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate" })[0]);

    await screen.findByText("Saved.");

    expect(mocks.setReactionTypeActive).toHaveBeenCalledWith({
      key: "this-is-the-way",
      expectedActive: true,
      isActive: false,
      reason: "Deactivated from Council",
    });
  });

  it("activates an inactive type", async () => {
    render(<ReactionTypeManager types={types} />);
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await screen.findByText("Saved.");

    expect(mocks.setReactionTypeActive).toHaveBeenCalledWith({
      key: "laughs",
      expectedActive: false,
      isActive: true,
      reason: "Reactivated from Council",
    });
  });

  it("creates a new type through the upsert RPC", async () => {
    render(<ReactionTypeManager types={types} />);
    fireEvent.click(screen.getByRole("button", { name: "New type" }));

    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "shiny" } });
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Shiny" } });
    fireEvent.change(screen.getByLabelText("Emoji"), { target: { value: "✨" } });
    fireEvent.click(screen.getByRole("button", { name: "Create type" }));

    await screen.findByText("Saved.");

    expect(mocks.upsertReactionType).toHaveBeenCalledWith({
      key: "shiny",
      label: "Shiny",
      emoji: "✨",
      affectsReputation: false,
      sortOrder: 0,
    });
  });

  it("surfaces a mutation error", async () => {
    mocks.setReactionTypeActive.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "This reaction type changed while you were viewing it. Reload and try again.",
    });
    render(<ReactionTypeManager types={types} />);
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    expect(
      await screen.findByText(
        "This reaction type changed while you were viewing it. Reload and try again.",
      ),
    ).toBeInTheDocument();
  });
});
