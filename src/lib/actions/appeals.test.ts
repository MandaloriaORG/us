import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { claimAppeal, createAppeal, resolveAppeal } from "./appeals";

const auditLogId = "80000000-0000-4000-8000-000000000001";
const appealId = "90000000-0000-4000-8000-000000000001";
const body = "This decision was based on an edit I made before the report was filed.";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: [{ appeal_id: appealId }], error: null });
});

describe("createAppeal", () => {
  it("validates before touching the database", async () => {
    const result = await createAppeal({ auditLogId, body: "too short" });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("refuses an id that is not a uuid", async () => {
    const result = await createAppeal({ auditLogId: "not-a-uuid", body });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("normalises the argument and files it", async () => {
    const result = await createAppeal({ auditLogId, body: `  ${body}\r\n  ` });

    expect(mocks.rpc).toHaveBeenCalledWith("create_appeal", {
      p_audit_log_id: auditLogId,
      p_body: body,
    });
    expect(result).toEqual({ ok: true, appealId });
  });

  it("maps a rate limit to its own code", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "53400", message: "raw" } });

    const result = await createAppeal({ auditLogId, body });

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("maps an already-appealed action to a refusal, not a crash", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "raw" } });

    const result = await createAppeal({ auditLogId, body });

    expect(result).toMatchObject({ ok: false, code: "invalid_request" });
  });

  it("never lets a database message reach the caller", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: 'relation "moderation_appeals" does not exist' },
    });

    const result = await createAppeal({ auditLogId, body });

    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(JSON.stringify(result)).not.toContain("relation");
  });
});

describe("claimAppeal", () => {
  it("sends the status it was shown, so a stale claim conflicts", async () => {
    const result = await claimAppeal({ appealId, expectedStatus: "open" });

    expect(mocks.rpc).toHaveBeenCalledWith("moderation_claim_appeal", {
      p_appeal_id: appealId,
      p_expected_status: "open",
    });
    expect(result).toEqual({ ok: true, appealId });
  });

  it("maps a serialization failure to a conflict", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "raw" } });

    const result = await claimAppeal({ appealId, expectedStatus: "open" });

    expect(result).toMatchObject({ ok: false, code: "conflict" });
  });
});

describe("resolveAppeal", () => {
  it("refuses a destination that is not a decision", async () => {
    const result = await resolveAppeal({
      appealId,
      expectedStatus: "under_review",
      status: "open",
      decision: "Back to the queue",
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("requires a decision of at least three characters", async () => {
    const result = await resolveAppeal({
      appealId,
      expectedStatus: "under_review",
      status: "denied",
      decision: "no",
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("decides with the status it displayed", async () => {
    const result = await resolveAppeal({
      appealId,
      expectedStatus: "under_review",
      status: "granted",
      decision: "The edit history supports the member.",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("moderation_resolve_appeal", {
      p_appeal_id: appealId,
      p_expected_status: "under_review",
      p_status: "granted",
      p_decision: "The edit history supports the member.",
    });
    expect(result).toEqual({ ok: true, appealId });
  });

  it("maps the reviewer being the original actor to access denied", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "raw" } });

    const result = await resolveAppeal({
      appealId,
      expectedStatus: "under_review",
      status: "denied",
      decision: "I stand by my own action.",
    });

    expect(result).toMatchObject({ ok: false, code: "access_denied" });
  });

  it("does not turn a cache failure into a reported failure", async () => {
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    const result = await resolveAppeal({
      appealId,
      expectedStatus: "under_review",
      status: "denied",
      decision: "The action stands.",
    });

    expect(result).toEqual({ ok: true, appealId });
  });
});
