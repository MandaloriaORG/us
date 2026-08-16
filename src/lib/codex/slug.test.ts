import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "@/lib/codex/slug";

describe("slugify", () => {
  it("lowercases and hyphenates separators", () => {
    expect(slugify("The Way of the Mandalore")).toBe("the-way-of-the-mandalore");
  });

  it("strips accents and punctuation", () => {
    expect(slugify("¿Qué es la Verd'agra?")).toBe("qu-es-la-verd-agra");
  });

  it("collapses repeated separators and trims edges", () => {
    expect(slugify("  --hello   world--  ")).toBe("hello-world");
  });

  it("returns empty for separators only", () => {
    expect(slugify("---")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase hyphenated identifiers", () => {
    expect(isValidSlug("the-way")).toBe(true);
  });

  it("rejects uppercase, spaces, empty and oversized slugs", () => {
    expect(isValidSlug("The-Way")).toBe(false);
    expect(isValidSlug("the way")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("a".repeat(81))).toBe(false);
  });
});
