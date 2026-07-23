import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  setCommentVote: vi.fn(),
  toggleCommentReaction: vi.fn(),
  updateComment: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/actions/content", () => ({
  createComment: mocks.createComment,
  deleteComment: mocks.deleteComment,
  setCommentVote: mocks.setCommentVote,
  toggleCommentReaction: mocks.toggleCommentReaction,
  updateComment: mocks.updateComment,
}));

vi.mock("@/lib/actions/reports", () => ({ createReport: vi.fn() }));

vi.mock("@/lib/actions/moderation", () => ({ setCommentFlags: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { CommentItem } from "./comment-item";
import type { CommentNode } from "@/lib/content/queries";

const postId = "20000000-0000-4000-8000-000000000001";

function node(overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    post_id: postId,
    parent_id: null,
    author_id: "40000000-0000-4000-8000-000000000001",
    author_display_name: "Ada",
    body: "Hello there",
    status: "published",
    is_pinned: false,
    is_removed: false,
    depth: 0,
    likes_count: 2,
    dislikes_count: 0,
    caller_vote: 0,
    can_edit: false,
    can_reply: true,
    replies_locked: false,
    replies_count: 0,
    created_at: "2026-07-23T10:00:00.000Z",
    updated_at: "2026-07-23T10:00:00.000Z",
    replies: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CommentItem", () => {
  it("renders a tombstone for a removed comment instead of an error", () => {
    render(
      <CommentItem
        node={node({ is_removed: true, body: null, author_display_name: "" })}
        postId={postId}
        reactionTypes={[]}
      />,
    );

    expect(screen.getByRole("note")).toHaveTextContent("Comment removed");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides edit, delete and reply when the server has not granted them", () => {
    render(
      <CommentItem
        node={node({ can_edit: false, can_reply: false })}
        postId={postId}
        reactionTypes={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("offers Report only when the viewer is not the comment's author", () => {
    const { unmount } = render(
      <CommentItem node={node({ can_edit: false })} postId={postId} reactionTypes={[]} />,
    );
    expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
    unmount();

    render(<CommentItem node={node({ can_edit: true })} postId={postId} reactionTypes={[]} />);
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("never offers Report on a removed comment", () => {
    render(
      <CommentItem
        node={node({ is_removed: true, body: null, author_display_name: "" })}
        postId={postId}
        reactionTypes={[]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("edits a comment inline and refreshes the route on success", async () => {
    mocks.updateComment.mockResolvedValue({ ok: true, commentId: "1" });
    render(<CommentItem node={node({ can_edit: true })} postId={postId} reactionTypes={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByLabelText("Edit comment by Ada");
    expect(textarea).toHaveValue("Hello there");

    fireEvent.change(textarea, { target: { value: "Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.updateComment).toHaveBeenCalledWith({ commentId: node().id, body: "Edited" }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("deletes a comment only after an explicit confirm step", async () => {
    mocks.deleteComment.mockResolvedValue({ ok: true, commentId: "1" });
    render(<CommentItem node={node({ can_edit: true })} postId={postId} reactionTypes={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mocks.deleteComment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(mocks.deleteComment).toHaveBeenCalledWith(node().id));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("posts a reply and refreshes the route on success", async () => {
    mocks.createComment.mockResolvedValue({ ok: true, commentId: "2" });
    render(<CommentItem node={node({ can_reply: true })} postId={postId} reactionTypes={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByLabelText("Reply to Ada"), { target: { value: "A reply" } });
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }));

    await waitFor(() =>
      expect(mocks.createComment).toHaveBeenCalledWith({
        postId,
        body: "A reply",
        parentId: node().id,
      }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("carries a #comment-<id> anchor and offers a copy-link control", () => {
    const { container } = render(<CommentItem node={node()} postId={postId} reactionTypes={[]} />);

    expect(container.querySelector(`#comment-${node().id}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("renders nested replies recursively", () => {
    const reply = node({ id: "reply-1", depth: 1, author_display_name: "Bob" });
    render(<CommentItem node={node({ replies: [reply] })} postId={postId} reactionTypes={[]} />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
