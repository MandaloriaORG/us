import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReactionControl } from "./reaction-control";

const reactionTypes = [
  { key: "heart", label: "Heart", emoji: "❤️", sort_order: 1 },
  { key: "laugh", label: "Laugh", emoji: "😂", sort_order: 2 },
];

describe("ReactionControl", () => {
  it("renders nothing when the configured catalog is empty", () => {
    const { container } = render(
      <ReactionControl targetLabel="post" reactionTypes={[]} onToggle={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every configured reaction, not a hardcoded set", () => {
    render(<ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "React with Heart to this post" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "React with Laugh to this post" }),
    ).toBeInTheDocument();
  });

  it("shows no total until the server has answered, then shows the returned total", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue({ ok: true, reactionKey: "heart", total: 4, callerReacted: true });
    render(
      <ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={onToggle} />,
    );

    const heart = screen.getByRole("button", { name: "React with Heart to this post" });
    expect(heart).not.toHaveTextContent("4");

    fireEvent.click(heart);

    await waitFor(() => expect(heart).toHaveTextContent("4"));
    expect(heart).toHaveAttribute("aria-pressed", "true");
  });

  it("reverts the pressed state and shows an error when the toggle is refused", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "access_denied", message: "Sign in to react." });
    render(
      <ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "React with Heart to this post" }));

    expect(await screen.findByText("Sign in to react.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "React with Heart to this post" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
