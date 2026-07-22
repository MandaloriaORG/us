import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  forgotPassword,
  login,
  logout,
  register,
  resendVerification,
  resetPassword,
} from "@/lib/actions/auth";

type StatusResult = {
  data: { status: "active" | "banned" | "suspended" } | null;
  error: { message: string } | null;
};

let statusResult: StatusResult;

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function redirectError(path: string) {
  return new Error(`NEXT_REDIRECT:${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mandaloria.test");
  statusResult = { data: { status: "active" }, error: null };

  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(statusResult)),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);

  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.resend.mockResolvedValue({ data: {}, error: null });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  mocks.createClient.mockResolvedValue({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      resend: mocks.resend,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
    from: mocks.from,
  });
  mocks.redirect.mockImplementation((path: string) => {
    throw redirectError(path);
  });
});

describe("login", () => {
  it("validates fields before creating an Auth client", async () => {
    await expect(login(null, form({ email: "bad", password: "" }))).resolves.toEqual({
      fieldErrors: {
        email: "Enter a valid email address",
        password: "Enter your password",
      },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("signs in an active account and preserves a local destination", async () => {
    await expect(
      login(
        null,
        form({
          email: " member@example.com ",
          password: "correct horse",
          next: "/members?page=2",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/members?page=2");

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "member@example.com",
      password: "correct horse",
    });
    expect(mocks.from).toHaveBeenCalledWith("profiles");
  });

  it.each(["https://evil.example", "//evil.example"])(
    "does not redirect to the untrusted destination %s",
    async (next) => {
      await expect(
        login(null, form({ email: "member@example.com", password: "valid", next })),
      ).rejects.toThrow("NEXT_REDIRECT:/");
    },
  );

  it("returns a stable unverified-email state without leaking provider details", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: {
        code: "email_not_confirmed",
        message: "translated provider text",
        internal: "secret",
      },
    });

    await expect(
      login(null, form({ email: "member@example.com", password: "valid" })),
    ).resolves.toEqual({
      error: "Verify your email before signing in.",
      errorCode: "email_unverified",
    });
  });

  it("returns a generic invalid-credentials state", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials", message: "sensitive provider response" },
    });

    const result = await login(null, form({ email: "member@example.com", password: "wrong" }));
    expect(result).toEqual({
      error: "The email or password is incorrect.",
      errorCode: "invalid_credentials",
    });
    expect(JSON.stringify(result)).not.toContain("sensitive provider response");
  });

  it.each([
    [{ status: 429, message: "provider detail" }],
    [{ code: "over_request_rate_limit", message: "provider detail" }],
  ])("returns a stable rate-limit state", async (error) => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error });

    await expect(
      login(null, form({ email: "member@example.com", password: "valid" })),
    ).resolves.toEqual({
      error: "Too many sign-in attempts. Try again later.",
      errorCode: "rate_limited",
    });
  });

  it("does not misreport a provider outage as invalid credentials", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "unexpected_failure", message: "provider detail" },
    });

    await expect(
      login(null, form({ email: "member@example.com", password: "valid" })),
    ).resolves.toEqual({
      error: "Sign-in is temporarily unavailable. Try again.",
      errorCode: "verification_failed",
    });
  });

  it("keeps an unexpected provider failure local", async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error("network detail"));

    const result = await login(null, form({ email: "member@example.com", password: "valid" }));
    expect(result).toEqual({
      error: "Sign-in is temporarily unavailable. Try again.",
      errorCode: "verification_failed",
    });
    expect(JSON.stringify(result)).not.toContain("network detail");
  });

  it.each([
    ["suspended", "account_suspended"],
    ["banned", "account_banned"],
  ] as const)("clears the session for a %s account", async (status, errorCode) => {
    statusResult = { data: { status }, error: null };

    const result = await login(null, form({ email: "member@example.com", password: "valid" }));

    expect(result.errorCode).toBe(errorCode);
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("fails closed and clears the session when account status is unavailable", async () => {
    statusResult = { data: null, error: { message: "database unavailable" } };

    await expect(
      login(null, form({ email: "member@example.com", password: "valid" })),
    ).resolves.toMatchObject({ errorCode: "verification_failed" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});

describe("registration and verification", () => {
  it("registers validated metadata and sends the user to verification", async () => {
    await expect(
      register(
        null,
        form({
          displayName: "  Din   Djarin  ",
          email: "din@example.com",
          password: "password-123",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/auth/verify-email");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "din@example.com",
      password: "password-123",
      options: {
        emailRedirectTo: "https://mandaloria.test/auth/callback",
        data: { display_name: "Din Djarin" },
      },
    });
  });

  it("rejects unsupported registration names before creating an Auth client", async () => {
    await expect(
      register(
        null,
        form({
          displayName: "Din\nDjarin",
          email: "din@example.com",
          password: "password-123",
        }),
      ),
    ).resolves.toEqual({
      fieldErrors: { displayName: "Display name contains unsupported characters" },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("goes home when email confirmation is disabled and a session exists", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });

    await expect(
      register(
        null,
        form({
          displayName: "Din",
          email: "din@example.com",
          password: "password-123",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("resends verification without exposing whether the address exists", async () => {
    await expect(resendVerification(null, form({ email: "din@example.com" }))).resolves.toEqual({
      success: true,
    });
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "din@example.com",
      options: { emailRedirectTo: "https://mandaloria.test/auth/callback" },
    });
  });

  it("returns a stable resend failure", async () => {
    mocks.resend.mockResolvedValue({ data: null, error: { message: "provider detail" } });
    const result = await resendVerification(null, form({ email: "din@example.com" }));
    expect(result).toEqual({ error: "We could not send a new link. Try again later." });
    expect(JSON.stringify(result)).not.toContain("provider detail");
  });
});

describe("password recovery", () => {
  it("uses the dedicated reset route and a non-enumerating success state", async () => {
    await expect(forgotPassword(null, form({ email: "din@example.com" }))).resolves.toEqual({
      success: true,
    });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("din@example.com", {
      redirectTo: "https://mandaloria.test/auth/callback?next=/auth/reset-password",
    });
  });

  it("requires matching passwords", async () => {
    await expect(
      resetPassword(null, form({ password: "password-123", confirmPassword: "different-123" })),
    ).resolves.toEqual({
      fieldErrors: { confirmPassword: "Passwords do not match" },
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects an expired recovery session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "missing session" },
    });

    await expect(
      resetPassword(null, form({ password: "password-123", confirmPassword: "password-123" })),
    ).resolves.toMatchObject({ errorCode: "session_expired" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password for a verified recovery session", async () => {
    await expect(
      resetPassword(null, form({ password: "password-123", confirmPassword: "password-123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/auth/login?reason=password_updated");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "password-123" });
  });
});

describe("logout", () => {
  it("clears the Auth session before redirecting home", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    );
  });
});
