import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPost: vi.fn(), notFound: vi.fn() }));

vi.mock("@/lib/content/queries", () => ({ getPost: mocks.getPost }));
vi.mock("@/lib/actions/content", () => ({ createPost: vi.fn(), updatePost: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

import EditPostPage from "./page";

const postId = "20000000-0000-4000-8000-000000000001";

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: postId,
    title: "Hello world",
    body: "Some body",
    can_edit: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

describe("EditPostPage", () => {
  it("404s on a malformed post id", async () => {
    await expect(
      EditPostPage({ params: Promise.resolve({ postId: "not-a-uuid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when the post is invisible to the caller", async () => {
    mocks.getPost.mockResolvedValue(null);
    await expect(EditPostPage({ params: Promise.resolve({ postId }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("denies editing when can_edit is false, without exposing a form", async () => {
    mocks.getPost.mockResolvedValue(post({ can_edit: false }));
    const element = await EditPostPage({ params: Promise.resolve({ postId }) });
    render(element);

    expect(screen.getByText("You can't edit this post")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("pre-fills the form when can_edit is true", async () => {
    mocks.getPost.mockResolvedValue(post());
    const element = await EditPostPage({ params: Promise.resolve({ postId }) });
    render(element);

    expect(screen.getByLabelText(/Title/)).toHaveValue("Hello world");
    expect(screen.getByLabelText("Body")).toHaveValue("Some body");
  });
});
