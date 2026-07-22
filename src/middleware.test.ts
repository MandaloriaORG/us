import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

import { middleware } from "@/middleware";

type CookieAdapter = {
  setAll: (cookies: Array<{ name: string; value: string; options?: { path: string } }>) => void;
};

let cookieAdapter: CookieAdapter;
let statusResult: {
  data: { status: "active" | "banned" | "suspended" } | null;
  error: { message: string } | null;
};

function request(path: string) {
  return new NextRequest(`https://mandaloria.test${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  statusResult = { data: { status: "active" }, error: null };
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });

  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(statusResult)),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.createServerClient.mockImplementation(
    (_url: string, _key: string, options: { cookies: CookieAdapter }) => {
      cookieAdapter = options.cookies;
      return {
        auth: { getUser: mocks.getUser, signOut: mocks.signOut },
        from: mocks.from,
      };
    },
  );
});

describe("session middleware", () => {
  it("redirects an anonymous protected request and preserves its local query", async () => {
    const response = await middleware(request("/profile/edit?section=identity"));
    expect(response.headers.get("location")).toBe(
      "https://mandaloria.test/auth/login?next=%2Fprofile%2Fedit%3Fsection%3Didentity",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("allows an active account through a protected route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const response = await middleware(request("/profile/edit"));
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.from).toHaveBeenCalledWith("profiles");
  });

  it("fails closed on a protected route when account status cannot be read", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    statusResult = { data: null, error: { message: "unavailable" } };

    const response = await middleware(request("/council"));
    expect(response.headers.get("location")).toBe(
      "https://mandaloria.test/auth/login?reason=session_unavailable&next=%2Fcouncil",
    );
  });

  it("fails closed when Auth session verification throws", async () => {
    mocks.getUser.mockRejectedValue(new Error("auth unavailable"));
    const response = await middleware(request("/profile/edit"));
    expect(response.headers.get("location")).toBe(
      "https://mandaloria.test/auth/login?reason=session_unavailable&next=%2Fprofile%2Fedit",
    );
  });

  it.each(["suspended", "banned"] as const)("clears a %s account session", async (status) => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    statusResult = { data: { status }, error: null };

    const response = await middleware(request("/members"));
    expect(response.headers.get("location")).toBe(
      `https://mandaloria.test/auth/login?reason=${status}`,
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("redirects an active signed-in user away from entry Auth pages", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const response = await middleware(request("/auth/login"));
    expect(response.headers.get("location")).toBe("https://mandaloria.test/");
  });

  it("keeps Auth entry reachable when an existing profile cannot be verified", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    statusResult = { data: null, error: { message: "unavailable" } };

    const response = await middleware(request("/auth/login"));
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.from).toHaveBeenCalledWith("profiles");
  });

  it("returns refreshed session cookies on the response", async () => {
    mocks.getUser.mockImplementation(async () => {
      cookieAdapter.setAll([{ name: "sb-session", value: "fresh", options: { path: "/" } }]);
      return { data: { user: null }, error: null };
    });

    const response = await middleware(request("/members"));
    expect(response.cookies.get("sb-session")?.value).toBe("fresh");
  });
});
