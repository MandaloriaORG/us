import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setPostVote: vi.fn(),
  toggleBookmark: vi.fn(),
  togglePostReaction: vi.fn(),
}));

vi.mock("@/lib/actions/content", () => ({
  setPostVote: mocks.setPostVote,
  toggleBookmark: mocks.toggleBookmark,
  togglePostReaction: mocks.togglePostReaction,
}));

import { PostEngagement } from "./post-engagement";

const postId = "20000000-0000-4000-8000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("PostEngagement", () => {
  it("toggles the bookmark optimistically and confirms with the server result", async () => {
    mocks.toggleBookmark.mockResolvedValue({ ok: true, bookmarked: true });
    render(
      <PostEngagement
        postId={postId}
        initialLikes={0}
        initialDislikes={0}
        initialVote={0}
        initialBookmarked={false}
        reactionTypes={[]}
      />,
    );

    const button = screen.getByRole("button", { name: "Bookmark this post" });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(mocks.toggleBookmark).toHaveBeenCalledWith(postId));
    expect(await screen.findByRole("button", { name: "Remove bookmark" })).toBeInTheDocument();
  });

  it("reverts the bookmark and shows an error when the toggle is refused", async () => {
    mocks.toggleBookmark.mockResolvedValue({
      ok: false,
      code: "access_denied",
      message: "Sign in first.",
    });
    render(
      <PostEngagement
        postId={postId}
        initialLikes={0}
        initialDislikes={0}
        initialVote={0}
        initialBookmarked={false}
        reactionTypes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bookmark this post" }));

    expect(await screen.findByText("Sign in first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookmark this post" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("wires the post vote through setPostVote with this post's id", async () => {
    mocks.setPostVote.mockResolvedValue({
      ok: true,
      likesCount: 1,
      dislikesCount: 0,
      callerVote: 1,
    });
    render(
      <PostEngagement
        postId={postId}
        initialLikes={0}
        initialDislikes={0}
        initialVote={0}
        initialBookmarked={false}
        reactionTypes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }));
    await waitFor(() => expect(mocks.setPostVote).toHaveBeenCalledWith(postId, 1));
  });
});
