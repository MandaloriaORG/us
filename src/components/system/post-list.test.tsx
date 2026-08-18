import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PostList } from "./post-list";
import type { PostSummary } from "@/lib/content/queries";

function post(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    plaza_id: "10000000-0000-4000-8000-000000000001",
    plaza_name: "General",
    plaza_slug: "general",
    title: "Hello world",
    excerpt: "An excerpt",
    author_id: "40000000-0000-4000-8000-000000000001",
    author_display_name: "Ada",
    author_avatar_path: "",
    authorAvatarUrl: null,
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

describe("PostList", () => {
  it("renders nothing for an empty page, leaving the empty state to the caller", () => {
    const { container } = render(<PostList posts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a row with title, author, comment count and score, numbers tabular", () => {
    render(<PostList posts={[post()]} />);

    expect(screen.getByRole("link", { name: /Hello world/ })).toHaveAttribute(
      "href",
      `/posts/${post().id}`,
    );
    expect(screen.getByText("An excerpt")).toBeInTheDocument();
    expect(screen.getByText("5 comments")).toHaveClass("tabular-nums");
    expect(screen.getByText("3 points")).toBeInTheDocument();
  });

  it("omits the Plaza name by default and shows it when showPlazaName is set", () => {
    const { rerender } = render(<PostList posts={[post()]} />);
    expect(screen.queryByText("General", { exact: false })).not.toBeInTheDocument();

    rerender(<PostList posts={[post()]} showPlazaName />);
    expect(screen.getByText("General", { exact: false })).toBeInTheDocument();
  });

  it("renders a Next link only when nextHref is given", () => {
    const { rerender } = render(<PostList posts={[post()]} />);
    expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();

    rerender(<PostList posts={[post()]} nextHref="/plazas/general?cursor=abc" />);
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/plazas/general?cursor=abc",
    );
  });
});
