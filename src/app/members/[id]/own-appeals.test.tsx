import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAppeal: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/actions/appeals", () => ({ createAppeal: mocks.createAppeal }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { OwnAppeals, type OwnModerationActionItem } from "./own-appeals";

const auditLogId = "80000000-0000-4000-8000-000000000001";
const argument = "The link was posted once and then edited, not reposted twice as claimed.";

function action(overrides: Partial<OwnModerationActionItem> = {}): OwnModerationActionItem {
  return {
    auditLogId,
    action: "user.warned",
    actionLabel: "Warning",
    reason: "Stop reposting the same link.",
    createdAt: "2026-07-23T10:00:00.000Z",
    appealId: null,
    appealStatus: null,
    appealStatusLabel: null,
    appealDecision: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAppeal.mockResolvedValue({ ok: true, appealId: "x" });
});

describe("OwnAppeals", () => {
  it("renders nothing when no action was ever taken", () => {
    const { container } = render(<OwnAppeals actions={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the action and the reason given for it", () => {
    render(<OwnAppeals actions={[action()]} />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText(/Stop reposting the same link/)).toBeInTheDocument();
  });

  it("files an appeal against the action it sits under", async () => {
    render(<OwnAppeals actions={[action()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Appeal this" }));
    fireEvent.change(screen.getByLabelText("Your appeal"), { target: { value: argument } });
    fireEvent.click(screen.getByRole("button", { name: "Send appeal" }));

    await waitFor(() =>
      expect(mocks.createAppeal).toHaveBeenCalledWith({ auditLogId, body: argument }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses an argument that is too short before calling the server", async () => {
    render(<OwnAppeals actions={[action()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Appeal this" }));
    fireEvent.change(screen.getByLabelText("Your appeal"), { target: { value: "unfair" } });
    fireEvent.click(screen.getByRole("button", { name: "Send appeal" }));

    expect(mocks.createAppeal).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 20 characters/);
  });

  it("keeps the argument when the server refuses it", async () => {
    mocks.createAppeal.mockResolvedValue({
      ok: false,
      code: "rate_limited",
      message: "You have filed several appeals recently. Try again later.",
    });

    render(<OwnAppeals actions={[action()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Appeal this" }));
    fireEvent.change(screen.getByLabelText("Your appeal"), { target: { value: argument } });
    fireEvent.click(screen.getByRole("button", { name: "Send appeal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/several appeals recently/);
    expect(screen.getByLabelText("Your appeal")).toHaveValue(argument);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("offers no second appeal once one exists, and shows its state", () => {
    render(
      <OwnAppeals
        actions={[
          action({
            appealId: "90000000-0000-4000-8000-000000000001",
            appealStatus: "under_review",
            appealStatusLabel: "Under review",
          }),
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Appeal this" })).not.toBeInTheDocument();
    expect(screen.getByText(/Appeal under review/)).toBeInTheDocument();
  });

  it("shows the decision once the appeal is decided", () => {
    render(
      <OwnAppeals
        actions={[
          action({
            appealId: "90000000-0000-4000-8000-000000000001",
            appealStatus: "granted",
            appealStatusLabel: "Granted",
            appealDecision: "The edit history supports you; the warning is withdrawn.",
          }),
        ]}
      />,
    );

    expect(screen.getByText(/the warning is withdrawn/)).toBeInTheDocument();
  });
});
