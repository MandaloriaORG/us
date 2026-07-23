import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  movePost,
  setCommentFlags,
  setCommentStatus,
  setPostFlags,
  setPostStatus,
} from "@/lib/actions/moderation";

const postId = "20000000-0000-4000-8000-000000000001";
const commentId = "30000000-0000-4000-8000-000000000001";
const plazaId = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

function rpcFails(code: string) {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "database said no" } });
}

describe("setPostStatus", () => {
  it("sends the state it displayed so a stale screen cannot overwrite", async () => {
    const result = await setPostStatus({
      postId,
      expectedStatus: "published",
      status: "hidden",
      reason: "  Off   topic  ",
    });

    expect(result).toEqual({ ok: true, targetId: postId });
    expect(mocks.rpc).toHaveBeenCalledWith("moderation_set_post_status", {
      p_post_id: postId,
      p_expected_status: "published",
      p_status: "hidden",
      p_reason: "Off topic",
    });
  });

  it.each(["published", "closed", "hidden", "quarantined", "deleted_by_moderator", "archived"])(
    "allows %s as a destination",
    async (status) => {
      await expect(
        setPostStatus({ postId, expectedStatus: "published", status, reason: "A reason" }),
      ).resolves.toMatchObject({ ok: true });
    },
  );

  it.each(["draft", "pending_review", "deleted_by_author"])(
    "refuses %s as a destination without reaching the database",
    async (status) => {
      const result = await setPostStatus({
        postId,
        expectedStatus: "published",
        status,
        reason: "A reason",
      });

      expect(result).toMatchObject({ ok: false, code: "invalid_input" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("accepts an author-removed post as the expected state, since it can be deleted further", async () => {
    await expect(
      setPostStatus({
        postId,
        expectedStatus: "deleted_by_author",
        status: "deleted_by_moderator",
        reason: "Removing further",
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it.each([undefined, "", "  ", "no"])("refuses a reason of %s", async (reason) => {
    const result = await setPostStatus({
      postId,
      expectedStatus: "published",
      status: "hidden",
      reason,
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses a reason beyond the ceiling", async () => {
    const result = await setPostStatus({
      postId,
      expectedStatus: "published",
      status: "hidden",
      reason: "x".repeat(501),
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refreshes the feed, the directory and the post itself", async () => {
    await setPostStatus({ postId, expectedStatus: "published", status: "hidden", reason: "Spam" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/plazas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/posts/${postId}`);
  });

  it("does not refresh when the transition failed", async () => {
    rpcFails("40001");

    await setPostStatus({ postId, expectedStatus: "published", status: "hidden", reason: "Spam" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setPostFlags", () => {
  it("passes an unset flag through as null so the database leaves it alone", async () => {
    await setPostFlags({ postId, reason: "Pinned for the week", isPinned: true });

    expect(mocks.rpc).toHaveBeenCalledWith("moderation_set_post_flags", {
      p_post_id: postId,
      p_reason: "Pinned for the week",
      p_is_pinned: true,
      p_is_highlighted: null,
      p_edit_locked: null,
    });
  });

  it("distinguishes clearing a flag from leaving it alone", async () => {
    await setPostFlags({ postId, reason: "Unpinned", isPinned: false });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "moderation_set_post_flags",
      expect.objectContaining({ p_is_pinned: false, p_is_highlighted: null }),
    );
  });

  it("refuses a call that changes no flag at all", async () => {
    const result = await setPostFlags({ postId, reason: "Nothing to change" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("still requires a reason, because the change is audited", async () => {
    const result = await setPostFlags({ postId, reason: "", isPinned: true });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("movePost", () => {
  it("sends both ids and the reason", async () => {
    const result = await movePost({ postId, plazaId, reason: "Better suited to the Tavern" });

    expect(result).toEqual({ ok: true, targetId: postId });
    expect(mocks.rpc).toHaveBeenCalledWith("moderation_move_post", {
      p_post_id: postId,
      p_plaza_id: plazaId,
      p_reason: "Better suited to the Tavern",
    });
  });

  it("refuses a destination that is not a uuid", async () => {
    const result = await movePost({ postId, plazaId: "tavern", reason: "A reason" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports an archived destination as an invalid request, not a crash", async () => {
    rpcFails("22023");

    await expect(movePost({ postId, plazaId, reason: "A reason" })).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
    });
  });
});

describe("setCommentStatus", () => {
  it("sends the state it displayed", async () => {
    const result = await setCommentStatus({
      commentId,
      expectedStatus: "published",
      status: "hidden",
      reason: "Abusive reply",
    });

    expect(result).toEqual({ ok: true, targetId: commentId });
    expect(mocks.rpc).toHaveBeenCalledWith("moderation_set_comment_status", {
      p_comment_id: commentId,
      p_expected_status: "published",
      p_status: "hidden",
      p_reason: "Abusive reply",
    });
  });

  it("refuses deleted_by_author as a destination", async () => {
    const result = await setCommentStatus({
      commentId,
      expectedStatus: "published",
      status: "deleted_by_author",
      reason: "A reason",
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("setCommentFlags", () => {
  it("locks replies without touching the pin", async () => {
    await setCommentFlags({ commentId, reason: "Thread went off the rails", repliesLocked: true });

    expect(mocks.rpc).toHaveBeenCalledWith("moderation_set_comment_flags", {
      p_comment_id: commentId,
      p_reason: "Thread went off the rails",
      p_is_pinned: null,
      p_replies_locked: true,
    });
  });

  it("refuses a call that changes no flag at all", async () => {
    const result = await setCommentFlags({ commentId, reason: "Nothing to change" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("database failures", () => {
  it.each([
    ["42501", "access_denied"],
    ["P0002", "not_found"],
    ["40001", "conflict"],
    ["22023", "invalid_request"],
    ["XX000", "retry"],
  ])("maps %s to %s", async (dbCode, actionCode) => {
    rpcFails(dbCode);

    await expect(
      setPostStatus({ postId, expectedStatus: "published", status: "hidden", reason: "A reason" }),
    ).resolves.toMatchObject({ ok: false, code: actionCode });
  });

  it("never leaks the database message to the caller", async () => {
    rpcFails("42501");

    const result = await setPostStatus({
      postId,
      expectedStatus: "published",
      status: "hidden",
      reason: "A reason",
    });

    expect(JSON.stringify(result)).not.toContain("database said no");
  });

  it("treats a thrown client failure as a retry rather than crashing the panel", async () => {
    mocks.createClient.mockRejectedValue(new Error("no session"));

    await expect(
      setPostStatus({ postId, expectedStatus: "published", status: "hidden", reason: "A reason" }),
    ).resolves.toMatchObject({ ok: false, code: "retry" });
  });

  it("keeps the transition successful when cache revalidation throws", async () => {
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    await expect(
      setPostStatus({ postId, expectedStatus: "published", status: "hidden", reason: "A reason" }),
    ).resolves.toEqual({ ok: true, targetId: postId });
  });
});
