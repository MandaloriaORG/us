import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  normalizeSearchRows,
  parseSearchFilters,
  SEARCH_MAX_PAGE,
  SEARCH_PAGE_SIZE,
  searchContent,
  searchHref,
  type SearchRow,
} from "@/lib/search";

const plazas = [
  { id: "10000000-0000-4000-8000-000000000001", name: "The Forge", slug: "the-forge" },
  { id: "10000000-0000-4000-8000-000000000002", name: "The Way", slug: "the-way" },
];

const validAuthor = "20000000-0000-4000-8000-00000000000a";
const invalidUuid = "not-a-uuid";

function baseRow(overrides: Record<string, unknown> = {}): SearchRow {
  return {
    author_display_name: "Obi-Wan",
    author_id: validAuthor,
    created_at: "2026-08-01T10:00:00.000Z",
    entity_id: "30000000-0000-4000-8000-00000000000a",
    entity_type: "post",
    excerpt: "A search excerpt.",
    plaza_id: plazas[0].id,
    plaza_slug: plazas[0].slug,
    title: "A post",
    ...overrides,
  } as SearchRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("parseSearchFilters", () => {
  it("is idle when no query is present", () => {
    expect(parseSearchFilters({})).toEqual({
      kind: "idle",
      values: { author: "", page: "", plaza: "", q: "", tag: "", type: "" },
    });
  });

  it("is idle when the query is only whitespace", () => {
    const result = parseSearchFilters({ q: "   " });
    expect(result.kind).toBe("idle");
  });

  it("builds a minimal database call from just a query", () => {
    const result = parseSearchFilters({ q: "beskar" });

    expect(result).toMatchObject({
      kind: "valid",
      page: 1,
      rpcArgs: {
        p_author_id: undefined,
        p_entity_type: undefined,
        p_limit: SEARCH_PAGE_SIZE + 1,
        p_offset: 0,
        p_plaza_id: undefined,
        p_query: "beskar",
        p_tag_slug: undefined,
      },
    });
  });

  it("rejects a query longer than 200 characters", () => {
    const result = parseSearchFilters({ q: "x".repeat(201) });

    expect(result).toMatchObject({ kind: "invalid", errors: { q: expect.any(String) } });
  });

  it("accepts the entity type filter", () => {
    const result = parseSearchFilters({ q: "beskar", type: "article" });

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.rpcArgs.p_entity_type).toBe("article");
    }
  });

  it("rejects an entity type outside the supported set", () => {
    const result = parseSearchFilters({ q: "beskar", type: "video" });

    expect(result).toMatchObject({ kind: "invalid", errors: { type: expect.any(String) } });
  });

  it("resolves a plaza slug to its id", () => {
    const result = parseSearchFilters({ q: "beskar", plaza: "the-way" }, plazas);

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.rpcArgs.p_plaza_id).toBe(plazas[1].id);
      expect(result.plazaSlug).toBe("the-way");
    }
  });

  it("rejects a plaza that is not visible to the caller", () => {
    const result = parseSearchFilters({ q: "beskar", plaza: "central-plaza" }, plazas);

    expect(result).toMatchObject({ kind: "invalid", errors: { plaza: expect.any(String) } });
  });

  it("normalises and accepts a tag slug", () => {
    const result = parseSearchFilters({ q: "beskar", tag: "Mandalorian-ARMOR " }, plazas);

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.rpcArgs.p_tag_slug).toBe("mandalorian-armor");
    }
  });

  it.each([
    ["a", "too short"],
    ["has space", "spaces"],
    ["trailing-", "trailing hyphen"],
  ])("rejects the tag %s (%s)", (tag) => {
    const result = parseSearchFilters({ q: "beskar", tag });

    expect(result).toMatchObject({ kind: "invalid", errors: { tag: expect.any(String) } });
  });

  it("normalises an uppercase tag to its stored lowercase slug", () => {
    const result = parseSearchFilters({ q: "beskar", tag: "UPper" }, plazas);

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.rpcArgs.p_tag_slug).toBe("upper");
    }
  });

  it("accepts a valid author id", () => {
    const result = parseSearchFilters({ q: "beskar", author: validAuthor.toUpperCase() }, plazas);

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.rpcArgs.p_author_id).toBe(validAuthor);
    }
  });

  it("rejects an author that is not a uuid", () => {
    const result = parseSearchFilters({ q: "beskar", author: invalidUuid }, plazas);

    expect(result).toMatchObject({ kind: "invalid", errors: { author: expect.any(String) } });
  });

  it.each([
    ["0", "zero"],
    ["-1", "negative"],
    ["abc", "non numeric"],
    [String(SEARCH_MAX_PAGE + 1), "beyond the ceiling"],
  ])("rejects the page %s (%s)", (page) => {
    const result = parseSearchFilters({ q: "beskar", page });

    expect(result).toMatchObject({ kind: "invalid", errors: { page: expect.any(String) } });
  });

  it("computes the offset from the page", () => {
    const result = parseSearchFilters({ q: "beskar", page: "3" }, plazas);

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.rpcArgs.p_offset).toBe(2 * SEARCH_PAGE_SIZE);
    }
  });

  it("keeps the canonical query stable across pages", () => {
    const result = parseSearchFilters(
      { q: "  beskar  ", type: "post", plaza: "the-forge", tag: "armor", author: validAuthor },
      plazas,
    );

    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.canonicalQuery).toContain("q=beskar");
      expect(result.canonicalQuery).toContain("type=post");
      expect(result.canonicalQuery).toContain("plaza=the-forge");
      expect(result.canonicalQuery).toContain("tag=armor");
      expect(result.canonicalQuery).toContain(`author=${validAuthor}`);
      expect(result.canonicalQuery).not.toContain("page=");
    }
  });

  it("collects every invalid filter at once", () => {
    const result = parseSearchFilters({ q: "beskar", type: "nope", author: "x" }, plazas);

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(Object.keys(result.errors).sort()).toEqual(["author", "type"]);
    }
  });
});

describe("searchHref", () => {
  it("omits the page on the first page", () => {
    expect(searchHref("q=beskar", 1)).toBe("/search?q=beskar");
  });

  it("adds the page from the second page on", () => {
    expect(searchHref("q=beskar", 2)).toBe("/search?q=beskar&page=2");
  });

  it("keeps an existing page param in sync", () => {
    expect(searchHref("q=beskar&page=5", 2)).toBe("/search?q=beskar&page=2");
  });

  it("renders a bare route when the query is empty", () => {
    expect(searchHref("", 1)).toBe("/search");
  });
});

describe("normalizeSearchRows", () => {
  it("drops malformed rows instead of letting them reach the page", () => {
    const rows = [
      baseRow(),
      baseRow({ entity_id: "not-a-uuid" }),
      baseRow({ title: "" }),
      baseRow({ title: "z".repeat(400) }),
      baseRow({ created_at: "yesterday" }),
      "garbage",
    ];

    const normalized = normalizeSearchRows(rows);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].title).toBe("A post");
  });

  it("keeps article rows that carry no plaza", () => {
    const rows = [baseRow({ entity_type: "article", plaza_id: null, plaza_slug: null })];

    const normalized = normalizeSearchRows(rows);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].plazaId).toBeNull();
    expect(normalized[0].plazaSlug).toBeNull();
  });

  it("bounds text lengths and fills a missing display name", () => {
    const rows = [
      baseRow({ author_display_name: "x".repeat(200), excerpt: "y".repeat(500) }),
      baseRow({ author_display_name: "" }),
    ];

    const normalized = normalizeSearchRows(rows);
    expect(normalized).toHaveLength(2);
    expect(normalized[0].authorDisplayName.length).toBeLessThanOrEqual(50);
    expect(normalized[0].excerpt).toBeNull();
    expect(normalized[1].authorDisplayName).toBe("Deleted member");
  });

  it("returns an empty array for a non-array value", () => {
    expect(normalizeSearchRows(null)).toEqual([]);
    expect(normalizeSearchRows({})).toEqual([]);
  });
});

describe("searchContent", () => {
  function validFilters(overrides: Record<string, unknown> = {}) {
    const parsed = parseSearchFilters({ q: "beskar", ...overrides }, plazas);
    if (parsed.kind !== "valid") throw new Error("expected valid filters");
    return parsed;
  }

  it("returns the normalized rows and flags the next page", async () => {
    const rows = Array.from({ length: SEARCH_PAGE_SIZE + 1 }, (_, index) =>
      baseRow({ entity_id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}` }),
    );
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const outcome = await searchContent(validFilters());

    expect(outcome.items).toHaveLength(SEARCH_PAGE_SIZE + 1);
    expect(outcome.hasNext).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("search_content", {
      p_author_id: undefined,
      p_entity_type: undefined,
      p_limit: SEARCH_PAGE_SIZE + 1,
      p_offset: 0,
      p_plaza_id: undefined,
      p_query: "beskar",
      p_tag_slug: undefined,
    });
  });

  it("reports the last page when fewer rows come back than requested", async () => {
    mocks.rpc.mockResolvedValue({ data: [baseRow()], error: null });

    const outcome = await searchContent(validFilters());

    expect(outcome.items).toHaveLength(1);
    expect(outcome.hasNext).toBe(false);
  });

  it("throws on a database error so the route can render its error state", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "bad query" } });

    await expect(searchContent(validFilters())).rejects.toThrow(
      "Search results could not be loaded",
    );
  });

  it("passes the filters through to the RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchContent(
      validFilters({
        type: "comment",
        plaza: "the-way",
        tag: "armor",
        author: validAuthor,
        page: "2",
      }),
    );

    expect(mocks.rpc).toHaveBeenCalledWith("search_content", {
      p_author_id: validAuthor,
      p_entity_type: "comment",
      p_limit: SEARCH_PAGE_SIZE + 1,
      p_offset: SEARCH_PAGE_SIZE,
      p_plaza_id: plazas[1].id,
      p_query: "beskar",
      p_tag_slug: "armor",
    });
  });
});
