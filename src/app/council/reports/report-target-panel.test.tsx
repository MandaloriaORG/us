import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setPostStatus: vi.fn(),
  setCommentStatus: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/actions/moderation", () => ({
  setPostStatus: mocks.setPostStatus,
  setCommentStatus: mocks.setCommentStatus,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { ReportTargetPanel } from "./report-target-panel";

const postId = "20000000-0000-4000-8000-000000000001";

const fullAccess = { canHide: true, canQuarantine: true, canDelete: true, canRestore: true };

describe("ReportTargetPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing for a profile report", () => {
    const { container } = render(
      <ReportTargetPanel
        targetType="profile"
        targetId={postId}
        targetStatus="active"
        {...fullAccess}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the caller has none of the four permissions", () => {
    const { container } = render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="published"
        canHide={false}
        canQuarantine={false}
        canDelete={false}
        canRestore={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers only hide and restore to a plain Moderator", () => {
    render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="published"
        canHide
        canQuarantine={false}
        canDelete={false}
        canRestore
      />,
    );

    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quarantine" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    // Nothing to restore from `published`.
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("offers only delete-further once the author already removed it", () => {
    render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="deleted_by_author"
        {...fullAccess}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete further" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("requires a reason before hiding", async () => {
    render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="published"
        {...fullAccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    expect(await screen.findByText("Give a reason of at least 3 characters.")).toBeInTheDocument();
    expect(mocks.setPostStatus).not.toHaveBeenCalled();
  });

  it("hides the post as compare-and-swap and refreshes on success", async () => {
    mocks.setPostStatus.mockResolvedValue({ ok: true });
    render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="published"
        {...fullAccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() =>
      expect(mocks.setPostStatus).toHaveBeenCalledWith({
        postId,
        expectedStatus: "published",
        status: "hidden",
        reason: "Spam",
      }),
    );
    expect(await screen.findByText("Hide applied.")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("asks for confirmation before deleting", async () => {
    mocks.setCommentStatus.mockResolvedValue({ ok: true });
    render(
      <ReportTargetPanel
        targetType="comment"
        targetId={postId}
        targetStatus="published"
        {...fullAccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Harassment" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mocks.setCommentStatus).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete this comment\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() =>
      expect(mocks.setCommentStatus).toHaveBeenCalledWith({
        commentId: postId,
        expectedStatus: "published",
        status: "deleted_by_moderator",
        reason: "Harassment",
      }),
    );
  });

  it("surfaces a conflict without changing the displayed state", async () => {
    mocks.setPostStatus.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "Another moderator changed this item. Reload and try again.",
    });
    render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="published"
        {...fullAccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    expect(
      await screen.findByText("Another moderator changed this item. Reload and try again."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Current state:/)).toHaveTextContent("Published");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("treats an unrecognised status defensively by rendering nothing", () => {
    const { container } = render(
      <ReportTargetPanel
        targetType="post"
        targetId={postId}
        targetStatus="not_a_real_status"
        {...fullAccess}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
