import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VoteControl } from "./vote-control";

describe("VoteControl", () => {
  it("labels each button with the target and reflects the current vote accessibly", () => {
    render(
      <VoteControl
        targetLabel="post"
        initialLikes={3}
        initialDislikes={1}
        initialVote={1}
        onVote={vi.fn()}
      />,
    );

    const like = screen.getByRole("button", { name: "Like this post" });
    const dislike = screen.getByRole("button", { name: "Dislike this post" });
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(dislike).toHaveAttribute("aria-pressed", "false");
    expect(like).toHaveTextContent("3");
    expect(dislike).toHaveTextContent("1");
  });

  it("applies the optimistic count immediately, then reconciles with the server result", async () => {
    const onVote = vi
      .fn()
      .mockResolvedValue({ ok: true, likesCount: 5, dislikesCount: 0, callerVote: 1 });
    render(
      <VoteControl
        targetLabel="post"
        initialLikes={4}
        initialDislikes={0}
        initialVote={0}
        onVote={onVote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }));

    expect(screen.getByRole("button", { name: "Like this post" })).toHaveTextContent("5");
    await waitFor(() => expect(onVote).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Like this post" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it("rolls back the optimistic count and shows an error when the vote is refused", async () => {
    const onVote = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "access_denied", message: "Sign in to vote." });
    render(
      <VoteControl
        targetLabel="comment"
        initialLikes={2}
        initialDislikes={0}
        initialVote={0}
        onVote={onVote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like this comment" }));

    expect(await screen.findByText("Sign in to vote.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Like this comment" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Like this comment" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicking the pressed vote again retracts it", async () => {
    const onVote = vi
      .fn()
      .mockResolvedValue({ ok: true, likesCount: 0, dislikesCount: 0, callerVote: 0 });
    render(
      <VoteControl
        targetLabel="post"
        initialLikes={1}
        initialDislikes={0}
        initialVote={1}
        onVote={onVote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }));

    await waitFor(() => expect(onVote).toHaveBeenCalledWith(0));
  });
});
