import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setReportStatus: vi.fn() }));

vi.mock("@/lib/actions/reports", () => ({ setReportStatus: mocks.setReportStatus }));

import { ClaimReportButton } from "./claim-report-button";

const reportId = "00000000-0000-4000-8000-000000000001";

describe("ClaimReportButton", () => {
  beforeEach(() => {
    mocks.setReportStatus.mockReset();
  });

  it("renders nothing once the report is no longer open", () => {
    const { container } = render(<ClaimReportButton reportId={reportId} status="under_review" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("claims an open report with no reason, sent as compare-and-swap", async () => {
    mocks.setReportStatus.mockResolvedValue({ ok: true, reportId });
    render(<ClaimReportButton reportId={reportId} status="open" />);

    fireEvent.click(screen.getByRole("button", { name: "Claim" }));

    await waitFor(() =>
      expect(mocks.setReportStatus).toHaveBeenCalledWith({
        reportId,
        expectedStatus: "open",
        status: "under_review",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the database message when the claim is refused", async () => {
    mocks.setReportStatus.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "Another moderator changed this report. Reload and try again.",
    });
    render(<ClaimReportButton reportId={reportId} status="open" />);

    fireEvent.click(screen.getByRole("button", { name: "Claim" }));

    expect(
      await screen.findByText("Another moderator changed this report. Reload and try again."),
    ).toBeInTheDocument();
  });
});
