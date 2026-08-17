import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  listPostComments: vi.fn(),
  listReactionTypes: vi.fn(),
  listPlazas: vi.fn(),
  listPosts: vi.fn(),
  getCouncilReportAccess: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/content/queries", () => ({
  getPost: mocks.getPost,
  listPostComments: mocks.listPostComments,
  listReactionTypes: mocks.listReactionTypes,
  listPlazas: mocks.listPlazas,
  listPosts: mocks.listPosts,
  // Same tree-building rule as the real module, duplicated here so this test
  // does not import `queries.ts` itself, which is guarded by `server-only`.
  buildCommentTree: (comments: { id: string; parent_id: string | null }[]) => {
    const nodes = new Map(comments.map((c) => [c.id, { ...c, replies: [] as unknown[] }]));
    const roots: unknown[] = [];
    for (const comment of comments) {
      const node = nodes.get(comment.id)!;
      const parent = comment.parent_id ? nodes.get(comment.parent_id) : undefined;
      if (parent) (parent.replies as unknown[]).push(node);
      else roots.push(node);
    }
    return roots;
  },
}));

vi.mock("@/lib/actions/content", () => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  deletePost: vi.fn(),
  setCommentVote: vi.fn(),
  setPostVote: vi.fn(),
  toggleBookmark: vi.fn(),
  toggleCommentReaction: vi.fn(),
  togglePostReaction: vi.fn(),
  updateComment: vi.fn(),
}));

vi.mock("@/lib/actions/reports", () => ({ createReport: vi.fn() }));

vi.mock("@/lib/actions/moderation", () => ({
  movePost: vi.fn(),
  setCommentFlags: vi.fn(),
  setPostFlags: vi.fn(),
  setPostStatus: vi.fn(),
}));

vi.mock("@/app/council/access", () => ({
  getCouncilReportAccess: mocks.getCouncilReportAccess,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

import PostPage from "./page";

const postId = "20000000-0000-4000-8000-000000000001";

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: postId,
    plaza_id: "10000000-0000-4000-8000-000000000001",
    plaza_name: "General",
    plaza_slug: "general",
    title: "Hello world",
    body: "Some **body**",
    author_id: "40000000-0000-4000-8000-000000000001",
    author_display_name: "Ada",
    status: "published",
    is_pinned: false,
    is_highlighted: false,
    edit_locked: false,
    likes_count: 3,
    dislikes_count: 1,
    caller_vote: 0,
    caller_bookmarked: false,
    can_edit: false,
    accepts_comments: true,
    comments_count: 0,
    tag_slugs: [] as string[],
    created_at: "2026-07-23T10:00:00.000Z",
    updated_at: "2026-07-23T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.listReactionTypes.mockResolvedValue([]);
  mocks.listPostComments.mockResolvedValue({ items: [], nextCursor: null });
  mocks.listPlazas.mockResolvedValue([]);
  mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
  mocks.getCouncilReportAccess.mockResolvedValue({ allowed: false, reason: "missing_permission" });
});

async function renderPage(cursor?: string) {
  const element = await PostPage({
    params: Promise.resolve({ postId }),
    searchParams: Promise.resolve({ cursor }),
  });
  return render(element);
}

describe("PostPage", () => {
  it("404s on a malformed post id without querying the database", async () => {
    await expect(
      PostPage({
        params: Promise.resolve({ postId: "not-a-uuid" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getPost).not.toHaveBeenCalled();
  });

  it("404s when the post is invisible to the caller", async () => {
    mocks.getPost.mockResolvedValue(null);
    await expect(
      PostPage({ params: Promise.resolve({ postId }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a tombstone, not an error, for a removed post", async () => {
    mocks.getPost.mockResolvedValue(post({ body: null }));
    await renderPage();

    expect(screen.getByText("This post was removed by its author.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the post body through renderMarkdown when not removed", async () => {
    mocks.getPost.mockResolvedValue(post());
    await renderPage();

    expect(screen.getByRole("heading", { name: "Hello world" })).toBeInTheDocument();
    expect(screen.getByText("body", { selector: "strong" })).toBeInTheDocument();
  });

  it("only renders owner actions when can_edit is true, and offers Report only to a non-author", async () => {
    mocks.getPost.mockResolvedValue(post({ can_edit: false }));
    const first = await renderPage();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
    first.unmount();

    mocks.getPost.mockResolvedValue(post({ can_edit: true }));
    await renderPage();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/posts/${postId}/edit`,
    );
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("shows the closed message when the post no longer accepts comments", async () => {
    mocks.getPost.mockResolvedValue(post({ accepts_comments: false }));
    await renderPage();
    expect(screen.getByText("This post is closed to new comments.")).toBeInTheDocument();
  });

  it("offers a copy-link control for the post's own canonical url", async () => {
    mocks.getPost.mockResolvedValue(post());
    await renderPage();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("offers a proposal entry point that carries the post as its source", async () => {
    mocks.getPost.mockResolvedValue(post());
    await renderPage();

    expect(screen.getByRole("link", { name: "Propose for the Codex" })).toHaveAttribute(
      "href",
      `/codex/propose?post=${postId}`,
    );
  });

  it("withholds the proposal entry point from a removed post", async () => {
    mocks.getPost.mockResolvedValue(post({ body: null }));
    await renderPage();

    expect(screen.queryByRole("link", { name: "Propose for the Codex" })).not.toBeInTheDocument();
  });
});
