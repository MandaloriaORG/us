import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ acknowledgeWarning: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/actions/user-moderation", () => ({
  acknowledgeWarning: mocks.acknowledgeWarning,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { OwnWarnings, type OwnWarningItem } from "./own-warnings";

function warning(overrides: Partial<OwnWarningItem> = {}): OwnWarningItem {
  return {
    warningId: "70000000-0000-4000-8000-000000000001",
    reason: "Stop reposting the same link.",
    createdAt: "2026-07-23T10:00:00.000Z",
    acknowledgedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acknowledgeWarning.mockResolvedValue({ ok: true, id: "x" });
});

describe("OwnWarnings", () => {
  it("renders nothing when the member has no warnings", () => {
    const { container } = render(<OwnWarnings warnings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("acknowledges an unread warning", async () => {
    render(<OwnWarnings warnings={[warning()]} />);
    fireEvent.click(screen.getByRole("button", { name: "I have read this" }));

    await waitFor(() =>
      expect(mocks.acknowledgeWarning).toHaveBeenCalledWith("70000000-0000-4000-8000-000000000001"),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("keeps an acknowledged warning readable but offers no second acknowledgement", () => {
    render(<OwnWarnings warnings={[warning({ acknowledgedAt: "2026-07-23T11:00:00.000Z" })]} />);

    expect(screen.getByText(/Stop reposting the same link/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I have read this" })).not.toBeInTheDocument();
  });

  it("shows a refusal instead of pretending the warning was acknowledged", async () => {
    mocks.acknowledgeWarning.mockResolvedValue({
      ok: false,
      code: "invalid_request",
      message: "That is not valid for the current state.",
    });

    render(<OwnWarnings warnings={[warning()]} />);
    fireEvent.click(screen.getByRole("button", { name: "I have read this" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not valid for the current state/);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
