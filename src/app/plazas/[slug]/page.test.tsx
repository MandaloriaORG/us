import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPlaza: vi.fn(), listPosts: vi.fn(), notFound: vi.fn() }));

vi.mock("@/lib/content/queries", () => ({
  getPlaza: mocks.getPlaza,
  listPosts: mocks.listPosts,
  parsePostOrder: (value: string | undefined) => (value === "popular" ? "popular" : "recent"),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import PlazaPage from "./page";

const plaza = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "general",
  name: "General",
  description: "Talk about anything.",
  rules: "Be kind.\nNo spam.",
  status: "active" as const,
  visibility: "public" as const,
  posts_count: 2,
  can_post: false,
};

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    plaza_id: plaza.id,
    plaza_name: plaza.name,
    plaza_slug: plaza.slug,
    title: "Hello world",
    excerpt: "An excerpt",
    author_id: "40000000-0000-4000-8000-000000000001",
    author_display_name: "Ada",
    status: "published",
    is_pinned: false,
    is_highlighted: false,
    likes_count: 3,
    dislikes_count: 0,
    score: 3,
    comments_count: 5,
    created_at: "2026-07-23T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

async function renderPage(searchParams: Record<string, string | undefined> = {}) {
  const element = await PlazaPage({
    params: Promise.resolve({ slug: "general" }),
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

describe("PlazaPage", () => {
  it("404s when the Plaza is invisible to the caller", async () => {
    mocks.getPlaza.mockResolvedValue(null);
    await expect(
      PlazaPage({
        params: Promise.resolve({ slug: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("collapses the rules behind a disclosure that is closed by default", async () => {
    mocks.getPlaza.mockResolvedValue(plaza);
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage();

    const disclosure = screen.getByText("Plaza rules").closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Be kind.", { exact: false })).toBeInTheDocument();
  });

  it("marks the active order tab and links Recent/Popular as real navigation", async () => {
    mocks.getPlaza.mockResolvedValue(plaza);
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage({ order: "popular" });

    expect(screen.getByRole("link", { name: "Popular" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Recent" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Popular" })).toHaveAttribute(
      "href",
      "/plazas/general?order=popular",
    );
  });

  it("distinguishes no posts yet from a tag filter matching nothing, and offers to clear it", async () => {
    mocks.getPlaza.mockResolvedValue(plaza);
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage({ tag: "unicorns" });

    expect(screen.getByText("No posts carry that tag")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear tag filter" })).toHaveAttribute(
      "href",
      "/plazas/general",
    );
  });

  it("shows the plain empty state with no clear-filter link when there is no tag", async () => {
    mocks.getPlaza.mockResolvedValue(plaza);
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage();

    expect(screen.getByText("No posts yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear tag filter" })).not.toBeInTheDocument();
  });

  it("only renders the compose link when can_post is true", async () => {
    mocks.getPlaza.mockResolvedValue({ ...plaza, can_post: false });
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage();
    expect(screen.queryByRole("link", { name: "New post" })).not.toBeInTheDocument();

    mocks.getPlaza.mockResolvedValue({ ...plaza, can_post: true });
    await renderPage();
    expect(screen.getByRole("link", { name: "New post" })).toHaveAttribute(
      "href",
      "/plazas/general/new",
    );
  });

  it("renders a post row with title, author, comment count and score, numbers tabular", async () => {
    mocks.getPlaza.mockResolvedValue(plaza);
    mocks.listPosts.mockResolvedValue({ items: [post()], nextCursor: null });
    await renderPage();

    expect(screen.getByRole("link", { name: /Hello world/ })).toHaveAttribute(
      "href",
      `/posts/${post().id}`,
    );
    expect(screen.getByText("5 comments")).toHaveClass("tabular-nums");
    expect(screen.getByText("3 points")).toBeInTheDocument();
  });
});
