import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChatMessageEdits: vi.fn(),
}));

vi.mock("@/lib/actions/holochat", () => ({
  getChatMessageEdits: mocks.getChatMessageEdits,
}));

import { EditHistoryViewer } from "./edit-history-viewer";

const MESSAGE_ID = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getChatMessageEdits.mockResolvedValue([]);
});

describe("EditHistoryViewer", () => {
  it("shows a loading state while fetching", () => {
    mocks.getChatMessageEdits.mockReturnValue(new Promise(() => {}));
    render(<EditHistoryViewer messageId={MESSAGE_ID} currentBody="current" onClose={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Edit history")).toBeInTheDocument();
  });

  it("reports an empty state when the message has never been edited", async () => {
    render(<EditHistoryViewer messageId={MESSAGE_ID} currentBody="current" onClose={() => {}} />);
    expect(await screen.findByText("This message has not been edited.")).toBeInTheDocument();
  });

  it("lists each edit with its editor, time and before/after wording", async () => {
    mocks.getChatMessageEdits.mockResolvedValue([
      {
        edit_id: "20000000-0000-4000-8000-000000000002",
        old_body: "first draft",
        editor_display_name: "Ada",
        created_at: "2026-08-16T10:00:00.000Z",
      },
      {
        edit_id: "20000000-0000-4000-8000-000000000003",
        old_body: "second draft",
        editor_display_name: "Ada",
        created_at: "2026-08-16T11:00:00.000Z",
      },
    ]);

    render(<EditHistoryViewer messageId={MESSAGE_ID} currentBody="current" onClose={() => {}} />);

    expect(await screen.findAllByText("Ada")).toHaveLength(2);
    expect(screen.getByText("first draft")).toBeInTheDocument();
    // The latest edit's "after" is the message's current body.
    expect(screen.getAllByText("current")).not.toHaveLength(0);
    expect(mocks.getChatMessageEdits).toHaveBeenCalledWith({ messageId: MESSAGE_ID });
  });

  it("closes when the close button is pressed", async () => {
    const onClose = vi.fn();
    render(<EditHistoryViewer messageId={MESSAGE_ID} currentBody="current" onClose={onClose} />);
    await screen.findByText("This message has not been edited.");
    screen.getByRole("button", { name: "Close edit history" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
