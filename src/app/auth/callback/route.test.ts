import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  });
});

describe("Auth callback", () => {
  it("rejects a callback without an authorization code", async () => {
    const response = await GET(new Request("https://mandaloria.test/auth/callback"));
    expect(response.headers.get("location")).toBe(
      "https://mandaloria.test/auth/login?reason=confirmation_failed",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("exchanges the code and follows a safe local destination", async () => {
    const response = await GET(
      new Request("https://mandaloria.test/auth/callback?code=valid&next=%2Fauth%2Freset-password"),
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe("https://mandaloria.test/auth/reset-password");
  });

  it("falls back home for an external destination", async () => {
    const response = await GET(
      new Request(
        "https://mandaloria.test/auth/callback?code=valid&next=https%3A%2F%2Fevil.example",
      ),
    );
    expect(response.headers.get("location")).toBe("https://mandaloria.test/");
  });

  it("does not expose an exchange error in the redirect", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: "sensitive provider detail" },
    });
    const response = await GET(new Request("https://mandaloria.test/auth/callback?code=expired"));
    const location = response.headers.get("location");
    expect(location).toBe("https://mandaloria.test/auth/login?reason=confirmation_failed");
    expect(location).not.toContain("sensitive provider detail");
  });

  it("uses the same safe redirect when the exchange throws", async () => {
    mocks.exchangeCodeForSession.mockRejectedValue(new Error("network detail"));
    const response = await GET(new Request("https://mandaloria.test/auth/callback?code=expired"));
    expect(response.headers.get("location")).toBe(
      "https://mandaloria.test/auth/login?reason=confirmation_failed",
    );
  });
});
