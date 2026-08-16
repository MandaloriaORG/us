import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getArticle: vi.fn(),
  listArticles: vi.fn(),
  listCodexCategories: vi.fn(),
  resolveArticleProvenance: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/codex/queries", () => ({
  getArticle: mocks.getArticle,
  listArticles: mocks.listArticles,
  listCodexCategories: mocks.listCodexCategories,
  resolveArticleProvenance: mocks.resolveArticleProvenance,
}));

vi.mock("@/lib/actions/codex", () => ({
  createSuggestion: vi.fn(),
  toggleBookmark: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  usePathname: () => "/codex",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CodexLibraryPage from "./page";
import ArticlePage from "./[slug]/page";

const articleId = "50000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

function category() {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    slug: "culture",
    name: "Culture",
    description: null,
    sort_order: 1,
  };
}

function article() {
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

describe("codex library home", () => {
  it("renders the library with articles and category chips", async () => {
    mocks.listArticles.mockResolvedValue({ items: [article()], nextCursor: null });
    mocks.listCodexCategories.mockResolvedValue([category()]);

    const page = await CodexLibraryPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByRole("heading", { name: "Codex Libre" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "The Way" })).toHaveAttribute("href", "/codex/the-way");
    expect(screen.getByRole("link", { name: "Culture" })).toBeTruthy();
    expect(screen.queryByText(/The library is empty/)).toBeNull();
  });

  it("renders a specific empty state for a filtered search", async () => {
    mocks.listArticles.mockResolvedValue({ items: [], nextCursor: null });
    mocks.listCodexCategories.mockResolvedValue([category()]);

    const page = await CodexLibraryPage({ searchParams: Promise.resolve({ q: "zzz" }) });
    render(page);

    expect(screen.getByText("Nothing matches this search")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Clear filters" })).toBeTruthy();
  });

  it("passes the query and category to the listing", async () => {
    mocks.listArticles.mockResolvedValue({ items: [article()], nextCursor: null });
    mocks.listCodexCategories.mockResolvedValue([category()]);

    await CodexLibraryPage({ searchParams: Promise.resolve({ q: "way", category: "culture" }) });

    expect(mocks.listArticles).toHaveBeenCalledWith({
      categorySlug: "culture",
      query: "way",
      cursor: null,
    });
  });
});

describe("codex article detail", () => {
  function detail(overrides: Record<string, unknown> = {}) {
    return {
      id: articleId,
      slug: "the-way",
      title: "The Way",
      body: "# The Vow\n\nA **promise** keeps the clan.",
      excerpt: "A short summary",
      category_slug: "culture",
      category_name: "Culture",
      author_id: "10000000-0000-4000-8000-000000000001",
      author_display_name: "Artorias",
      status: "published",
      version: 3,
      published_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      caller_bookmarked: false,
      can_edit: false,
      can_publish: false,
      suggestion_count: 0,
      ...overrides,
    };
  }

  it("renders the sanitised Markdown body", async () => {
    mocks.getArticle.mockResolvedValue(detail());

    const page = await ArticlePage({ params: Promise.resolve({ slug: "the-way" }) });
    render(page);

    expect(screen.getByRole("heading", { name: "The Way" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The Vow" })).toBeTruthy();
    expect(screen.getByText("promise")).toBeTruthy();
    expect(screen.queryByText(/<script>/)).toBeNull();
  });

  it("404s when the article cannot be read", async () => {
    mocks.getArticle.mockResolvedValue(null);
    await expect(ArticlePage({ params: Promise.resolve({ slug: "gone" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("offers save and suggest to a signed-in reader of a public article", async () => {
    mocks.getArticle.mockResolvedValue(detail());
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    mocks.resolveArticleProvenance.mockResolvedValue(null);

    const page = await ArticlePage({ params: Promise.resolve({ slug: "the-way" }) });
    render(page);

    expect(screen.getByRole("button", { name: "Save article" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Suggest a correction/ })).toBeTruthy();
    expect(screen.queryByText("Provenance")).toBeNull();
  });

  it("shows provenance to an Archivist who can read the producing proposal", async () => {
    mocks.getArticle.mockResolvedValue(detail({ can_edit: true, status: "draft" }));
    mocks.resolveArticleProvenance.mockResolvedValue([
      {
        proposal: {
          proposal_id: "60000000-0000-4000-8000-000000000001",
          status: "published",
          working_title: "The Vows",
          proposer_display_name: "Artorias",
          assignee_display_name: "Bo-Katan",
          article_id: articleId,
          article_slug: "the-way",
        },
        sources: [],
        contributors: [],
      },
    ]);

    const page = await ArticlePage({ params: Promise.resolve({ slug: "the-way" }) });
    render(page);

    expect(screen.getByRole("heading", { name: "Provenance" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "The Vows" })).toBeTruthy();
    expect(screen.getByText(/Assigned to Bo-Katan/)).toBeTruthy();
  });
});
