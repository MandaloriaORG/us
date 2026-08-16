import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCodexCouncilAccess: vi.fn(),
  getArticle: vi.fn(),
  listArticles: vi.fn(),
  listArticleVersions: vi.fn(),
  listCodexCategories: vi.fn(),
  moderationListCodexSuggestions: vi.fn(),
  parseSuggestionStatus: vi.fn(),
  moderationListCodexProposals: vi.fn(),
  parseProposalStatus: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/council/codex/codex-access", () => ({
  getCodexCouncilAccess: mocks.getCodexCouncilAccess,
}));

vi.mock("@/lib/codex/queries", () => ({
  getArticle: mocks.getArticle,
  listArticles: mocks.listArticles,
  listArticleVersions: mocks.listArticleVersions,
  listCodexCategories: mocks.listCodexCategories,
  moderationListCodexSuggestions: mocks.moderationListCodexSuggestions,
  parseSuggestionStatus: mocks.parseSuggestionStatus,
  moderationListCodexProposals: mocks.moderationListCodexProposals,
  parseProposalStatus: mocks.parseProposalStatus,
}));

vi.mock("@/lib/actions/codex", () => ({
  createArticle: vi.fn(),
  publishArticle: vi.fn(),
  restoreArticleVersion: vi.fn(),
  reviewSuggestion: vi.fn(),
  setArticleStatus: vi.fn(),
  setCategoryStatus: vi.fn(),
  updateArticle: vi.fn(),
  upsertCategory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  usePathname: () => "/council/codex",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CodexCouncilDashboard from "./page";
import EditArticlePage from "./[slug]/edit/page";
import SuggestionsQueuePage from "./suggestions/page";
import ProposalsQueuePage from "./proposals/page";

const articleId = "50000000-0000-4000-8000-000000000001";

function editorAccess(overrides: Record<string, unknown> = {}) {
  return {
    allowed: true,
    canEdit: true,
    canPublish: true,
    userId: "10000000-0000-4000-8000-000000000001",
    ...overrides,
  };
}

function articleSummary() {
  return {
    id: articleId,
    slug: "the-way",
    title: "The Way",
    excerpt: "A short summary",
    category_slug: "culture",
    category_name: "Culture",
    author_id: "10000000-0000-4000-8000-000000000001",
    author_display_name: "Artorias",
    version: 3,
    published_at: "2026-08-01T10:00:00Z",
    created_at: "2026-08-01T10:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCodexCouncilAccess.mockResolvedValue(editorAccess());
});

describe("council codex dashboard", () => {
  it("denies the dashboard to a caller without codex.edit", async () => {
    mocks.getCodexCouncilAccess.mockResolvedValue({ allowed: false, reason: "missing_permission" });

    const page = await CodexCouncilDashboard();
    render(page);

    expect(screen.getByText("Archivist access required")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "New article" })).toBeNull();
  });

  it("lists published articles and offers to create one", async () => {
    mocks.listArticles.mockResolvedValue({ items: [articleSummary()], nextCursor: null });
    mocks.listCodexCategories.mockResolvedValue([]);

    const page = await CodexCouncilDashboard();
    render(page);

    expect(screen.getByRole("link", { name: "New article" })).toHaveAttribute(
      "href",
      "/council/codex/new",
    );
    expect(screen.getByRole("link", { name: "The Way" })).toHaveAttribute(
      "href",
      "/council/codex/the-way/edit",
    );
    expect(screen.getByRole("link", { name: "Proposals" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Suggestions" })).toBeTruthy();
  });
});

describe("council codex editor", () => {
  function detail(overrides: Record<string, unknown> = {}) {
    return {
      id: articleId,
      slug: "the-way",
      title: "The Way",
      body: "Body text",
      excerpt: "A short summary",
      category_slug: "culture",
      category_name: "Culture",
      author_id: "10000000-0000-4000-8000-000000000001",
      author_display_name: "Artorias",
      status: "draft",
      version: 0,
      published_at: null,
      updated_at: "2026-08-01T10:00:00Z",
      caller_bookmarked: false,
      can_edit: true,
      can_publish: true,
      suggestion_count: 0,
      ...overrides,
    };
  }

  it("renders the editor fields and a publish action for a draft", async () => {
    mocks.getArticle.mockResolvedValue(detail());
    mocks.listArticleVersions.mockResolvedValue([]);

    const page = await EditArticlePage({ params: Promise.resolve({ slug: "the-way" }) });
    render(page);

    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText(/Body \(Markdown\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
  });

  it("offers unpublish, archive and lock for a published article", async () => {
    mocks.getArticle.mockResolvedValue(detail({ status: "published", version: 3 }));
    mocks.listArticleVersions.mockResolvedValue([]);

    const page = await EditArticlePage({ params: Promise.resolve({ slug: "the-way" }) });
    render(page);

    expect(screen.getByRole("button", { name: "Unpublish" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lock" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View published" })).toBeTruthy();
  });

  it("renders the version history with restore actions", async () => {
    mocks.getArticle.mockResolvedValue(detail({ status: "published", version: 3 }));
    mocks.listArticleVersions.mockResolvedValue([
      {
        version_id: "70000000-0000-4000-8000-000000000001",
        seq: 3,
        version: 3,
        title: "The Way",
        body: "Older body",
        change_summary: "Clarified the vow",
        editor_id: null,
        editor_display_name: "Artorias",
        created_at: "2026-07-01T10:00:00Z",
      },
    ]);

    const page = await EditArticlePage({ params: Promise.resolve({ slug: "the-way" }) });
    render(page);

    expect(screen.getByRole("heading", { name: "Version history" })).toBeTruthy();
    expect(screen.getByText(/Clarified the vow/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Restore this version/ })).toBeTruthy();
  });

  it("404s when the article cannot be read", async () => {
    mocks.getArticle.mockResolvedValue(null);
    await expect(EditArticlePage({ params: Promise.resolve({ slug: "gone" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("council codex suggestion queue", () => {
  it("lists open suggestions with a review action", async () => {
    mocks.parseSuggestionStatus.mockReturnValue("open");
    mocks.moderationListCodexSuggestions.mockResolvedValue({
      items: [
        {
          suggestion_id: "70000000-0000-4000-8000-000000000001",
          article_id: articleId,
          article_slug: "the-way",
          article_title: "The Way",
          suggester_id: "10000000-0000-4000-8000-000000000001",
          suggester_display_name: "Artorias",
          body: "The third paragraph repeats the first.",
          status: "open",
          created_at: "2026-08-01T10:00:00Z",
        },
      ],
      nextCursor: null,
    });

    const page = await SuggestionsQueuePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByRole("link", { name: "The Way" })).toBeTruthy();
    expect(screen.getByText(/repeats the first/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review" })).toBeTruthy();
  });
});

describe("council codex proposal queue", () => {
  it("lists proposals linking to their workbench", async () => {
    mocks.parseProposalStatus.mockReturnValue("proposed");
    mocks.moderationListCodexProposals.mockResolvedValue({
      items: [
        {
          proposal_id: "60000000-0000-4000-8000-000000000001",
          status: "proposed",
          reason: "This conversation explains the vows in a way worth preserving.",
          proposer_id: "10000000-0000-4000-8000-000000000001",
          proposer_display_name: "Artorias",
          assignee_id: null,
          assignee_display_name: null,
          source_count: 2,
          created_at: "2026-08-01T10:00:00Z",
        },
      ],
      nextCursor: null,
    });

    const page = await ProposalsQueuePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByRole("link", { name: /explains the vows/ })).toHaveAttribute(
      "href",
      "/codex/proposals/60000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByText("2 sources · unassigned")).toBeTruthy();
  });
});
