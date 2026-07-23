import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  createComment,
  createPost,
  deletePost,
  setPostTags,
  setPostVote,
  toggleBookmark,
  togglePostReaction,
  updatePost,
} from "@/lib/actions/content";

const plazaId = "10000000-0000-4000-8000-000000000001";
const postId = "20000000-0000-4000-8000-000000000001";
const commentId = "30000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function rpcReturns(data: unknown) {
  mocks.rpc.mockResolvedValue({ data, error: null });
}

function rpcFails(code: string) {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "database said no" } });
}

describe("post writes", () => {
  it("normalises the title and body before calling the RPC", async () => {
    rpcReturns([{ post_id: postId }]);

    const result = await createPost({
      plazaId,
      title: "  The   Way  ",
      body: "  First line\r\nsecond line  ",
    });

    expect(result).toEqual({ ok: true, postId });
    expect(mocks.rpc).toHaveBeenCalledWith("create_post", {
      p_plaza_id: plazaId,
      p_title: "The Way",
      p_body: "First line\nsecond line",
      p_publish: true,
    });
  });

  it("strips control characters without touching Markdown", async () => {
    rpcReturns([{ post_id: postId }]);

    await createPost({
      plazaId,
      title: "A title",
      body: "**bold** and _italic_ stay",
    });

    expect(mocks.rpc.mock.calls[0][1].p_body).toBe("**bold** and _italic_ stay");
  });

  it("reports field errors instead of calling the database", async () => {
    const result = await createPost({ plazaId, title: "no", body: "" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toMatchObject({
        title: expect.stringContaining("at least 3"),
        body: expect.stringContaining("cannot be empty"),
      });
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a plaza id that is not a uuid", async () => {
    const result = await createPost({ plazaId: "../../admin", title: "A title", body: "Body" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "access_denied"],
    ["P0002", "not_found"],
    ["22023", "invalid_request"],
    ["53400", "rate_limited"],
    ["XX000", "retry"],
  ])("maps database code %s onto %s", async (dbCode, expected) => {
    rpcFails(dbCode);

    const result = await createPost({ plazaId, title: "A title", body: "Body" });

    expect(result).toMatchObject({ ok: false, code: expected });
  });

  it("never leaks the database message to the caller", async () => {
    rpcFails("42501");

    const result = await createPost({ plazaId, title: "A title", body: "Body" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain("database said no");
  });

  it("does not report success when the RPC returns no row", async () => {
    rpcReturns([]);

    await expect(createPost({ plazaId, title: "A title", body: "Body" })).resolves.toMatchObject({
      ok: false,
      code: "retry",
    });
  });

  it("still succeeds when cache revalidation throws", async () => {
    rpcReturns([{ post_id: postId }]);
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("no request store");
    });

    await expect(createPost({ plazaId, title: "A title", body: "Body" })).resolves.toEqual({
      ok: true,
      postId,
    });
  });

  it("edits an existing post", async () => {
    rpcReturns([{ post_id: postId }]);

    const result = await updatePost({ postId, title: "New title", body: "New body" });

    expect(result).toEqual({ ok: true, postId });
    expect(mocks.rpc).toHaveBeenCalledWith("update_own_post", {
      p_post_id: postId,
      p_title: "New title",
      p_body: "New body",
    });
  });

  it("soft-deletes a post by id", async () => {
    rpcReturns([{ post_id: postId }]);

    await expect(deletePost(postId)).resolves.toEqual({ ok: true, postId });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_own_post", { p_post_id: postId });
  });
});

describe("tags", () => {
  it("lowercases tags and returns the stored set", async () => {
    rpcReturns([{ tag_slug: "lore", tag_label: "lore" }]);

    const result = await setPostTags({ postId, tagSlugs: ["  LORE  "] });

    expect(result).toEqual({ ok: true, tagSlugs: ["lore"] });
    expect(mocks.rpc).toHaveBeenCalledWith("set_own_post_tags", {
      p_post_id: postId,
      p_tag_slugs: ["lore"],
    });
  });

  it("refuses a tag that is not a slug", async () => {
    const result = await setPostTags({ postId, tagSlugs: ["not a slug!"] });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses more than five tags", async () => {
    const result = await setPostTags({
      postId,
      tagSlugs: ["one", "two", "three", "four", "five", "six"],
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("comments", () => {
  it("creates a reply with an explicit parent", async () => {
    rpcReturns([{ comment_id: commentId }]);

    const result = await createComment({ postId, body: "A reply", parentId: commentId });

    expect(result).toEqual({ ok: true, commentId });
    expect(mocks.rpc).toHaveBeenCalledWith("create_comment", {
      p_post_id: postId,
      p_body: "A reply",
      p_parent_id: commentId,
    });
  });

  it("omits the parent for a top-level comment", async () => {
    rpcReturns([{ comment_id: commentId }]);

    await createComment({ postId, body: "Top level" });

    expect(mocks.rpc.mock.calls[0][1].p_parent_id).toBeUndefined();
  });
});

describe("engagement", () => {
  it.each([-1, 0, 1])("passes vote value %i through", async (value) => {
    rpcReturns([{ likes_count: 3, dislikes_count: 1, caller_vote: value }]);

    const result = await setPostVote(postId, value);

    expect(result).toEqual({ ok: true, likesCount: 3, dislikesCount: 1, callerVote: value });
  });

  it.each([2, -2, "1", null])("refuses vote value %p", async (value) => {
    const result = await setPostVote(postId, value);

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns the toggled reaction state", async () => {
    rpcReturns([{ reaction_key: "this-is-the-way", total: 4, caller_reacted: true }]);

    await expect(togglePostReaction(postId, "this-is-the-way")).resolves.toEqual({
      ok: true,
      reactionKey: "this-is-the-way",
      total: 4,
      callerReacted: true,
    });
  });

  it("refuses a reaction key that is not a slug", async () => {
    const result = await togglePostReaction(postId, "Not A Key");

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports the bookmark state after toggling", async () => {
    rpcReturns([{ bookmarked: true }]);

    await expect(toggleBookmark(postId)).resolves.toEqual({ ok: true, bookmarked: true });
  });

  it("maps a rate-limited engagement onto its own code", async () => {
    rpcFails("53400");

    await expect(setPostVote(postId, 1)).resolves.toMatchObject({
      ok: false,
      code: "rate_limited",
    });
  });
});
