import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  listCommentRevisions,
  listPostRevisions,
  REVISION_LIMIT,
  type ContentRevision,
} from "@/lib/content/revisions";

const postId = "20000000-0000-4000-8000-000000000001";
const commentId = "30000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function revisionRow(index: number): ContentRevision {
  return {
    revision_id: `70000000-0000-4000-8000-00000000000${index}`,
    editor_id: "40000000-0000-4000-8000-000000000001",
    editor_display_name: "Author",
    title: `Title ${index}`,
    body: `Body ${index}`,
    created_at: `2026-07-2${index}T10:00:00.000Z`,
  };
}

describe("listPostRevisions", () => {
  it("names only the post, so the RPC's single-target rule holds", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listPostRevisions(postId);

    expect(mocks.rpc).toHaveBeenCalledWith("list_content_revisions", {
      p_post_id: postId,
      p_limit: REVISION_LIMIT,
    });
  });

  it("returns the rows the RPC produced", async () => {
    mocks.rpc.mockResolvedValue({ data: [revisionRow(1), revisionRow(2)], error: null });

    await expect(listPostRevisions(postId)).resolves.toHaveLength(2);
  });

  it.each([
    [0, 1],
    [-4, 1],
    [500, REVISION_LIMIT],
  ])("bounds a limit of %s to %s", async (requested, expected) => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listPostRevisions(postId, requested);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "list_content_revisions",
      expect.objectContaining({ p_limit: expected }),
    );
  });

  it("returns an empty history rather than throwing when the caller is refused", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "not found" } });

    await expect(listPostRevisions(postId)).resolves.toEqual([]);
  });

  it("never leaks the database message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    const revisions = await listPostRevisions(postId);

    expect(JSON.stringify(revisions)).not.toContain("denied");
  });

  it("treats a null payload as an empty history", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(listPostRevisions(postId)).resolves.toEqual([]);
  });
});

describe("listCommentRevisions", () => {
  it("names only the comment", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listCommentRevisions(commentId);

    expect(mocks.rpc).toHaveBeenCalledWith("list_content_revisions", {
      p_comment_id: commentId,
      p_limit: REVISION_LIMIT,
    });
  });

  it("never sends a post id alongside the comment", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listCommentRevisions(commentId);

    const [, args] = mocks.rpc.mock.calls[0];
    expect(args).not.toHaveProperty("p_post_id");
  });
});
