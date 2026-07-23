import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setReportStatus: vi.fn() }));

vi.mock("@/lib/actions/reports", () => ({ setReportStatus: mocks.setReportStatus }));

import { ReportDecisionPanel } from "./report-decision-panel";

const reportId = "00000000-0000-4000-8000-000000000001";

describe("ReportDecisionPanel", () => {
  beforeEach(() => {
    mocks.setReportStatus.mockReset();
  });

  it("renders nothing once the report is closed", () => {
    const { container } = render(<ReportDecisionPanel reportId={reportId} status="resolved" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("blocks resolving without a reason of at least 3 characters", async () => {
    render(<ReportDecisionPanel reportId={reportId} status="open" />);

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    expect(await screen.findByText("Give a reason of at least 3 characters.")).toBeInTheDocument();
    expect(mocks.setReportStatus).not.toHaveBeenCalled();
  });

  it("resolves with the reason and the status this panel displayed", async () => {
    mocks.setReportStatus.mockResolvedValue({ ok: true, reportId });
    render(<ReportDecisionPanel reportId={reportId} status="under_review" />);

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Confirmed and actioned." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    await waitFor(() =>
      expect(mocks.setReportStatus).toHaveBeenCalledWith({
        reportId,
        expectedStatus: "under_review",
        status: "resolved",
        resolution: "Confirmed and actioned.",
      }),
    );
    expect(await screen.findByText("Report resolved.")).toBeInTheDocument();
  });

  it("surfaces a conflict without silently retrying", async () => {
    mocks.setReportStatus.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "Another moderator changed this report. Reload and try again.",
    });
    render(<ReportDecisionPanel reportId={reportId} status="open" />);

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Not a violation." } });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(
      await screen.findByText(
        "Another moderator changed this report. Reload and try again. Reload the page and try again.",
      ),
    ).toBeInTheDocument();
  });
});
