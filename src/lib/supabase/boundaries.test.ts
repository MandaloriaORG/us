import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverOnlyLoaded: vi.fn(),
  createSupabaseClient: vi.fn(),
  createBrowserClient: vi.fn(),
}));

vi.mock("server-only", () => {
  mocks.serverOnlyLoaded();
  return {};
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createSupabaseClient,
}));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

beforeEach(() => {
  mocks.createSupabaseClient.mockClear();
  mocks.createBrowserClient.mockClear();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
});

describe("Supabase client boundaries", () => {
  it("loads the admin client behind the server-only guard", () => {
    createAdminClient();
    expect(mocks.serverOnlyLoaded).toHaveBeenCalled();
  });

  it("uses the service credential only in the non-persistent admin client", () => {
    createAdminClient();
    expect(mocks.createSupabaseClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("uses only public configuration in the browser client", () => {
    createBrowserSupabaseClient();
    expect(mocks.createBrowserClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  });
});
