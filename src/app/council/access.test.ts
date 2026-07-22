import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  can: mocks.can,
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));

import { getCouncilAuditAccess, getCouncilShellAccess, getCouncilUserAccess } from "./access";

describe("getCouncilUserAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires the exact Council user-list permission", async () => {
    const denial = { allowed: false, reason: "missing_permission" } as const;
    mocks.can.mockResolvedValue(denial);

    await expect(getCouncilUserAccess()).resolves.toBe(denial);
    expect(mocks.can).toHaveBeenCalledOnce();
    expect(mocks.can).toHaveBeenCalledWith("admin.view_users");
  });

  it("requires the exact Council audit permission", async () => {
    const denial = { allowed: false, reason: "missing_permission" } as const;
    mocks.can.mockResolvedValue(denial);

    await expect(getCouncilAuditAccess()).resolves.toBe(denial);
    expect(mocks.can).toHaveBeenCalledOnce();
    expect(mocks.can).toHaveBeenCalledWith("admin.view_audit_logs");
  });

  it("resolves both visible destinations from one authorization snapshot", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["admin.view_audit_logs", "admin.view_users"],
      userId: "user-1",
    });

    await expect(getCouncilShellAccess()).resolves.toEqual({
      allowed: true,
      canViewAudit: true,
      canViewUsers: true,
      userId: "user-1",
    });
    expect(mocks.getAuthorizationSnapshot).toHaveBeenCalledOnce();
  });

  it("allows an audit-only shell without granting user-list access", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["admin.view_audit_logs"],
      userId: "user-1",
    });

    await expect(getCouncilShellAccess()).resolves.toMatchObject({
      allowed: true,
      canViewAudit: true,
      canViewUsers: false,
    });
  });

  it("denies an active actor with no Council destination", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["profile.edit.own"],
      userId: "user-1",
    });

    await expect(getCouncilShellAccess()).resolves.toEqual({
      allowed: false,
      reason: "missing_permission",
    });
  });

  it("preserves terminal authorization failures", async () => {
    const failure = { allowed: false, reason: "verification_failed" } as const;
    mocks.getAuthorizationSnapshot.mockResolvedValue(failure);

    await expect(getCouncilShellAccess()).resolves.toBe(failure);
  });
});
