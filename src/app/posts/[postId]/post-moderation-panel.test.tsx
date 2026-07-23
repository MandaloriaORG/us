import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  movePost: vi.fn(),
  setPostFlags: vi.fn(),
  setPostStatus: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/actions/moderation", () => ({
  movePost: mocks.movePost,
  setPostFlags: mocks.setPostFlags,
  setPostStatus: mocks.setPostStatus,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { PostModerationPanel } from "./post-moderation-panel";

const postId = "20000000-0000-4000-8000-000000000001";
const plazaId = "10000000-0000-4000-8000-000000000001";
const otherPlazaId = "10000000-0000-4000-8000-000000000002";

function renderPanel(overrides: Record<string, unknown> = {}) {
  return render(
    <PostModerationPanel
      postId={postId}
      plazaId={plazaId}
      status="published"
      isPinned={false}
      isHighlighted={false}
      editLocked={false}
      plazas={[
        { id: plazaId, name: "General" },
        { id: otherPlazaId, name: "Codex" },
      ]}
      {...overrides}
    />,
  );
}

function fillReason(text = "Spam wave") {
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: text } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setPostFlags.mockResolvedValue({ ok: true, targetId: postId });
  mocks.setPostStatus.mockResolvedValue({ ok: true, targetId: postId });
  mocks.movePost.mockResolvedValue({ ok: true, targetId: postId });
});

describe("PostModerationPanel", () => {
  it("sends only the flags that changed, leaving the rest null", async () => {
    renderPanel();
    fillReason();
    fireEvent.click(screen.getByLabelText("Pinned in its Plaza"));
    fireEvent.click(screen.getByRole("button", { name: "Save flags" }));

    await waitFor(() => expect(mocks.setPostFlags).toHaveBeenCalledTimes(1));
    expect(mocks.setPostFlags).toHaveBeenCalledWith({
      postId,
      reason: "Spam wave",
      isPinned: true,
      isHighlighted: null,
      editLocked: null,
    });
  });

  it("refuses to save without a reason", async () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("Highlighted"));
    fireEvent.click(screen.getByRole("button", { name: "Save flags" }));

    expect(mocks.setPostFlags).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3 characters/);
  });

  it("does not offer a save while nothing has changed", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Save flags" })).toBeDisabled();
  });

  it("locks the thread as compare-and-swap against the displayed status", async () => {
    renderPanel();
    fillReason("Thread derailed");
    fireEvent.click(screen.getByRole("button", { name: "Lock post" }));

    await waitFor(() => expect(mocks.setPostStatus).toHaveBeenCalledTimes(1));
    expect(mocks.setPostStatus).toHaveBeenCalledWith({
      postId,
      expectedStatus: "published",
      status: "closed",
      reason: "Thread derailed",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Post locked.");
  });

  it("offers reopening for a locked post", async () => {
    renderPanel({ status: "closed" });
    fillReason("Settled");
    fireEvent.click(screen.getByRole("button", { name: "Reopen post" }));

    await waitFor(() =>
      expect(mocks.setPostStatus).toHaveBeenCalledWith({
        postId,
        expectedStatus: "closed",
        status: "published",
        reason: "Settled",
      }),
    );
  });

  it("offers no status change for a removed post", () => {
    renderPanel({ status: "deleted_by_moderator" });
    expect(screen.queryByRole("button", { name: /Lock post|Reopen post/ })).not.toBeInTheDocument();
  });

  it("never offers the Plaza the post is already in", () => {
    renderPanel();
    expect(screen.getByRole("option", { name: "Codex" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "General" })).not.toBeInTheDocument();
  });

  it("moves the post to the chosen Plaza", async () => {
    renderPanel();
    fillReason("Wrong Plaza");
    fireEvent.change(screen.getByLabelText("Move to another Plaza"), {
      target: { value: otherPlazaId },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move post" }));

    await waitFor(() =>
      expect(mocks.movePost).toHaveBeenCalledWith({
        postId,
        plazaId: otherPlazaId,
        reason: "Wrong Plaza",
      }),
    );
  });

  it("surfaces a conflict beside the controls rather than swallowing it", async () => {
    mocks.setPostFlags.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "This changed while you were viewing it. Reload and try again.",
    });

    renderPanel();
    fillReason();
    fireEvent.click(screen.getByLabelText("Highlighted"));
    fireEvent.click(screen.getByRole("button", { name: "Save flags" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Reload and try again/);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
