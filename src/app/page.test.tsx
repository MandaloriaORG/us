import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPosts: vi.fn() }));

vi.mock("@/lib/content/queries", () => ({ listPosts: mocks.listPosts }));

import HomePage from "./page";

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    plaza_id: "10000000-0000-4000-8000-000000000001",
    plaza_name: "General",
    plaza_slug: "general",
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
});

async function renderHome(searchParams: Record<string, string | undefined> = {}) {
  const element = await HomePage({ searchParams: Promise.resolve(searchParams) });
  return render(element);
}

describe("public landing page", () => {
  it("has one identity headline and two clear public actions", async () => {
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderHome();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Essential knowledge, kept free by the community.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Plazas/ })).toHaveAttribute("href", "/plazas");
    expect(screen.getByRole("link", { name: "Read Codex Libre" })).toHaveAttribute(
      "href",
      "/codex",
    );
  });

  it("states the Mandalorian philosophy plainly in a bordered principle list", async () => {
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderHome();

    expect(
      screen.getByRole("heading", { level: 2, name: "What Mandaloria stands for" }),
    ).toBeInTheDocument();

    const section = screen
      .getByRole("heading", { level: 2, name: "What Mandaloria stands for" })
      .closest("section");
    const titles = section ? within(section).getAllByRole("heading", { level: 3 }) : [];
    expect(titles.map((title) => title.textContent)).toEqual([
      "Knowledge stays free",
      "Community before tool",
      "Permanent knowledge",
      "Provenance",
      "Real responsibility",
      "Moderation from the start",
      "Freedom requires responsibility",
    ]);
  });

  it("uses the custom knowledge lifecycle as the hero proof", async () => {
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderHome();

    const pipeline = screen.getByRole("figure", { name: "Knowledge lifecycle" });
    const stages = within(pipeline).getAllByRole("listitem");

    expect(
      stages.map(
        (stage) => within(stage).getByText(/Conversation|Proposal|Review|Codex Libre/).textContent,
      ),
    ).toEqual(["Conversation", "Proposal", "Review", "Codex Libre"]);
    expect(stages[3]).not.toHaveAttribute("aria-current");
    expect(within(stages[3]).getByText("Destination")).toBeVisible();
  });

  it("links the four canonical participation areas without card-only navigation", async () => {
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderHome();

    const capabilitiesHeading = screen.getByRole("heading", {
      level: 2,
      name: "One network, four ways to participate",
    });
    expect(capabilitiesHeading).toBeInTheDocument();

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/plazas", "/codex", "/holochat", "/clans"]));
    const capabilitiesSection = capabilitiesHeading.closest("section");
    expect(capabilitiesSection?.querySelectorAll("ul > li")).toHaveLength(4);
  });

  it("calls listPosts for a cross-Plaza recent feed with the URL cursor", async () => {
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderHome({ cursor: "abc" });

    expect(mocks.listPosts).toHaveBeenCalledWith({ order: "recent", cursor: "abc" });
  });

  it("shows the empty state when no Plaza has any posts yet", async () => {
    mocks.listPosts.mockResolvedValue({ items: [], nextCursor: null });
    await renderHome();

    expect(screen.getByText("No posts yet")).toBeInTheDocument();
  });

  it("renders recent posts with their Plaza name and a Next link when there is another page", async () => {
    mocks.listPosts.mockResolvedValue({ items: [post()], nextCursor: "next-cursor" });
    await renderHome();

    expect(screen.getByRole("heading", { level: 2, name: "Recent posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hello world/ })).toHaveAttribute(
      "href",
      `/posts/${post().id}`,
    );
    expect(screen.getByText("General", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/?cursor=next-cursor",
    );
  });
});
