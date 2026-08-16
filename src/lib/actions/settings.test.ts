import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { updateSiteSetting } from "@/lib/actions/settings";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function rpcReturns(data: unknown) {
  mocks.rpc.mockResolvedValue({ data, error: null });
}

function rpcFails(code: string) {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "database said no" } });
}

const validStringUpdate = {
  key: "site.name",
  valueType: "string" as const,
  value: "Mandaloria",
  expectedValue: "Mandaloria",
};

describe("updateSiteSetting", () => {
  it("normalises the key and sends every field to the RPC", async () => {
    rpcReturns([{ setting_key: "site.name" }]);

    const result = await updateSiteSetting({
      ...validStringUpdate,
      key: "  SITE.NAME  ",
      expectedValue: undefined,
    });

    expect(result).toEqual({ ok: true, key: "site.name" });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_site_setting", {
      p_key: "site.name",
      p_value: "Mandaloria",
      p_expected_value: undefined,
      p_reason: undefined,
    });
  });

  it("sends the expected value so a stale screen cannot overwrite", async () => {
    rpcReturns(null);

    await updateSiteSetting(validStringUpdate);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_set_site_setting",
      expect.objectContaining({ p_expected_value: "Mandaloria" }),
    );
  });

  it("treats an empty reason as absent", async () => {
    rpcReturns(null);

    await updateSiteSetting({ ...validStringUpdate, reason: "   " });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_set_site_setting",
      expect.objectContaining({ p_reason: "" }),
    );
  });

  it("passes through a number value", async () => {
    rpcReturns(null);

    await updateSiteSetting({
      key: "site.max_post_length",
      valueType: "number",
      value: 4000,
      expectedValue: 3000,
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_set_site_setting",
      expect.objectContaining({ p_value: 4000, p_expected_value: 3000 }),
    );
  });

  it("passes through a boolean value", async () => {
    rpcReturns(null);

    await updateSiteSetting({
      key: "site.registration_open",
      valueType: "boolean",
      value: false,
      expectedValue: true,
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_set_site_setting",
      expect.objectContaining({ p_value: false, p_expected_value: true }),
    );
  });

  it("passes through an array value for an array setting", async () => {
    rpcReturns(null);

    await updateSiteSetting({
      key: "site.navigation",
      valueType: "array",
      value: [{ label: "Plazas", href: "/plazas" }],
      expectedValue: [],
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_set_site_setting",
      expect.objectContaining({
        p_value: [{ label: "Plazas", href: "/plazas" }],
        p_expected_value: [],
      }),
    );
  });

  it("passes through an object value for a json setting", async () => {
    rpcReturns(null);

    await updateSiteSetting({
      key: "features.reactions",
      valueType: "json",
      value: { enabled: true },
      expectedValue: {},
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_set_site_setting",
      expect.objectContaining({ p_value: { enabled: true }, p_expected_value: {} }),
    );
  });

  it("rejects a value that does not match the setting type", async () => {
    const result = await updateSiteSetting({
      key: "site.name",
      valueType: "string",
      value: 42,
      expectedValue: "Mandaloria",
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result).toMatchObject({
      fieldErrors: { value: "Enter text up to 2000 characters." },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a non-finite number", async () => {
    const result = await updateSiteSetting({
      key: "site.max",
      valueType: "number",
      value: Number.NaN,
      expectedValue: 1,
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an array value for a json setting", async () => {
    const result = await updateSiteSetting({
      key: "features.reactions",
      valueType: "json",
      value: [],
      expectedValue: {},
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an object value for an array setting", async () => {
    const result = await updateSiteSetting({
      key: "site.navigation",
      valueType: "array",
      value: {},
      expectedValue: [],
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an expected value that does not match the setting type", async () => {
    const result = await updateSiteSetting({
      key: "site.name",
      valueType: "string",
      value: "Mandaloria",
      expectedValue: { unexpected: true },
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed key without reaching the database", async () => {
    const result = await updateSiteSetting({
      key: "Not A Key!",
      valueType: "string",
      value: "Mandaloria",
      expectedValue: "Mandaloria",
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a reason beyond the ceiling", async () => {
    const result = await updateSiteSetting({
      ...validStringUpdate,
      reason: "x".repeat(501),
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refreshes the settings screen and the public surface on success", async () => {
    rpcReturns(null);

    await updateSiteSetting(validStringUpdate);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/council/settings");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does not revalidate when the mutation failed", async () => {
    rpcFails("42501");

    await updateSiteSetting(validStringUpdate);

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "access_denied"],
    ["P0002", "not_found"],
    ["40001", "conflict"],
    ["22023", "invalid_request"],
    ["XX000", "retry"],
  ])("maps the database error %s to %s", async (dbCode, actionCode) => {
    rpcFails(dbCode);

    await expect(updateSiteSetting(validStringUpdate)).resolves.toMatchObject({
      ok: false,
      code: actionCode,
    });
  });

  it("never leaks the database message to the caller", async () => {
    rpcFails("42501");

    const result = await updateSiteSetting(validStringUpdate);

    expect(JSON.stringify(result)).not.toContain("database said no");
  });

  it("treats a thrown client failure as a retry rather than crashing", async () => {
    mocks.createClient.mockRejectedValue(new Error("no session"));

    await expect(updateSiteSetting(validStringUpdate)).resolves.toMatchObject({
      ok: false,
      code: "retry",
    });
  });

  it("keeps the mutation successful when cache revalidation throws", async () => {
    rpcReturns(null);
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    await expect(updateSiteSetting(validStringUpdate)).resolves.toEqual({
      ok: true,
      key: "site.name",
    });
  });
});
