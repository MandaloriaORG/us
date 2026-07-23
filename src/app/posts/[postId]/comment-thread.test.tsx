import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createComment: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/actions/content", () => ({ createComment: mocks.createComment }));
vi.mock("@/lib/actions/reports", () => ({ createReport: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { CommentThread } from "./comment-thread";
import type { CommentNode } from "@/lib/content/queries";

const postId = "20000000-0000-4000-8000-000000000001";

function node(): CommentNode {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    post_id: postId,
    parent_id: null,
    author_id: "40000000-0000-4000-8000-000000000001",
    author_display_name: "Ada",
    body: "Hello",
    status: "published",
    is_pinned: false,
    is_removed: false,
    depth: 0,
    likes_count: 0,
    dislikes_count: 0,
    caller_vote: 0,
    can_edit: false,
    can_reply: false,
    replies_locked: false,
    replies_count: 0,
    created_at: "2026-07-23T10:00:00.000Z",
    updated_at: "2026-07-23T10:00:00.000Z",
    replies: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("CommentThread", () => {
  it("shows the closed message and no composer when the post does not accept comments", () => {
    render(
      <CommentThread
        postId={postId}
        thread={[]}
        reactionTypes={[]}
        acceptsComments={false}
        nextCursor={null}
      />,
    );
    expect(screen.getByText("This post is closed to new comments.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add a comment")).not.toBeInTheDocument();
  });

  it("shows the empty state distinct from the closed state when open with no comments", () => {
    render(
      <CommentThread
        postId={postId}
        thread={[]}
        reactionTypes={[]}
        acceptsComments={true}
        nextCursor={null}
      />,
    );
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Add a comment")).toBeInTheDocument();
  });

  it("posts a top-level comment and refreshes the route on success", async () => {
    mocks.createComment.mockResolvedValue({ ok: true, commentId: "1" });
    render(
      <CommentThread
        postId={postId}
        thread={[]}
        reactionTypes={[]}
        acceptsComments={true}
        nextCursor={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "First!" } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    await waitFor(() =>
      expect(mocks.createComment).toHaveBeenCalledWith({ postId, body: "First!", parentId: null }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("renders a load-more link only when a next cursor is present", () => {
    const { rerender } = render(
      <CommentThread
        postId={postId}
        thread={[node()]}
        reactionTypes={[]}
        acceptsComments={true}
        nextCursor={null}
      />,
    );
    expect(screen.queryByRole("link", { name: "Load more comments" })).not.toBeInTheDocument();

    rerender(
      <CommentThread
        postId={postId}
        thread={[node()]}
        reactionTypes={[]}
        acceptsComments={true}
        nextCursor="abc"
      />,
    );
    expect(screen.getByRole("link", { name: "Load more comments" })).toHaveAttribute(
      "href",
      `/posts/${postId}?cursor=abc`,
    );
  });
});
