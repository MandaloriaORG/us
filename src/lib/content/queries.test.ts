import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const clientWithStorage = () => ({
  rpc: mocks.rpc,
  storage: {
    from: () => ({ createSignedUrls: mocks.createSignedUrls }),
  },
});

import {
  buildCommentTree,
  getPost,
  listPostComments,
  listPosts,
  parsePostOrder,
  POST_PAGE_SIZE,
  type PostComment,
  type PostSummary,
} from "@/lib/content/queries";

const plazaId = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue(clientWithStorage());
  mocks.createSignedUrls.mockResolvedValue({ data: [], error: null });
});

function postRow(index: number): PostSummary {
  return {
    id: `20000000-0000-4000-8000-00000000000${index}`,
    plaza_id: plazaId,
    plaza_slug: "central-plaza",
    plaza_name: "Central Plaza",
    author_id: "30000000-0000-4000-8000-000000000001",
    author_display_name: "Member A",
    author_avatar_path: "",
    authorAvatarUrl: null,
    title: `Post ${index}`,
    excerpt: "Body",
    status: "published",
    is_pinned: false,
    is_highlighted: false,
    comments_count: 0,
    likes_count: 2,
    dislikes_count: 1,
    score: 1,
    created_at: `2026-07-2${index}T10:00:00Z`,
  };
}

function commentRow(id: string, parentId: string | null): PostComment {
  return {
    id,
    post_id: "20000000-0000-4000-8000-000000000001",
    parent_id: parentId,
    author_id: "30000000-0000-4000-8000-000000000001",
    author_display_name: "Member A",
    author_avatar_path: "",
    authorAvatarUrl: null,
    body: "text",
    status: "published",
    depth: parentId ? 1 : 0,
    replies_count: 0,
    likes_count: 0,
    dislikes_count: 0,
    caller_vote: 0,
    is_removed: false,
    is_pinned: false,
    replies_locked: false,
    can_edit: false,
    can_reply: true,
    created_at: "2026-07-23T10:00:00Z",
    updated_at: "2026-07-23T10:00:00Z",
  };
}

describe("post listings", () => {
  it("reports no next cursor for a partial page", async () => {
    mocks.rpc.mockResolvedValue({ data: [postRow(1)], error: null });

    const page = await listPosts({ plazaId });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("emits a cursor built from the last row of a full page", async () => {
    const rows = Array.from({ length: POST_PAGE_SIZE }, (_, index) => postRow(index % 9));
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const page = await listPosts({ plazaId });
    const last = rows[rows.length - 1];

    expect(page.nextCursor).toBe(`${last.created_at}~${last.id}`);
  });

  it("includes the score in the cursor only when ordering by popularity", async () => {
    const rows = Array.from({ length: POST_PAGE_SIZE }, (_, index) => postRow(index % 9));
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const page = await listPosts({ plazaId, order: "popular" });
    const last = rows[rows.length - 1];

    expect(page.nextCursor).toBe(`${last.score}~${last.created_at}~${last.id}`);
  });

  it("passes a decoded cursor to the RPC and ignores a corrupt one", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listPosts({ plazaId, cursor: "garbage" });

    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_cursor_created_at: undefined,
      p_cursor_id: undefined,
    });
  });

  it("clamps an oversized page request", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listPosts({ plazaId, pageSize: 5000 });

    expect(mocks.rpc.mock.calls[0][1].p_limit).toBe(50);
  });

  it("returns an empty page instead of surfacing a database error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });

    await expect(listPosts({ plazaId })).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("treats a missing post as absent rather than as a failure", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getPost("20000000-0000-4000-8000-000000000001")).resolves.toBeNull();
  });

  it("only accepts the two supported orderings", () => {
    expect(parsePostOrder("popular")).toBe("popular");
    expect(parsePostOrder("recent")).toBe("recent");
    expect(parsePostOrder("../../etc/passwd")).toBe("recent");
    expect(parsePostOrder(undefined)).toBe("recent");
  });
});

describe("comment threads", () => {
  it("nests replies under their parent", () => {
    const parent = commentRow("40000000-0000-4000-8000-000000000001", null);
    const reply = commentRow("40000000-0000-4000-8000-000000000002", parent.id);

    const tree = buildCommentTree([parent, reply]);

    expect(tree).toHaveLength(1);
    expect(tree[0].replies.map((node) => node.id)).toEqual([reply.id]);
  });

  it("surfaces a reply whose parent is on an earlier page instead of dropping it", () => {
    const orphan = commentRow(
      "40000000-0000-4000-8000-000000000003",
      "40000000-0000-4000-8000-00000000000f",
    );

    const tree = buildCommentTree([orphan]);

    expect(tree.map((node) => node.id)).toEqual([orphan.id]);
  });

  it("keeps a removed comment in the thread so its replies retain context", async () => {
    const removed = {
      ...commentRow("40000000-0000-4000-8000-000000000004", null),
      body: null,
      is_removed: true,
    };
    const reply = commentRow("40000000-0000-4000-8000-000000000005", removed.id);
    mocks.rpc.mockResolvedValue({ data: [removed, reply], error: null });

    const page = await listPostComments("20000000-0000-4000-8000-000000000001");
    const tree = buildCommentTree(page.items);

    expect(tree).toHaveLength(1);
    expect(tree[0].body).toBeNull();
    expect(tree[0].replies).toHaveLength(1);
  });
});
