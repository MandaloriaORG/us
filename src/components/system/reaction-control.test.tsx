import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReactionControl } from "./reaction-control";

// The Discord picker is a third-party component; stub it so the toggle flow
// through the smiley trigger is deterministic in jsdom.
vi.mock("emoji-picker-react", async () => {
  const React = await import("react");
  return {
    Theme: { DARK: "dark" },
    default: ({ onEmojiClick }: { onEmojiClick: (e: unknown) => void }) =>
      React.createElement(
        "button",
        { onClick: () => onEmojiClick({ emoji: "❤️", label: "Heart" }) },
        "Pick Heart",
      ),
  };
});

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

  it("keeps the catalog compact: no pills until a total exists, only the picker trigger", () => {
    render(<ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={vi.fn()} />);

    // Before any toggle the empty reactions are NOT shown as pills; the smiley
    // trigger is what opens the Discord-style emoji picker.
    expect(screen.queryByRole("button", { name: "React with Heart to this post" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add reaction" }),
    ).toBeInTheDocument();
  });

  it("opens the emoji picker from the smiley trigger", async () => {
    render(<ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));

    expect(await screen.findByRole("button", { name: "Pick Heart" })).toBeInTheDocument();
  });

  it("renders a pill only after the server reports a positive total, with that total", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue({ ok: true, reactionKey: "heart", total: 4, callerReacted: false });
    render(
      <ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={onToggle} />,
    );

    // Toggle from the Discord picker (open it, then choose the stub emoji).
    fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pick Heart" }));

    // The picker closes and the pill appears with the returned total. A caller
    // that did not react keeps the pill but not the pressed state.
    const pill = await screen.findByRole("button", { name: "React with Heart to this post" });
    expect(pill).toHaveTextContent("4");
    expect(pill).toHaveAttribute("aria-pressed", "false");
    expect(onToggle).toHaveBeenCalledWith("heart");
  });

  it("reverts the press and shows an error when the toggle is refused", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "access_denied", message: "Sign in to react." });
    render(
      <ReactionControl targetLabel="post" reactionTypes={reactionTypes} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pick Heart" }));

    // The optimistic press rolled back: no pill (visible=false) and the error
    // message is announced.
    expect(await screen.findByText("Sign in to react.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "React with Heart to this post" })).toBeNull();
  });
});
