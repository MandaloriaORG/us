import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

import ProposePage from "./page";

const postId = "50000000-0000-4000-8000-000000000001";
const commentId = "60000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe("ProposePage", () => {
  it("redirects an anonymous visitor and keeps a post source on the return path", async () => {
    await expect(ProposePage({ searchParams: Promise.resolve({ post: postId }) })).rejects.toThrow(
      `NEXT_REDIRECT:/auth/login?next=${encodeURIComponent(`/codex/propose?post=${postId}`)}`,
    );
  });

  it("keeps a comment source on the return path", async () => {
    await expect(
      ProposePage({ searchParams: Promise.resolve({ comment: commentId }) }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/auth/login?next=${encodeURIComponent(`/codex/propose?comment=${commentId}`)}`,
    );
  });

  it("keeps an external source on the return path", async () => {
    const external = "https://example.com/article";
    await expect(ProposePage({ searchParams: Promise.resolve({ external }) })).rejects.toThrow(
      `NEXT_REDIRECT:/auth/login?next=${encodeURIComponent(
        `/codex/propose?external=${encodeURIComponent(external)}`,
      )}`,
    );
  });

  it("404s when a page offers more than one source", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });

    await expect(
      ProposePage({ searchParams: Promise.resolve({ post: postId, external: "https://x.test" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s on a malformed post source", async () => {
    await expect(
      ProposePage({ searchParams: Promise.resolve({ post: "not-a-uuid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
