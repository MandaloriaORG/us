import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissions", () => ({ can: mocks.can }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

// Radix Checkbox sizes itself via ResizeObserver, which jsdom does not provide.
class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

import CouncilSettingsPage, { dynamic, metadata } from "./page";

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

function ok(data: unknown): RpcResult {
  return { data, error: null };
}

function failed(message: string): RpcResult {
  return { data: null, error: { message } };
}

function settingRow(overrides: Record<string, unknown> = {}) {
  return {
    description: "The community's name.",
    is_public: true,
    key: "site.name",
    max_value: null,
    min_value: null,
    updated_at: "2026-08-01T10:00:00.000Z",
    updated_by: "10000000-0000-4000-8000-000000000001",
    updated_by_display_name: "Council Steward",
    value: "Mandaloria",
    value_type: "string",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockResolvedValue({ allowed: true });
  mocks.rpc.mockResolvedValue(ok([]));
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("council settings page", () => {
  it("stays request-bound and refuses indexing", async () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("shows a denied state without creating a client when the caller lacks the permission", async () => {
    mocks.can.mockResolvedValue({ allowed: false, reason: "missing_permission" });

    const element = await CouncilSettingsPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByText("You do not have permission to manage site settings.")).toBeVisible();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws a generic error when authorization could not be verified", async () => {
    mocks.can.mockResolvedValue({ allowed: false, reason: "verification_failed" });

    await expect(CouncilSettingsPage()).rejects.toThrow(
      "Site settings authorization could not be verified",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("reads settings through the authenticated RPC and groups them into sections", async () => {
    mocks.rpc.mockResolvedValue(
      ok([
        settingRow(),
        settingRow({
          key: "site.description",
          value: "A community and free-knowledge network.",
        }),
        settingRow({ key: "theme.initial", value: "dark" }),
        settingRow({ key: "features.codex_public", value: true, value_type: "boolean" }),
      ]),
    );

    const element = await CouncilSettingsPage();
    render(element);

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("admin_get_site_settings");

    expect(screen.getByRole("heading", { name: "General" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Features" })).toBeVisible();
    expect(screen.getByText("Site name")).toBeVisible();
    expect(screen.getByText("Initial theme")).toBeVisible();
    expect(screen.getByLabelText("Public Codex")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(4);
  });

  it("sends unknown seeded keys to an Other section instead of hiding them", async () => {
    mocks.rpc.mockResolvedValue(
      ok([settingRow(), settingRow({ key: "newer.custom", value: "x", description: null })]),
    );

    const element = await CouncilSettingsPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Other" })).toBeVisible();
    expect(screen.getByLabelText("Newer custom")).toBeVisible();
  });

  it("drops rows that cannot be rendered safely", async () => {
    mocks.rpc.mockResolvedValue(
      ok([
        settingRow(),
        settingRow({ key: "Not A Key!" }),
        settingRow({ value_type: "string", value: { wrong: true } }),
        "garbage",
      ]),
    );

    const element = await CouncilSettingsPage();
    render(element);

    expect(screen.getByText("Site name")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
  });

  it("renders a sober empty state when nothing is configured", async () => {
    mocks.rpc.mockResolvedValue(ok([]));

    const element = await CouncilSettingsPage();
    render(element);

    expect(screen.getByRole("heading", { name: "No settings yet" })).toBeVisible();
  });

  it("throws a generic load error without exposing the RPC failure", async () => {
    mocks.rpc.mockResolvedValue(failed("secret database diagnostic"));

    const request = CouncilSettingsPage();

    await expect(request).rejects.toThrow("Site settings could not be loaded");
    await expect(request).rejects.not.toThrow("secret database diagnostic");
  });
});
