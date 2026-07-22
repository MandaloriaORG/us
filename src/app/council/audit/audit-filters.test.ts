import { describe, expect, it } from "vitest";
import { auditActions, auditMaxPage, auditPageSize, parseAuditFilters } from "./audit-filters";

const actorId = "123E4567-E89B-42D3-A456-426614174000";
const targetId = "018f3f77-8b5e-7a3d-9ec8-4fd515abe199";

describe("parseAuditFilters", () => {
  it("treats missing and empty values as absent filters", () => {
    const missing = parseAuditFilters();
    const empty = parseAuditFilters({
      action: "",
      actor: "",
      from: "",
      page: "",
      target: "",
      to: "",
    });

    expect(missing).toEqual(empty);
    expect(missing).toMatchObject({
      canonicalQuery: "",
      errors: {},
      page: 1,
      rpcArgs: {
        p_action: undefined,
        p_actor_id: undefined,
        p_created_before: undefined,
        p_created_from: undefined,
        p_limit: auditPageSize,
        p_offset: 0,
        p_target_id: undefined,
      },
      valid: true,
    });
  });

  it.each(auditActions)("accepts the allowlisted action %s", (action) => {
    const result = parseAuditFilters({ action });

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.rpcArgs.p_action).toBe(action);
  });

  it.each(["USER.SUSPENDED", " user.suspended", "user.created", " "])(
    "rejects the non-allowlisted or padded action %j without erasing it",
    (action) => {
      const result = parseAuditFilters({ action });

      expect(result).toEqual({
        errors: { action: "Choose a supported audit action." },
        valid: false,
        values: { action, actor: "", from: "", page: "", target: "", to: "" },
      });
    },
  );

  it("accepts canonical PostgreSQL UUIDs, normalizes RPC arguments, and preserves form values", () => {
    const result = parseAuditFilters({ actor: actorId, target: targetId });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.values).toMatchObject({ actor: actorId, target: targetId });
    expect(result.rpcArgs).toMatchObject({
      p_actor_id: actorId.toLowerCase(),
      p_target_id: targetId,
    });
    expect(result.canonicalQuery).toBe(
      `actor=${encodeURIComponent(actorId)}&target=${encodeURIComponent(targetId)}`,
    );
  });

  it.each([
    ["actor", "123e4567e89b42d3a456426614174000"],
    ["actor", "123e4567-e89b-02d3-a456-42661417400z"],
    ["target", "123e4567-e89b-42d3-7456-42661417400"],
    ["target", "not-a-uuid"],
  ] as const)("rejects a non-canonical %s UUID", (field, value) => {
    const result = parseAuditFilters({ [field]: value });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[field]).toMatch(/valid .* ID/);
  });

  it("accepts historical UUID version and variant bit patterns", () => {
    const result = parseAuditFilters({
      actor: "10000000-0000-0000-0000-000000000001",
      target: "20000000-0000-f000-7000-000000000002",
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.rpcArgs).toMatchObject({
      p_actor_id: "10000000-0000-0000-0000-000000000001",
      p_target_id: "20000000-0000-f000-7000-000000000002",
    });
  });

  it("converts inclusive calendar dates to a half-open UTC RPC interval", () => {
    const result = parseAuditFilters({ from: "2024-02-29", to: "2024-12-31" });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.rpcArgs).toMatchObject({
      p_created_before: "2025-01-01T00:00:00.000Z",
      p_created_from: "2024-02-29T00:00:00.000Z",
    });
  });

  it("allows a one-day interval when from and to are the same date", () => {
    const result = parseAuditFilters({ from: "2025-03-30", to: "2025-03-30" });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.rpcArgs.p_created_from).toBe("2025-03-30T00:00:00.000Z");
    expect(result.rpcArgs.p_created_before).toBe("2025-03-31T00:00:00.000Z");
  });

  it.each([
    ["from", "2023-02-29"],
    ["from", "2024-13-01"],
    ["to", "2024-04-31"],
    ["to", "0000-01-01"],
    ["to", "2024-1-01"],
    ["to", "2024-01-01T00:00:00Z"],
  ] as const)("rejects the unreal or non-strict %s date %s", (field, value) => {
    const result = parseAuditFilters({ [field]: value });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[field]).toMatch(/real date/);
  });

  it("rejects an inverted calendar range on the end-date field", () => {
    const result = parseAuditFilters({ from: "2026-07-23", to: "2026-07-22" });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual({
        to: "The end date must be on or after the start date.",
      });
    }
  });

  it("accepts the highest page whose offset fits the RPC contract", () => {
    const result = parseAuditFilters({ page: String(auditMaxPage) });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.page).toBe(20_001);
    expect(result.rpcArgs.p_offset).toBe(1_000_000);
    expect(result.canonicalQuery).toBe("page=20001");
  });

  it.each(["0", "20002", "1.5", "+1", "01", "-1", "NaN", "9999999999999999"])(
    "rejects the invalid page %s",
    (page) => {
      const result = parseAuditFilters({ page });

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.errors.page).toContain("1 to 20001");
    },
  );

  it("accumulates field errors and never exposes RPC arguments for invalid input", () => {
    const result = parseAuditFilters({
      action: "user.created",
      actor: "bad",
      from: "2025-02-29",
      page: "0",
      target: "also-bad",
      to: "tomorrow",
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "action",
      "actor",
      "from",
      "page",
      "target",
      "to",
    ]);
    expect("rpcArgs" in result).toBe(false);
  });

  it("uses only the first value for repeated URL parameters", () => {
    const result = parseAuditFilters({
      action: ["user.banned", "user.created"],
      page: ["2", "99999"],
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.rpcArgs).toMatchObject({
      p_action: "user.banned",
      p_offset: 50,
    });
    expect(result.canonicalQuery).toBe("action=user.banned&page=2");
  });

  it("preserves every active filter in a stable canonical query", () => {
    const result = parseAuditFilters({
      action: "user.role_removed",
      actor: actorId,
      from: "2025-01-01",
      page: "3",
      target: targetId,
      to: "2025-01-31",
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.canonicalQuery).toBe(
      `action=user.role_removed&actor=${encodeURIComponent(actorId)}&target=${encodeURIComponent(targetId)}&from=2025-01-01&to=2025-01-31&page=3`,
    );
  });
});
