import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  warnUser: vi.fn(),
  addUserNote: vi.fn(),
  deleteUserNote: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/actions/user-moderation", () => ({
  warnUser: mocks.warnUser,
  addUserNote: mocks.addUserNote,
  deleteUserNote: mocks.deleteUserNote,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { UserModerationPanel, type CouncilUserNote } from "./user-moderation-panel";

const targetUserId = "40000000-0000-4000-8000-000000000001";
const viewerId = "40000000-0000-4000-8000-000000000002";

function note(overrides: Partial<CouncilUserNote> = {}): CouncilUserNote {
  return {
    noteId: "60000000-0000-4000-8000-000000000001",
    body: "Second offence this month.",
    createdAt: "2026-07-23T10:00:00.000Z",
    actorId: viewerId,
    actorDisplayName: "Ada",
    ...overrides,
  };
}

function renderPanel(overrides: Record<string, unknown> = {}) {
  render(
    <UserModerationPanel
      targetUserId={targetUserId}
      canWarn
      notes={[]}
      viewerId={viewerId}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.warnUser.mockResolvedValue({ ok: true, id: "x" });
  mocks.addUserNote.mockResolvedValue({ ok: true, id: "x" });
  mocks.deleteUserNote.mockResolvedValue({ ok: true, id: "x" });
});

describe("UserModerationPanel", () => {
  it("keeps the two audiences apart in its own copy", () => {
    renderPanel();

    expect(screen.getByText(/The member reads this wording/)).toBeInTheDocument();
    expect(screen.getByText(/This member never sees these/)).toBeInTheDocument();
  });

  it("sends a warning addressed to the member", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Warning"), {
      target: { value: "Stop reposting the same link." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send warning" }));

    await waitFor(() =>
      expect(mocks.warnUser).toHaveBeenCalledWith({
        userId: targetUserId,
        reason: "Stop reposting the same link.",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Warning sent to the member.");
  });

  it("refuses a warning that is too short before calling the server", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Warning"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: "Send warning" }));

    expect(mocks.warnUser).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3 characters/);
  });

  it("hides the warning form without the permission", () => {
    renderPanel({ canWarn: false });

    expect(screen.queryByLabelText("Warning")).not.toBeInTheDocument();
    expect(screen.getByLabelText("New note")).toBeInTheDocument();
  });

  it("adds a note and keeps the wording out of the failure path", async () => {
    mocks.addUserNote.mockResolvedValue({
      ok: false,
      code: "access_denied",
      message: "You do not have permission for that action.",
    });

    renderPanel();
    fireEvent.change(screen.getByLabelText("New note"), {
      target: { value: "Watch this account." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() =>
      expect(mocks.addUserNote).toHaveBeenCalledWith({
        userId: targetUserId,
        body: "Watch this account.",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/do not have permission/);
    expect(screen.getByLabelText("New note")).toHaveValue("Watch this account.");
  });

  it("offers removal only on the reader's own notes", () => {
    renderPanel({
      notes: [
        note(),
        note({
          noteId: "60000000-0000-4000-8000-000000000002",
          actorId: "40000000-0000-4000-8000-000000000003",
          actorDisplayName: "Bo",
        }),
      ],
    });

    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("names a removed note author rather than leaving the attribution blank", () => {
    renderPanel({ notes: [note({ actorId: null, actorDisplayName: null })] });

    expect(screen.getByText(/Account removed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("removes a note and re-reads the page", async () => {
    renderPanel({ notes: [note()] });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(mocks.deleteUserNote).toHaveBeenCalledWith(
        "60000000-0000-4000-8000-000000000001",
        targetUserId,
      ),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
