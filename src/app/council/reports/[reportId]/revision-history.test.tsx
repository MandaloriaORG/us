import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPostRevisions: vi.fn(),
  listCommentRevisions: vi.fn(),
}));

vi.mock("@/lib/content/revisions", () => ({
  listPostRevisions: mocks.listPostRevisions,
  listCommentRevisions: mocks.listCommentRevisions,
}));

import { RevisionHistory } from "./revision-history";

function revision(overrides: Record<string, unknown> = {}) {
  return {
    revision_id: "50000000-0000-4000-8000-000000000001",
    title: "Earlier title",
    body: "Earlier wording",
    editor_id: "40000000-0000-4000-8000-000000000001",
    editor_display_name: "Ada",
    created_at: "2026-07-23T10:00:00.000Z",
    ...overrides,
  };
}

async function renderHistory(
  targetType: string,
  targetId = "20000000-0000-4000-8000-000000000001",
) {
  render(await RevisionHistory({ targetType, targetId }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPostRevisions.mockResolvedValue([]);
  mocks.listCommentRevisions.mockResolvedValue([]);
});

describe("RevisionHistory", () => {
  it("renders nothing when the target has no history", async () => {
    const { container } = render(
      (await RevisionHistory({ targetType: "post", targetId: "x" })) ?? <></>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a profile report, and reads no history for it", async () => {
    const { container } = render(
      (await RevisionHistory({ targetType: "profile", targetId: "x" })) ?? <></>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(mocks.listPostRevisions).not.toHaveBeenCalled();
    expect(mocks.listCommentRevisions).not.toHaveBeenCalled();
  });

  it("lists earlier post wordings with their editor", async () => {
    mocks.listPostRevisions.mockResolvedValue([
      revision(),
      revision({ revision_id: "50000000-0000-4000-8000-000000000002", body: "Oldest wording" }),
    ]);

    await renderHistory("post");

    expect(screen.getByText(/2 earlier versions/)).toBeInTheDocument();
    expect(screen.getByText("Earlier wording")).toBeInTheDocument();
    expect(screen.getByText("Oldest wording")).toBeInTheDocument();
    expect(screen.getAllByText(/Ada/)).toHaveLength(2);
  });

  it("reads comment history for a comment target", async () => {
    mocks.listCommentRevisions.mockResolvedValue([revision({ title: null })]);

    await renderHistory("comment");

    expect(mocks.listCommentRevisions).toHaveBeenCalledWith("20000000-0000-4000-8000-000000000001");
    expect(mocks.listPostRevisions).not.toHaveBeenCalled();
    expect(screen.getByText(/1 earlier version/)).toBeInTheDocument();
    expect(screen.queryByText("Earlier title")).not.toBeInTheDocument();
  });

  it("names a removed editor instead of leaving the attribution blank", async () => {
    mocks.listPostRevisions.mockResolvedValue([
      revision({ editor_id: null, editor_display_name: null }),
    ]);

    await renderHistory("post");

    expect(screen.getByText(/Account removed/)).toBeInTheDocument();
  });
});
