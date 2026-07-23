import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPlaza: vi.fn(), notFound: vi.fn() }));

vi.mock("@/lib/content/queries", () => ({ getPlaza: mocks.getPlaza }));
vi.mock("@/lib/actions/content", () => ({ createPost: vi.fn(), updatePost: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

import NewPostPage from "./page";

const plaza = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "general",
  name: "General",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

describe("NewPostPage", () => {
  it("404s when the Plaza is invisible to the caller", async () => {
    mocks.getPlaza.mockResolvedValue(null);
    await expect(NewPostPage({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("shows a plain denial and no form when can_post is false", async () => {
    mocks.getPlaza.mockResolvedValue({ ...plaza, can_post: false });
    const element = await NewPostPage({ params: Promise.resolve({ slug: "general" }) });
    render(element);

    expect(screen.getByText("You can't post here")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to General" })).toHaveAttribute(
      "href",
      "/plazas/general",
    );
  });

  it("renders the compose form when can_post is true", async () => {
    mocks.getPlaza.mockResolvedValue({ ...plaza, can_post: true });
    const element = await NewPostPage({ params: Promise.resolve({ slug: "general" }) });
    render(element);

    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
  });
});
