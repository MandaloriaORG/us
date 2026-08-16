import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  getArticle: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/codex/queries", () => ({ getArticle: mocks.getArticle }));

import {
  addProposalSource,
  assignProposal,
  createArticle,
  createProposal,
  createSuggestion,
  publishArticle,
  publishProposalWithArticle,
  removeProposalSource,
  replaceProposal,
  restoreArticleVersion,
  reviewSuggestion,
  setArticleStatus,
  setProposalContributorStatus,
  toggleBookmark,
  updateArticle,
  updateProposalStatus,
  upsertProposalContributor,
} from "@/lib/actions/codex";

const articleId = "50000000-0000-4000-8000-000000000001";
const proposalId = "60000000-0000-4000-8000-000000000001";
const sourceId = "70000000-0000-4000-8000-000000000001";

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

describe("createArticle", () => {
  it("creates a draft and resolves the slug from the title when omitted", async () => {
    rpcReturns([{ article_id: articleId }]);

    const result = await createArticle({
      categorySlug: "culture",
      title: "The Way",
      body: "Body text",
    });

    expect(result).toEqual({ ok: true, articleId, slug: "the-way" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_codex_article", {
      p_category_slug: "culture",
      p_title: "The Way",
      p_body: "Body text",
      p_excerpt: undefined,
      p_slug: "the-way",
    });
  });

  it("rejects a duplicate slug as already_exists", async () => {
    rpcFails("23505");
    const result = await createArticle({
      categorySlug: "culture",
      title: "The Way",
      body: "Body text",
      slug: "the-way",
    });
    expect(result).toMatchObject({ ok: false, code: "already_exists" });
  });

  it("reports validation without calling the database", async () => {
    const result = await createArticle({ categorySlug: "culture", title: "no", body: "" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("updateArticle", () => {
  it("passes the change summary through", async () => {
    rpcReturns([]);
    const result = await updateArticle({
      articleId,
      slug: "the-way",
      title: "The Way",
      body: "New body",
      changeSummary: "Clarified the vow",
    });
    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("update_codex_article", {
      p_article_id: articleId,
      p_title: "The Way",
      p_body: "New body",
      p_excerpt: undefined,
      p_change_summary: "Clarified the vow",
    });
  });

  it("maps a stale CAS to the stale code", async () => {
    rpcFails("40001");
    const result = await updateArticle({
      articleId,
      slug: "the-way",
      title: "The Way",
      body: "New body",
    });
    expect(result).toMatchObject({ ok: false, code: "stale" });
  });
});

describe("article status transitions", () => {
  it("publishes through publish_codex_article", async () => {
    rpcReturns([]);
    const result = await publishArticle({
      articleId,
      slug: "the-way",
      expectedStatus: "draft",
    });
    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_codex_article", {
      p_article_id: articleId,
      p_expected_status: "draft",
      p_change_summary: undefined,
    });
  });

  it("unpublishes through set_codex_article_status with a reason", async () => {
    rpcReturns([]);
    const result = await setArticleStatus({
      articleId,
      slug: "the-way",
      expectedStatus: "published",
      status: "unpublished",
      reason: "Needs a factual correction",
    });
    expect(result).toEqual({ ok: true, status: "unpublished" });
    expect(mocks.rpc).toHaveBeenCalledWith("set_codex_article_status", {
      p_article_id: articleId,
      p_expected_status: "published",
      p_status: "unpublished",
      p_reason: "Needs a factual correction",
    });
  });

  it("requires a reason for a status change", async () => {
    const result = await setArticleStatus({
      articleId,
      slug: "the-way",
      expectedStatus: "published",
      status: "archived",
      reason: "",
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("restores a version with a reason", async () => {
    rpcReturns([{ article_id: articleId, version: 4 }]);
    const result = await restoreArticleVersion({
      articleId,
      slug: "the-way",
      version: 2,
      reason: "The older wording was accurate",
    });
    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("restore_codex_version", {
      p_article_id: articleId,
      p_version: 2,
      p_reason: "The older wording was accurate",
    });
  });
});

describe("toggleBookmark", () => {
  it("returns the new bookmarked state", async () => {
    rpcReturns([{ bookmarked: true }]);
    const result = await toggleBookmark(articleId);
    expect(result).toEqual({ ok: true, bookmarked: true });
    expect(mocks.rpc).toHaveBeenCalledWith("toggle_codex_bookmark", { p_article_id: articleId });
  });
});

describe("suggestions", () => {
  it("creates a suggestion on a published article", async () => {
    rpcReturns([{ suggestion_id: sourceId }]);
    const result = await createSuggestion({
      articleId,
      body: "The third paragraph repeats the first.",
    });
    expect(result).toEqual({ ok: true, suggestionId: sourceId });
  });

  it("rejects a suggestion shorter than 10 characters", async () => {
    const result = await createSuggestion({ articleId, body: "too short" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("reviews a suggestion with compare-and-swap", async () => {
    rpcReturns([]);
    const result = await reviewSuggestion({
      suggestionId: sourceId,
      expectedStatus: "open",
      status: "accepted",
      reviewNote: "Accurate, incorporated",
    });
    expect(result).toEqual({ ok: true, status: "accepted" });
    expect(mocks.rpc).toHaveBeenCalledWith("review_codex_suggestion", {
      p_suggestion_id: sourceId,
      p_expected_status: "open",
      p_status: "accepted",
      p_review_note: "Accurate, incorporated",
    });
  });
});

describe("proposals", () => {
  it("creates a proposal from a post source", async () => {
    rpcReturns([{ proposal_id: proposalId }]);
    const result = await createProposal({
      reason: "This conversation explains the vows in a way worth preserving.",
      workingTitle: "The Vows",
      source: { postId: articleId },
    });
    expect(result).toEqual({ ok: true, proposalId });
    expect(mocks.rpc).toHaveBeenCalledWith("create_codex_proposal", {
      p_reason: "This conversation explains the vows in a way worth preserving.",
      p_working_title: "The Vows",
      p_post_id: articleId,
      p_comment_id: undefined,
      p_external_url: undefined,
    });
  });

  it("creates a proposal from an external url", async () => {
    rpcReturns([{ proposal_id: proposalId }]);
    const result = await createProposal({
      reason: "This external article documents the founding of the clans.",
      source: { externalUrl: "https://example.org/founding" },
    });
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_codex_proposal",
      expect.objectContaining({ p_external_url: "https://example.org/founding" }),
    );
  });

  it("requires a reason of at least 20 characters", async () => {
    const result = await createProposal({
      reason: "Too brief",
      source: { postId: articleId },
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("adds a source to an open proposal", async () => {
    rpcReturns([{ source_id: sourceId }]);
    const result = await addProposalSource({
      proposalId,
      source: { commentId: articleId },
      note: "The reply that names the tradition",
    });
    expect(result).toEqual({ ok: true, sourceId });
    expect(mocks.rpc).toHaveBeenCalledWith("add_codex_proposal_source", {
      p_proposal_id: proposalId,
      p_source_type: "comment",
      p_post_id: undefined,
      p_comment_id: articleId,
      p_external_url: undefined,
      p_note: "The reply that names the tradition",
    });
  });

  it("maps rate limiting to the rate_limited code", async () => {
    rpcFails("53400");
    const result = await createProposal({
      reason: "This conversation explains the vows in a way worth preserving.",
      source: { postId: articleId },
    });
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("transitions proposal status with compare-and-swap", async () => {
    rpcReturns([]);
    const result = await updateProposalStatus({
      proposalId,
      expectedStatus: "proposed",
      status: "classified",
    });
    expect(result).toEqual({ ok: true, status: "classified" });
    expect(mocks.rpc).toHaveBeenCalledWith("update_codex_proposal_status", {
      p_proposal_id: proposalId,
      p_expected_status: "proposed",
      p_status: "classified",
      p_reason: undefined,
    });
  });

  it("publishes a proposal after resolving the article slug", async () => {
    rpcReturns([]);
    mocks.getArticle.mockResolvedValue({ id: articleId, slug: "the-vows" });

    const result = await publishProposalWithArticle({
      proposalId,
      expectedStatus: "reviewed",
      articleSlug: "the-vows",
    });

    expect(result).toEqual({ ok: true, status: "published" });
    expect(mocks.rpc).toHaveBeenCalledWith("update_codex_proposal_status", {
      p_proposal_id: proposalId,
      p_expected_status: "reviewed",
      p_status: "published",
      p_article_id: articleId,
    });
  });

  it("refuses to publish a proposal whose article cannot be read", async () => {
    mocks.getArticle.mockResolvedValue(null);
    const result = await publishProposalWithArticle({
      proposalId,
      expectedStatus: "reviewed",
      articleSlug: "the-vows",
    });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("proposal work actions", () => {
  it("assigns an Archivist with a reason", async () => {
    rpcReturns([]);
    const assigneeId = "10000000-0000-4000-8000-000000000099";
    const result = await assignProposal({
      proposalId,
      assigneeId,
      reason: "The most familiar with this clan",
    });
    expect(result).toEqual({ ok: true, assigneeId });
    expect(mocks.rpc).toHaveBeenCalledWith("assign_codex_proposal", {
      p_proposal_id: proposalId,
      p_assignee_id: assigneeId,
      p_reason: "The most familiar with this clan",
    });
  });

  it("removes a source from an open proposal", async () => {
    rpcReturns([{ source_id: sourceId }]);
    const result = await removeProposalSource({ proposalId, sourceId });
    expect(result).toEqual({ ok: true, sourceId });
    expect(mocks.rpc).toHaveBeenCalledWith("remove_codex_proposal_source", {
      p_proposal_id: proposalId,
      p_source_id: sourceId,
    });
  });

  it("upserts a contributor, anonymous by default", async () => {
    rpcReturns([{ contributor_id: sourceId }]);
    const result = await upsertProposalContributor({
      proposalId,
      memberId: articleId,
      contributionType: "evidence",
    });
    expect(result).toEqual({ ok: true, contributorId: sourceId });
    expect(mocks.rpc).toHaveBeenCalledWith("upsert_codex_proposal_contributor", {
      p_proposal_id: proposalId,
      p_member_id: articleId,
      p_contribution_type: "evidence",
      p_attribution: "public",
      p_evidence_ref: undefined,
    });
  });

  it("confirms a contributor through the compare-and-swap RPC", async () => {
    rpcReturns([]);
    const result = await setProposalContributorStatus({
      proposalId,
      memberId: articleId,
      expectedStatus: "proposed",
      status: "confirmed",
      reason: "Verified in the thread",
    });
    expect(result).toEqual({ ok: true, status: "confirmed" });
    expect(mocks.rpc).toHaveBeenCalledWith("set_codex_proposal_contributor_status", {
      p_proposal_id: proposalId,
      p_member_id: articleId,
      p_expected_status: "proposed",
      p_status: "confirmed",
      p_reason: "Verified in the thread",
    });
  });

  it("replaces a published proposal with a successor", async () => {
    rpcReturns([]);
    const successorId = "60000000-0000-4000-8000-000000000002";
    const result = await replaceProposal({
      proposalId,
      replacedBy: successorId,
      reason: "Superseded by a newer distillation",
    });
    expect(result).toEqual({ ok: true, replacedBy: successorId });
    expect(mocks.rpc).toHaveBeenCalledWith("replace_codex_proposal", {
      p_proposal_id: proposalId,
      p_replaced_by: successorId,
      p_reason: "Superseded by a newer distillation",
    });
  });
});

describe("error mapping", () => {
  it.each([
    ["42501", "access_denied"],
    ["P0002", "not_found"],
    ["22023", "invalid_request"],
    ["40001", "stale"],
    ["23505", "already_exists"],
  ] as const)("maps %s to %s", async (code, expected) => {
    rpcFails(code);
    const result = await updateArticle({
      articleId,
      slug: "the-way",
      title: "The Way",
      body: "Body",
    });
    expect(result).toMatchObject({ ok: false, code: expected });
  });

  it("degrades unknown database codes to retry", async () => {
    rpcFails("54000");
    const result = await updateArticle({
      articleId,
      slug: "the-way",
      title: "The Way",
      body: "Body",
    });
    expect(result).toMatchObject({ ok: false, code: "retry" });
  });
});
