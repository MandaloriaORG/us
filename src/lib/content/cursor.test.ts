import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/content/cursor";

const id = "16a35bf0-7616-4cec-ad37-de0d76c7cada";
const createdAt = "2026-07-23T10:15:30.123Z";

describe("content cursors", () => {
  it("round-trips a recency cursor", () => {
    const encoded = encodeCursor({ createdAt, id });
    expect(decodeCursor(encoded)).toEqual({ createdAt, id });
  });

  it("round-trips a popularity cursor including a negative score", () => {
    const encoded = encodeCursor({ createdAt, id, score: -12 });
    expect(decodeCursor(encoded)).toEqual({ createdAt, id, score: -12 });
  });

  it("keeps a zero score distinct from an absent one", () => {
    expect(decodeCursor(encodeCursor({ createdAt, id, score: 0 }))).toEqual({
      createdAt,
      id,
      score: 0,
    });
    expect(decodeCursor(encodeCursor({ createdAt, id }))).toEqual({ createdAt, id });
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["a non-uuid id", `${createdAt}~not-a-uuid`],
    ["an unparseable timestamp", `not-a-date~${id}`],
    ["a fractional score", `1.5~${createdAt}~${id}`],
    ["too many parts", `1~2~${createdAt}~${id}`],
    ["a single part", id],
    ["an overlong value", "x".repeat(200)],
  ])("rejects %s and falls back to the first page", (_label, value) => {
    expect(decodeCursor(value as string | null | undefined)).toBeNull();
  });

  it("does not treat a rejected cursor as an error", () => {
    expect(() => decodeCursor("garbage")).not.toThrow();
  });
});
