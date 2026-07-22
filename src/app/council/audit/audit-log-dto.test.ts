import { describe, expect, it } from "vitest";
import {
  getAuditActionDetail,
  getAuditActionLabel,
  getAuditLogTotal,
  getAuditTargetFallback,
  normalizeAuditLogRow,
  normalizeAuditLogRows,
} from "./audit-log-dto";

const validRow = {
  action: "user.suspended",
  actor_display_name: "Council Steward",
  actor_id: "10000000-0000-4000-8000-000000000001",
  created_at: "2026-07-22T18:30:00+00:00",
  id: "20000000-0000-4000-8000-000000000001",
  new_status: "suspended",
  old_status: "active",
  reason: "Repeated abuse after a documented warning",
  role_name: null,
  target_display_name: "Example Member",
  target_id: "30000000-0000-4000-8000-000000000001",
  target_type: "user",
  total_count: 12,
};

describe("normalizeAuditLogRow", () => {
  it("normalizes a valid RPC row into a presentable DTO", () => {
    expect(normalizeAuditLogRow(validRow)).toEqual({
      action: "user.suspended",
      actionLabel: "Member suspended",
      actorDisplayName: "Council Steward",
      actorId: "10000000-0000-4000-8000-000000000001",
      createdAt: "2026-07-22T18:30:00.000Z",
      id: "20000000-0000-4000-8000-000000000001",
      newStatus: "suspended",
      oldStatus: "active",
      reason: "Repeated abuse after a documented warning",
      roleName: null,
      targetDisplayName: "Example Member",
      targetId: "30000000-0000-4000-8000-000000000001",
      targetType: "user",
      totalCount: 12,
    });
  });

  it("uses explicit deleted-identity fallbacks for nullable RPC fields", () => {
    expect(
      normalizeAuditLogRow({
        ...validRow,
        actor_display_name: null,
        new_status: null,
        old_status: null,
        reason: null,
        role_name: null,
        target_display_name: null,
        target_id: null,
      }),
    ).toMatchObject({
      actorDisplayName: "Deleted member",
      newStatus: null,
      oldStatus: null,
      reason: null,
      roleName: null,
      targetDisplayName: "Deleted member",
      targetId: null,
    });
  });

  it.each([
    ["non-object", null],
    ["bad audit id", { ...validRow, id: "not-a-uuid" }],
    ["bad actor id", { ...validRow, actor_id: "not-a-uuid" }],
    ["bad target id", { ...validRow, target_id: "not-a-uuid" }],
    ["short action", { ...validRow, action: "x" }],
    ["short target type", { ...validRow, target_type: "x" }],
    ["bad date", { ...validRow, created_at: "2026-02-31T12:00:00Z" }],
  ])("rejects a malformed required field: %s", (_case, row) => {
    expect(normalizeAuditLogRow(row)).toBeNull();
  });

  it("drops malformed rows while retaining valid rows", () => {
    expect(
      normalizeAuditLogRows([validRow, { ...validRow, id: "bad" }, undefined, validRow]),
    ).toHaveLength(2);
    expect(normalizeAuditLogRows({ rows: [validRow] })).toEqual([]);
  });

  it("retains PostgreSQL UUIDs and bounded legacy keys without exposing them as labels", () => {
    const normalized = normalizeAuditLogRow({
      ...validRow,
      action: "<script>",
      actor_id: "10000000-0000-0000-0000-000000000001",
      target_type: "user/profile",
    });

    expect(normalized).toMatchObject({
      action: "<script>",
      actionLabel: "Administrative action",
      actorId: "10000000-0000-0000-0000-000000000001",
      targetType: "user/profile",
    });
    expect(normalized && getAuditTargetFallback(normalized.targetType)).toBe("Deleted target");
  });

  it("bounds optional text and allowlists statuses without rejecting the audit event", () => {
    const normalized = normalizeAuditLogRow({
      ...validRow,
      actor_display_name: "A".repeat(51),
      new_status: "deleted",
      old_status: "owner",
      reason: "R".repeat(501),
      role_name: "R".repeat(51),
      target_display_name: "T".repeat(51),
    });

    expect(normalized).toMatchObject({
      actorDisplayName: "Deleted member",
      newStatus: null,
      oldStatus: null,
      reason: null,
      roleName: null,
      targetDisplayName: "Deleted member",
    });
  });

  it("keeps hostile-looking user content as plain text data", () => {
    const plainText = '<img src=x onerror="alert(1)">';
    const normalized = normalizeAuditLogRow({
      ...validRow,
      action: "user.role_assigned",
      actor_display_name: plainText,
      role_name: plainText,
      target_display_name: plainText,
    });

    expect(normalized).toMatchObject({
      actorDisplayName: plainText,
      roleName: plainText,
      targetDisplayName: plainText,
    });
    expect(normalized && getAuditActionDetail(normalized)).toBe(`Assigned role: ${plainText}`);
  });

  it("normalizes only non-negative safe totals", () => {
    expect(getAuditLogTotal([{ ...validRow, total_count: "42" }])).toBe(42);
    expect(getAuditLogTotal([{ ...validRow, total_count: Number.MAX_SAFE_INTEGER + 1 }])).toBe(0);
    expect(getAuditLogTotal([{ ...validRow, total_count: "9007199254740992" }])).toBe(0);
    expect(getAuditLogTotal([{ ...validRow, total_count: -1 }])).toBe(0);
    expect(getAuditLogTotal(null)).toBe(0);
  });
});

describe("audit presentation helpers", () => {
  it("uses allowlisted action labels and never exposes an unknown raw action key", () => {
    expect(getAuditActionLabel("user.role_removed")).toBe("Role removed");
    expect(getAuditActionLabel("system.future_secret_action")).toBe("Administrative action");
    expect(getAuditActionLabel("system.future_secret_action")).not.toContain(
      "system.future_secret_action",
    );
  });

  it("returns allowlisted details without serializing raw keys or structured data", () => {
    const normalized = normalizeAuditLogRow(validRow);
    expect(normalized && getAuditActionDetail(normalized)).toBe(
      "Status changed from Active to Suspended",
    );

    expect(
      getAuditActionDetail({
        action: "system.future_secret_action",
        newStatus: null,
        oldStatus: null,
        roleName: "Administrator",
      }),
    ).toBeNull();
  });

  it("uses a type allowlist for deleted-target fallbacks", () => {
    expect(getAuditTargetFallback("role")).toBe("Deleted role");
    expect(getAuditTargetFallback("private.internal_target")).toBe("Deleted target");
  });
});
