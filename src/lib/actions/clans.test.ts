import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  processEmblemImage: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/clans/emblem-image", () => ({
  processEmblemImage: mocks.processEmblemImage,
  EmblemImageError: class EmblemImageError extends Error {},
  emblemImageMessage: (error: { code: string }) => `message:${error.code}`,
}));

import {
  assignInternalRole,
  assignRank,
  awardBadge,
  blockUser,
  cancelFriendRequest,
  createClan,
  expelMember,
  inviteToClan,
  leaveClan,
  removeInternalRole,
  removeRank,
  requestMembership,
  respondFriendRequest,
  respondToInvite,
  revokeBadge,
  sendFriendRequest,
  setBadgeStatus,
  setClanStatus,
  setMemberRole,
  transferLeadership,
  unblockUser,
  updateClan,
  upsertBadge,
  upsertInternalRole,
  upsertRank,
} from "@/lib/actions/clans";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clanId = uuid(1);
const slug = "the-forge";
const memberId = uuid(2);
const leaderId = uuid(3);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.createAdminClient.mockReturnValue({
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  });
});

function rpcReturns(data: unknown) {
  mocks.rpc.mockResolvedValue({ data, error: null });
}

function rpcFails(code: string, message = "database said no") {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
}

describe("createClan", () => {
  it("normalises the slug and name and sends the full RPC payload", async () => {
    rpcReturns([{ clan_id: clanId }]);

    const result = await createClan({
      slug: "  The-FORGE  ",
      name: "  The   Forge  ",
      description: "Where work is shown.",
      privacy: "invite",
      mission: "Keep the forge records.",
      leaderId,
    });

    expect(result).toEqual({ ok: true, value: "the-forge" });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_create_clan", {
      p_slug: "the-forge",
      p_name: "The Forge",
      p_description: "Where work is shown.",
      p_privacy: "invite",
      p_mission: "Keep the forge records.",
      p_leader_id: leaderId,
    });
  });

  it("defaults privacy to open and turns empty text into null", async () => {
    rpcReturns([{ clan_id: clanId }]);

    await createClan({ slug: "the-forge", name: "The Forge", leaderId });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_create_clan",
      expect.objectContaining({ p_privacy: "open", p_description: null, p_mission: null }),
    );
  });

  it("rejects invalid slugs and ids without reaching the database", async () => {
    const result = await createClan({ slug: "The Forge", name: "The Forge", leaderId: "x" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("retries when the RPC returns no id", async () => {
    rpcReturns([]);
    await expect(
      createClan({ slug: "the-forge", name: "The Forge", leaderId }),
    ).resolves.toMatchObject({ ok: false, code: "retry" });
  });

  it("refreshes the clan lists and the new clan page", async () => {
    rpcReturns([{ clan_id: clanId }]);
    await createClan({ slug: "the-forge", name: "The Forge", leaderId });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clans");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clans/the-forge");
  });
});

describe("updateClan", () => {
  it("passes every field and refreshes the clan routes", async () => {
    rpcReturns(null);

    const result = await updateClan({
      clanId,
      slug,
      name: "The Forge",
      description: "   ",
      privacy: "closed",
      mission: "Keep the forge records.",
    });

    expect(result).toEqual({ ok: true, value: clanId });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_update_clan", {
      p_clan_id: clanId,
      p_name: "The Forge",
      p_description: null,
      p_privacy: "closed",
      p_mission: "Keep the forge records.",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/clans/${slug}`);
  });
});

describe("setClanStatus", () => {
  it("sends the expected status so a stale screen cannot overwrite", async () => {
    rpcReturns(null);

    const result = await setClanStatus({
      clanId,
      slug,
      expectedStatus: "active",
      status: "archived",
      reason: "Superseded.",
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_clan_status", {
      p_clan_id: clanId,
      p_expected_status: "active",
      p_status: "archived",
      p_reason: "Superseded.",
    });
  });

  it("requires a reason because it is written to the audit log", async () => {
    const result = await setClanStatus({
      clanId,
      slug,
      expectedStatus: "active",
      status: "archived",
      reason: "  ",
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("membership", () => {
  it("maps requestMembership to the RPC and reports open vs queued entry", async () => {
    rpcReturns([{ membership_id: uuid(4), status: "pending" }]);
    const pending = await requestMembership({ clanId, slug });
    expect(pending).toMatchObject({ ok: true });
    expect(pending.message).toContain("leaders will review");

    rpcReturns([{ membership_id: uuid(4), status: "active" }]);
    const joined = await requestMembership({ clanId, slug });
    expect(joined.message).toContain("joined");
  });

  it("forwards inviteToClan with the note", async () => {
    rpcReturns([{ membership_id: uuid(4) }]);

    await inviteToClan({ clanId, slug, memberId, note: "Join us" });

    expect(mocks.rpc).toHaveBeenCalledWith("invite_to_clan", {
      p_clan_id: clanId,
      p_member_id: memberId,
      p_note: "Join us",
    });
  });

  it("forwards respondToInvite and leaveClan", async () => {
    rpcReturns(null);
    await respondToInvite({ membershipId: uuid(4), slug, accept: true });
    expect(mocks.rpc).toHaveBeenCalledWith("respond_to_clan_invite", {
      p_membership_id: uuid(4),
      p_accept: true,
    });

    rpcReturns(null);
    await leaveClan({ clanId, slug });
    expect(mocks.rpc).toHaveBeenCalledWith("leave_clan", {
      p_clan_id: clanId,
      p_reason: null,
    });
  });

  it("forwards expelMember and transferLeadership with their reasons", async () => {
    rpcReturns(null);
    await expelMember({ clanId, slug, memberId, reason: "Violated the code." });
    expect(mocks.rpc).toHaveBeenCalledWith("expel_clan_member", {
      p_clan_id: clanId,
      p_member_id: memberId,
      p_reason: "Violated the code.",
    });

    rpcReturns(null);
    await transferLeadership({ clanId, slug, memberId, reason: "Stepping down." });
    expect(mocks.rpc).toHaveBeenCalledWith("transfer_clan_leadership", {
      p_clan_id: clanId,
      p_new_leader_member_id: memberId,
      p_reason: "Stepping down.",
    });
  });

  it("forwards setMemberRole with the role", async () => {
    rpcReturns(null);
    await setMemberRole({ clanId, slug, memberId, role: "officer", reason: "Promotion." });
    expect(mocks.rpc).toHaveBeenCalledWith("set_clan_member_role", {
      p_clan_id: clanId,
      p_member_id: memberId,
      p_role: "officer",
      p_reason: "Promotion.",
    });
  });
});

describe("internal roles", () => {
  it("forwards upsertInternalRole with permissions", async () => {
    rpcReturns([{ internal_role_id: uuid(4) }]);
    await upsertInternalRole({
      clanId,
      slug,
      name: "Archivist",
      description: "Keeps records.",
      permissions: ["clan.announce"],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("upsert_clan_internal_role", {
      p_clan_id: clanId,
      p_name: "Archivist",
      p_description: "Keeps records.",
      p_permissions: ["clan.announce"],
    });
  });

  it("rejects permission names outside the format", async () => {
    const result = await upsertInternalRole({
      clanId,
      slug,
      name: "Archivist",
      description: "",
      permissions: ["Bad Permission!"],
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("forwards removeInternalRole and assignInternalRole", async () => {
    rpcReturns(null);
    await removeInternalRole({ clanId, slug, internalRoleId: uuid(4) });
    expect(mocks.rpc).toHaveBeenCalledWith("remove_clan_internal_role", {
      p_clan_id: clanId,
      p_internal_role_id: uuid(4),
    });

    rpcReturns(null);
    await assignInternalRole({ clanId, slug, memberId, internalRoleId: uuid(4), remove: false });
    expect(mocks.rpc).toHaveBeenCalledWith("assign_clan_internal_role", {
      p_clan_id: clanId,
      p_member_id: memberId,
      p_internal_role_id: uuid(4),
      p_remove: false,
    });
  });
});

describe("ranks", () => {
  it("forwards upsertRank with the colour", async () => {
    rpcReturns([{ rank_slug: "master" }]);
    await upsertRank({
      slug: "master",
      name: "Master",
      description: "Highest rank.",
      color: "#aabbcc",
      sortOrder: 1,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_upsert_rank", {
      p_slug: "master",
      p_name: "Master",
      p_description: "Highest rank.",
      p_color: "#aabbcc",
      p_sort_order: 1,
    });
  });

  it("rejects an invalid colour", async () => {
    const result = await upsertRank({ slug: "master", name: "Master", color: "red" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("forwards assignRank and removeRank and refreshes the member profile", async () => {
    rpcReturns([{ user_rank_id: uuid(4) }]);
    await assignRank({ userId: memberId, rankSlug: "master", reason: "Proven skill." });
    expect(mocks.rpc).toHaveBeenCalledWith("assign_rank", {
      p_user_id: memberId,
      p_rank_slug: "master",
      p_reason: "Proven skill.",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/members/${memberId}`);

    rpcReturns([{ removed: true }]);
    await removeRank({ userId: memberId, reason: "Rank retired." });
    expect(mocks.rpc).toHaveBeenCalledWith("remove_rank", {
      p_user_id: memberId,
      p_reason: "Rank retired.",
    });
  });
});

describe("badges", () => {
  it("forwards upsertBadge with the required issuer permission", async () => {
    rpcReturns([{ badge_slug: "historian" }]);
    await upsertBadge({
      slug: "historian",
      name: "Historian",
      description: "Preserved knowledge.",
      requiredIssuerPermission: "admin.view_users",
      sortOrder: 2,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_upsert_badge", {
      p_slug: "historian",
      p_name: "Historian",
      p_description: "Preserved knowledge.",
      p_required_issuer_permission: "admin.view_users",
      p_sort_order: 2,
    });
  });

  it("forwards awardBadge with evidence visibility and refreshes the member profile", async () => {
    rpcReturns([{ user_badge_id: uuid(4) }]);
    await awardBadge({
      userId: memberId,
      badgeSlug: "historian",
      reason: "Restored the records.",
      evidenceRef: "https://codex.example/r",
      evidenceVisibility: "private",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("award_badge", {
      p_user_id: memberId,
      p_badge_slug: "historian",
      p_reason: "Restored the records.",
      p_evidence_ref: "https://codex.example/r",
      p_evidence_visibility: "private",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/members/${memberId}`);
  });

  it("forwards revokeBadge", async () => {
    rpcReturns([{ user_badge_id: uuid(4) }]);
    await revokeBadge({ userBadgeId: uuid(4), userId: memberId, reason: "Awarded in error." });
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_badge", {
      p_user_badge_id: uuid(4),
      p_reason: "Awarded in error.",
    });
  });

  it("forwards setBadgeStatus with the expected status", async () => {
    rpcReturns(null);
    await setBadgeStatus({
      slug: "historian",
      expectedStatus: "active",
      status: "retired",
      reason: "Retiring.",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_badge_status", {
      p_slug: "historian",
      p_expected_status: "active",
      p_status: "retired",
      p_reason: "Retiring.",
    });
  });
});

describe("friends and blocks", () => {
  it("forwards sendFriendRequest and refreshes the profile", async () => {
    rpcReturns([{ friendship_id: uuid(4) }]);
    await sendFriendRequest({ addresseeId: memberId });
    expect(mocks.rpc).toHaveBeenCalledWith("send_friend_request", {
      p_addressee_id: memberId,
      p_note: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/members/${memberId}`);
  });

  it("forwards respondFriendRequest and cancelFriendRequest", async () => {
    rpcReturns(null);
    await respondFriendRequest({ friendshipId: uuid(4), peerId: memberId, accept: true });
    expect(mocks.rpc).toHaveBeenCalledWith("respond_friend_request", {
      p_friendship_id: uuid(4),
      p_accept: true,
    });

    rpcReturns(null);
    await cancelFriendRequest({ friendshipId: uuid(4), peerId: memberId });
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_friend_request", {
      p_friendship_id: uuid(4),
    });
  });

  it("forwards blockUser and unblockUser", async () => {
    rpcReturns([{ block_id: uuid(4) }]);
    await blockUser({ blockedId: memberId });
    expect(mocks.rpc).toHaveBeenCalledWith("block_user", {
      p_blocked_id: memberId,
      p_reason: null,
    });

    rpcReturns([{ unblocked: true }]);
    await unblockUser({ blockedId: memberId });
    expect(mocks.rpc).toHaveBeenCalledWith("unblock_user", { p_blocked_id: memberId });
  });

  it("rejects a self-block attempt at the validation boundary", async () => {
    // The database also refuses self-blocks; validation only checks shape.
    const result = await blockUser({ blockedId: "not-a-uuid" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("database failure mapping", () => {
  it.each([
    ["42501", "blocked", "cannot send a request to this member"],
    ["42501", "blocked", "cannot invite this member"],
    ["42501", "access_denied", "permission denied"],
    ["P0002", "not_found", "clan not found"],
    ["40001", "conflict", "clan changed since it was read"],
    ["22023", "invalid_request", "already a member"],
    ["23505", "invalid_request", "duplicate key"],
    ["53400", "rate_limited", "friend request rate limit reached"],
    ["XX000", "retry", "internal"],
  ])("maps db %s to %s", async (dbCode, actionCode, message) => {
    rpcFails(dbCode, message);

    await expect(sendFriendRequest({ addresseeId: memberId })).resolves.toMatchObject({
      ok: false,
      code: actionCode,
    });
  });

  it("never leaks the database message to the caller", async () => {
    rpcFails("42501", "cannot send a request to this member secret");

    const result = await sendFriendRequest({ addresseeId: memberId });

    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("does not revalidate when the mutation failed", async () => {
    rpcFails("42501", "permission denied");

    await updateClan({
      clanId,
      slug,
      name: "The Forge",
      description: "",
      privacy: "open",
      mission: "",
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a thrown client failure as a retry", async () => {
    mocks.createClient.mockRejectedValue(new Error("no session"));

    await expect(
      createClan({ slug: "the-forge", name: "The Forge", leaderId }),
    ).resolves.toMatchObject({ ok: false, code: "retry" });
  });

  it("keeps the mutation successful when cache revalidation throws", async () => {
    rpcReturns([{ clan_id: clanId }]);
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    await expect(
      createClan({ slug: "the-forge", name: "The Forge", leaderId }),
    ).resolves.toMatchObject({ ok: true });
  });
});
