import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  getArticle,
  getProposal,
  listArticleVersions,
  listArticles,
  listOwnCodexBookmarks,
  moderationListCodexProposals,
  moderationListCodexSuggestions,
  resolveArticleProvenance,
} from "@/lib/codex/queries";

const articleId = "50000000-0000-4000-8000-000000000001";
const proposalId = "60000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function rpcReturns(data: unknown) {
  mocks.rpc.mockResolvedValue({ data, error: null });
}

function rpcFails() {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "gone" } });
}

const articleRow = {
  id: articleId,
  slug: "the-way",
  title: "The Way",
  excerpt: "Excerpt",
  category_slug: "culture",
  category_name: "Culture",
  author_id: "10000000-0000-4000-8000-000000000001",
  author_display_name: "Artorias",
  version: 3,
  published_at: "2026-08-01T10:00:00Z",
  created_at: "2026-08-01T10:00:00Z",
};

describe("listArticles", () => {
  it("returns an empty page when the database faults", async () => {
    rpcFails();
    const page = await listArticles();
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it("returns no cursor for a short page", async () => {
    rpcReturns([articleRow]);
    const page = await listArticles();
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("filters by a plain-text query over title and excerpt", async () => {
    rpcReturns([
      articleRow,
      { ...articleRow, id: "50000000-0000-4000-8000-000000000002", slug: "clans", title: "Clans" },
    ]);
    const page = await listArticles({ query: "way" });
    expect(page.items.map((item) => item.slug)).toEqual(["the-way"]);
  });

  it("passes the category filter and cursor to the RPC", async () => {
    rpcReturns([articleRow]);
    await listArticles({
      categorySlug: "culture",
      cursor: "2026-08-01T10:00:00Z~50000000-0000-4000-8000-000000000001",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "list_codex_articles",
      expect.objectContaining({
        p_category_slug: "culture",
        p_cursor_created_at: "2026-08-01T10:00:00Z",
        p_cursor_id: "50000000-0000-4000-8000-000000000001",
      }),
    );
  });
});

describe("getArticle", () => {
  it("returns the first row", async () => {
    rpcReturns([articleRow]);
    const article = await getArticle("the-way");
    expect(article?.id).toBe(articleId);
  });

  it("returns null when the RPC raises", async () => {
    rpcFails();
    expect(await getArticle("the-way")).toBeNull();
  });
});

describe("listArticleVersions", () => {
  it("shapes version rows", async () => {
    rpcReturns([
      {
        version_id: "70000000-0000-4000-8000-000000000001",
        seq: 3,
        version: 3,
        title: "The Way",
        body: "Body",
        change_summary: null,
        editor_id: null,
        editor_display_name: null,
        created_at: "2026-08-01T10:00:00Z",
      },
    ]);
    const versions = await listArticleVersions(articleId);
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(3);
    expect(versions[0].change_summary).toBeNull();
  });
});

describe("listOwnCodexBookmarks", () => {
  it("paginates on (bookmarked_at, bookmark_id)", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      article_id: articleId,
      slug: "the-way",
      title: "The Way",
      category_slug: "culture",
      author_display_name: "Artorias",
      bookmarked_at: `2026-08-01T10:00:${String(i).padStart(2, "0")}Z`,
      bookmark_id: `70000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    rpcReturns(rows);
    const page = await listOwnCodexBookmarks({ pageSize: 25 });
    expect(page.items).toHaveLength(25);
    expect(page.nextCursor).toMatch(/^2026-08-01T10:00:24Z~/);
  });
});

describe("moderation queues", () => {
  it("defaults the suggestion queue to open", async () => {
    rpcReturns([
      {
        suggestion_id: "70000000-0000-4000-8000-000000000001",
        article_id: articleId,
        article_slug: "the-way",
        article_title: "The Way",
        suggester_id: "10000000-0000-4000-8000-000000000001",
        suggester_display_name: "Artorias",
        body: "The article says…",
        status: "open",
        created_at: "2026-08-01T10:00:00Z",
      },
    ]);
    const page = await moderationListCodexSuggestions();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "moderation_list_codex_suggestions",
      expect.objectContaining({ p_status: "open" }),
    );
    expect(page.items[0].status).toBe("open");
  });

  it("defaults the proposal queue to proposed", async () => {
    rpcReturns([
      {
        proposal_id: proposalId,
        status: "proposed",
        reason: "A long enough reason to distill this conversation",
        proposer_id: "10000000-0000-4000-8000-000000000001",
        proposer_display_name: "Artorias",
        assignee_id: null,
        assignee_display_name: null,
        source_count: 1,
        created_at: "2026-08-01T10:00:00Z",
      },
    ]);
    const page = await moderationListCodexProposals();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "moderation_list_codex_proposals",
      expect.objectContaining({ p_status: "proposed" }),
    );
    expect(page.items[0].proposal_id).toBe(proposalId);
  });
});

describe("getProposal", () => {
  it("returns null when the RPC raises", async () => {
    rpcFails();
    expect(await getProposal(proposalId)).toBeNull();
  });
});

describe("resolveArticleProvenance", () => {
  it("returns null for a viewer with no role path", async () => {
    expect(await resolveArticleProvenance(articleId, { userId: null, canEdit: false })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("resolves a proposal directly for its proposer", async () => {
    rpcReturns([
      {
        proposal_id: proposalId,
        status: "published",
        reason: "A long enough reason to distill this conversation",
        working_title: "The Way",
        article_id: articleId,
        article_slug: "the-way",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
      },
    ]);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "list_own_codex_proposals") {
        return { data: [proposalRow()], error: null };
      }
      if (name === "get_codex_proposal") return { data: [detailRow()], error: null };
      if (name === "list_codex_proposal_sources") return { data: [], error: null };
      if (name === "list_codex_proposal_contributors") return { data: [], error: null };
      return { data: [], error: null };
    });

    const provenance = await resolveArticleProvenance(articleId, {
      userId: "10000000-0000-4000-8000-000000000001",
      canEdit: false,
    });

    expect(provenance).toHaveLength(1);
    expect(provenance?.[0].proposal.proposal_id).toBe(proposalId);
  });

  it("stays null when an archivist finds no published proposal for the article", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "moderation_list_codex_proposals") {
        return {
          data: [
            {
              proposal_id: proposalId,
              status: "published",
              reason: "A long enough reason",
              proposer_id: "10000000-0000-4000-8000-000000000001",
              proposer_display_name: "Artorias",
              assignee_id: null,
              assignee_display_name: null,
              source_count: 1,
              created_at: "2026-08-01T10:00:00Z",
            },
          ],
          error: null,
        };
      }
      if (name === "get_codex_proposal") {
        return {
          data: [{ ...detailRow(), article_id: "50000000-0000-4000-8000-000000000099" }],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const provenance = await resolveArticleProvenance(articleId, {
      userId: null,
      canEdit: true,
    });

    expect(provenance).toBeNull();
  });
});

function proposalRow() {
  return {
    proposal_id: proposalId,
    status: "published",
    reason: "A long enough reason to distill this conversation",
    working_title: "The Way",
    article_id: articleId,
    article_slug: "the-way",
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
  };
}

function detailRow() {
  return {
    proposal_id: proposalId,
    status: "published",
    reason: "A long enough reason to distill this conversation",
    working_title: "The Way",
    proposer_id: "10000000-0000-4000-8000-000000000001",
    proposer_display_name: "Artorias",
    assignee_id: null,
    assignee_display_name: null,
    article_id: articleId,
    article_slug: "the-way",
    replaced_by: null,
    source_count: 1,
    contributor_count: 1,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    can_edit: false,
  };
}
