import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveAppeal: vi.fn(), claimAppeal: vi.fn() }));

vi.mock("@/lib/actions/appeals", () => ({
  resolveAppeal: mocks.resolveAppeal,
  claimAppeal: mocks.claimAppeal,
}));

import { AppealDecisionPanel } from "./appeal-decision-panel";
import { ClaimAppealButton } from "./claim-appeal-button";

const appealId = "90000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveAppeal.mockResolvedValue({ ok: true, appealId });
  mocks.claimAppeal.mockResolvedValue({ ok: true, appealId });
});

describe("AppealDecisionPanel", () => {
  it("refuses to decide without a reason", async () => {
    render(<AppealDecisionPanel appealId={appealId} status="under_review" isOwnAction={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Grant appeal" }));

    expect(mocks.resolveAppeal).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3 characters/);
  });

  it("sends the status it displayed, so a stale decision conflicts", async () => {
    render(<AppealDecisionPanel appealId={appealId} status="under_review" isOwnAction={false} />);
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "The edit history supports the member." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grant appeal" }));

    await waitFor(() =>
      expect(mocks.resolveAppeal).toHaveBeenCalledWith({
        appealId,
        expectedStatus: "under_review",
        status: "granted",
        decision: "The edit history supports the member.",
      }),
    );
  });

  it("says granting does not undo the action by itself", async () => {
    render(<AppealDecisionPanel appealId={appealId} status="open" isOwnAction={false} />);
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Fair argument." } });
    fireEvent.click(screen.getByRole("button", { name: "Grant appeal" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Undo the original action/);
  });

  it("offers no controls to the moderator who took the action", () => {
    render(<AppealDecisionPanel appealId={appealId} status="open" isOwnAction />);

    expect(screen.queryByRole("button", { name: "Grant appeal" })).not.toBeInTheDocument();
    expect(screen.getByText(/you cannot decide this one/)).toBeInTheDocument();
  });

  it("renders nothing once the appeal is decided", () => {
    const { container } = render(
      <AppealDecisionPanel appealId={appealId} status="granted" isOwnAction={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("surfaces a refusal beside the controls", async () => {
    mocks.resolveAppeal.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "This changed while you were viewing it. Reload and try again.",
    });

    render(<AppealDecisionPanel appealId={appealId} status="under_review" isOwnAction={false} />);
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Denied on the facts." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deny appeal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Reload and try again/);
  });
});

describe("ClaimAppealButton", () => {
  it("claims with the status the row displayed", async () => {
    render(<ClaimAppealButton appealId={appealId} status="open" />);
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));

    await waitFor(() =>
      expect(mocks.claimAppeal).toHaveBeenCalledWith({ appealId, expectedStatus: "open" }),
    );
  });

  it("offers nothing once someone has claimed it", () => {
    const { container } = render(<ClaimAppealButton appealId={appealId} status="under_review" />);

    expect(container).toBeEmptyDOMElement();
  });
});
