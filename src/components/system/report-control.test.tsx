import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createReport: vi.fn() }));

vi.mock("@/lib/actions/reports", () => ({ createReport: mocks.createReport }));

import { ReportControl } from "./report-control";

const postId = "20000000-0000-4000-8000-000000000001";
const commentId = "30000000-0000-4000-8000-000000000001";
const profileId = "40000000-0000-4000-8000-000000000001";

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Report" }));
}

beforeEach(() => vi.clearAllMocks());

describe("ReportControl", () => {
  it("starts idle with just a Report button", () => {
    render(<ReportControl targetType="post" targetId={postId} />);
    expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
  });

  it("expands to a reason select and optional details field, submit disabled until a reason is chosen", () => {
    render(<ReportControl targetType="post" targetId={postId} />);
    open();

    const submit = screen.getByRole("button", { name: "Submit report" });
    expect(submit).toBeDisabled();
    expect(screen.getByLabelText("Details (optional)")).not.toBeRequired();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spam" } });
    expect(submit).toBeEnabled();
  });

  it("cancels back to idle and clears the form", () => {
    render(<ReportControl targetType="post" targetId={postId} />);
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spam" } });
    fireEvent.change(screen.getByLabelText("Details (optional)"), {
      target: { value: "note" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
    expect(mocks.createReport).not.toHaveBeenCalled();

    open();
    expect(screen.getByLabelText("Reason")).toHaveValue("");
    expect(screen.getByLabelText("Details (optional)")).toHaveValue("");
  });

  it.each([
    ["post", { targetType: "post" as const, targetId: postId }, "postId", postId],
    ["comment", { targetType: "comment" as const, targetId: commentId }, "commentId", commentId],
    ["profile", { targetType: "profile" as const, targetId: profileId }, "profileId", profileId],
  ])("submits a %s report with reason and details", async (_label, props, key, id) => {
    mocks.createReport.mockResolvedValue({ ok: true, reportId: "report-1" });
    render(<ReportControl {...props} />);
    open();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "harassment" } });
    fireEvent.change(screen.getByLabelText("Details (optional)"), {
      target: { value: "extra context" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() =>
      expect(mocks.createReport).toHaveBeenCalledWith({
        reason: "harassment",
        details: "extra context",
        [key]: id,
      }),
    );
  });

  it("replaces itself with a terminal confirmation after a successful submit, and does not re-offer the form", async () => {
    mocks.createReport.mockResolvedValue({ ok: true, reportId: "report-1" });
    render(<ReportControl targetType="post" targetId={postId} />);
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect(
      await screen.findByText("Report submitted — a moderator will review it."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit report" })).not.toBeInTheDocument();
  });

  it.each([
    ["duplicate", "You already reported this. A moderator is looking at it."],
    ["rate_limited", "You have reported too much recently. Wait a moment and try again."],
    ["access_denied", "You cannot do this."],
    ["not_found", "That content is no longer available."],
    ["conflict", "Another moderator changed this report. Reload and try again."],
    ["invalid_request", "That is not valid for the current state."],
    ["retry", "That could not be saved. Try again."],
  ])("shows the server's honest %s message inline and keeps the form open", async (code, message) => {
    mocks.createReport.mockResolvedValue({ ok: false, code, message });
    render(<ReportControl targetType="post" targetId={postId} />);
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Submit report" })).toBeInTheDocument();
  });

  it("shows the field-level error for invalid_input next to the details field", async () => {
    mocks.createReport.mockResolvedValue({
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { details: "Details must be at most 1000 characters" },
    });
    render(<ReportControl targetType="post" targetId={postId} />);
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect(
      await screen.findByText("Details must be at most 1000 characters"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Details (optional)")).toHaveAttribute("aria-invalid", "true");
  });
});
