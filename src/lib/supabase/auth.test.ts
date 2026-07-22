import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteOrigin, readAccountStatus, safeRedirectPath } from "@/lib/supabase/auth";

describe("safeRedirectPath", () => {
  it.each([
    null,
    "",
    "https://evil.example/path",
    "//evil.example",
    "/\\\\evil.example",
    "javascript:alert(1)",
  ])("falls back for unsafe destination %s", (destination) => {
    expect(safeRedirectPath(destination)).toBe("/");
  });

  it("preserves a local path, query, and fragment", () => {
    expect(safeRedirectPath("/members?page=2#results")).toBe("/members?page=2#results");
  });
});

describe("getSiteOrigin", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("normalizes the configured application URL to its origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mandaloria.test/some/path");
    expect(getSiteOrigin()).toBe("https://mandaloria.test");
  });

  it.each(["not-a-url", "ftp://mandaloria.test", "https://user:pass@mandaloria.test"])(
    "rejects invalid public configuration %s",
    (configured) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", configured);
      expect(getSiteOrigin()).toBeNull();
    },
  );

  it("rejects an insecure public origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://mandaloria.test");
    expect(getSiteOrigin()).toBeNull();
  });
});

describe("readAccountStatus", () => {
  it("returns the server-owned status for the requested user", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { status: "active" },
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const client = { from: vi.fn().mockReturnValue(query) };

    await expect(readAccountStatus(client as never, "user-1")).resolves.toEqual({
      ok: true,
      status: "active",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it.each([[{ data: null, error: null }], [{ data: null, error: { message: "unavailable" } }]])(
    "fails closed when the profile cannot be verified",
    async (result) => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue(result),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      const client = { from: vi.fn().mockReturnValue(query) };

      await expect(readAccountStatus(client as never, "user-1")).resolves.toEqual({
        ok: false,
      });
    },
  );

  it("fails closed when the query throws", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockRejectedValue(new Error("network unavailable")),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const client = { from: vi.fn().mockReturnValue(query) };

    await expect(readAccountStatus(client as never, "user-1")).resolves.toEqual({
      ok: false,
    });
  });
});
