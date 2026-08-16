import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  listPlazas: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/content/queries", () => ({ listPlazas: mocks.listPlazas }));

import SearchPage, { dynamic, metadata } from "./page";

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

interface RpcOperation {
  args: Record<string, unknown>;
  name: string;
}

const plazas = [
  { id: "10000000-0000-4000-8000-000000000001", name: "The Forge", slug: "the-forge" },
  { id: "10000000-0000-4000-8000-000000000002", name: "The Way", slug: "the-way" },
];

const authorId = "20000000-0000-4000-8000-00000000000a";
const rpcOperations: RpcOperation[] = [];
const rpcResults: RpcResult[] = [];

function ok(data: unknown): RpcResult {
  return { data, error: null };
}

function failed(message: string): RpcResult {
  return { data: null, error: { message } };
}

function searchRow(overrides: Record<string, unknown> = {}) {
  return {
    author_display_name: "Obi-Wan",
    author_id: authorId,
    created_at: "2026-08-01T10:00:00.000Z",
    entity_id: "30000000-0000-4000-8000-00000000000a",
    entity_type: "post",
    excerpt: "A searchable excerpt.",
    plaza_id: plazas[0].id,
    plaza_slug: plazas[0].slug,
    title: "A post",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcOperations.length = 0;
  rpcResults.length = 0;

  mocks.listPlazas.mockResolvedValue(plazas);
  mocks.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    rpcOperations.push({ args, name });
    return Promise.resolve(rpcResults.shift() ?? ok([]));
  });
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("search page", () => {
  it("stays request-bound and refuses indexing", async () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders the form and an idle hint without querying", async () => {
    const element = await SearchPage({ searchParams: {} });
    render(element);

    expect(screen.getByRole("heading", { name: "Search" })).toBeVisible();
    expect(screen.getByLabelText("Search")).toBeVisible();
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Search the community" })).toBeVisible();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves invalid filters, shows field errors, and never queries", async () => {
    const element = await SearchPage({
      searchParams: {
        author: "not-an-author",
        page: "0",
        q: "beskar",
        tag: "has space",
        type: "video",
      },
    });
    render(element);

    expect(screen.getByRole("heading", { name: "Check the search filters" })).toBeVisible();
    expect(screen.getByLabelText("Search")).toHaveValue("beskar");
    expect(screen.getByText("Choose posts, comments or articles.")).toBeVisible();
    expect(screen.getByText("Use lowercase words separated by hyphens.")).toBeVisible();
    expect(screen.getByText("Enter a valid author ID.")).toBeVisible();
    expect(screen.getByText(/Page: Enter a whole page number/)).toBeVisible();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the search RPC with normalized URL-backed filters", async () => {
    rpcResults.push(ok([searchRow()]));

    const element = await SearchPage({
      searchParams: {
        author: authorId.toUpperCase(),
        q: "  beskar  ",
        type: "post",
        plaza: "the-way",
        tag: "Mandalorian-ARMOR",
      },
    });
    render(element);

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(rpcOperations).toEqual([
      {
        name: "search_content",
        args: {
          p_author_id: authorId,
          p_entity_type: "post",
          p_limit: 21,
          p_offset: 0,
          p_plaza_id: plazas[1].id,
          p_query: "beskar",
          p_tag_slug: "mandalorian-armor",
        },
      },
    ]);
    expect(screen.getByRole("link", { name: "A post" })).toHaveAttribute(
      "href",
      "/posts/30000000-0000-4000-8000-00000000000a",
    );
  });

  it("renders post, comment and article rows with their own targets", async () => {
    rpcResults.push(
      ok([
        searchRow({ entity_type: "post" }),
        searchRow({
          entity_type: "comment",
          entity_id: "30000000-0000-4000-8000-00000000000b",
          title: "A post with comments",
        }),
        searchRow({
          entity_type: "article",
          entity_id: "30000000-0000-4000-8000-00000000000c",
          plaza_id: null,
          plaza_slug: null,
          title: "A codex article",
        }),
      ]),
    );

    const element = await SearchPage({ searchParams: { q: "beskar" } });
    render(element);

    expect(screen.getByRole("link", { name: "A post" })).toHaveAttribute(
      "href",
      "/posts/30000000-0000-4000-8000-00000000000a",
    );
    expect(screen.getByRole("link", { name: "A codex article" })).toHaveAttribute(
      "href",
      "/codex/30000000-0000-4000-8000-00000000000c",
    );
    expect(screen.getByText("A post with comments")).toBeVisible();
    expect(screen.getByRole("link", { name: "In The Forge" })).toHaveAttribute(
      "href",
      "/plazas/the-forge",
    );
  });

  it("offers the visible Plazas in the filter and resolves the chosen slug", async () => {
    rpcResults.push(ok([searchRow()]));

    const element = await SearchPage({ searchParams: { q: "beskar" } });
    render(element);

    expect(screen.getByLabelText("Plaza")).toBeVisible();
    expect(screen.getByRole("option", { name: "The Forge" })).toBeVisible();
    expect(screen.getByRole("option", { name: "The Way" })).toBeVisible();
  });

  it("renders a sober empty state when a valid search matches nothing", async () => {
    rpcResults.push(ok([]));

    const element = await SearchPage({ searchParams: { q: "nothing-here" } });
    render(element);

    expect(screen.getByRole("heading", { name: "No results for “nothing-here”" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("navigation", { name: "Search results pagination" })).toBeNull();
  });

  it("offers a previous page when an out-of-range page comes back empty", async () => {
    rpcResults.push(ok([]));

    const element = await SearchPage({ searchParams: { q: "beskar", page: "4" } });
    render(element);

    expect(screen.getByRole("heading", { name: "No results on page 4" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/search?q=beskar&page=3",
    );
  });

  it("builds previous and next links that keep the filters", async () => {
    rpcResults.push(
      ok(
        Array.from({ length: 21 }, (_, index) =>
          searchRow({
            entity_id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          }),
        ),
      ),
    );

    const element = await SearchPage({ searchParams: { q: "beskar", page: "2", type: "post" } });
    render(element);

    expect(screen.getByText("Page 2")).toBeVisible();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/search?q=beskar&type=post",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/search?q=beskar&type=post&page=3",
    );
  });

  it("throws a generic load error without exposing the RPC failure", async () => {
    rpcResults.push(failed("secret database diagnostic"));

    const request = SearchPage({ searchParams: { q: "beskar" } });

    await expect(request).rejects.toThrow("Search results could not be loaded");
    await expect(request).rejects.not.toThrow("secret database diagnostic");
  });
});
