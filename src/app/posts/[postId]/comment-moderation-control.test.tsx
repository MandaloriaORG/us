import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setCommentFlags: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/actions/moderation", () => ({ setCommentFlags: mocks.setCommentFlags }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { CommentModerationControl } from "./comment-moderation-control";

const commentId = "30000000-0000-4000-8000-000000000001";

function open(overrides: Record<string, unknown> = {}) {
  render(
    <CommentModerationControl
      commentId={commentId}
      isPinned={false}
      repliesLocked={false}
      {...overrides}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Moderate" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setCommentFlags.mockResolvedValue({ ok: true, targetId: commentId });
});

describe("CommentModerationControl", () => {
  it("stays out of the way until a moderator asks for it", () => {
    render(
      <CommentModerationControl commentId={commentId} isPinned={false} repliesLocked={false} />,
    );

    expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument();
  });

  it("sends only the flag the button names", async () => {
    open();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Useful answer" } });
    fireEvent.click(screen.getByRole("button", { name: "Pin comment" }));

    await waitFor(() =>
      expect(mocks.setCommentFlags).toHaveBeenCalledWith({
        commentId,
        reason: "Useful answer",
        isPinned: true,
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("names the reverse action when the flag is already set", async () => {
    open({ isPinned: true, repliesLocked: true });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "No longer relevant" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock replies" }));

    await waitFor(() =>
      expect(mocks.setCommentFlags).toHaveBeenCalledWith({
        commentId,
        reason: "No longer relevant",
        repliesLocked: false,
      }),
    );
    // Applied: the control closes and the page re-reads, so the labels come
    // back from the server rather than from a client-side guess.
    expect(await screen.findByRole("button", { name: "Moderate" })).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses to act without a reason", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Lock replies" }));

    expect(mocks.setCommentFlags).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3 characters/);
  });

  it("keeps the reason and shows the failure when the server refuses", async () => {
    mocks.setCommentFlags.mockResolvedValue({
      ok: false,
      code: "access_denied",
      message: "You do not have permission for that action.",
    });

    open();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Off topic" } });
    fireEvent.click(screen.getByRole("button", { name: "Pin comment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not have permission/);
    expect(screen.getByLabelText(/Reason/)).toHaveValue("Off topic");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
