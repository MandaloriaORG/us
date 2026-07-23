import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  can: mocks.can,
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
}));

import {
  getCouncilAuditAccess,
  getCouncilPlazaAccess,
  getCouncilReportAccess,
  getCouncilShellAccess,
  getCouncilUserAccess,
  getReportTargetModerationAccess,
} from "./access";

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

  it("requires the moderation permission the queue RPCs re-check", async () => {
    const denial = { allowed: false, reason: "missing_permission" } as const;
    mocks.can.mockResolvedValue(denial);

    await expect(getCouncilReportAccess()).resolves.toBe(denial);
    expect(mocks.can).toHaveBeenCalledOnce();
    expect(mocks.can).toHaveBeenCalledWith("moderation.hide");
  });

  it("requires the exact Council plaza-management permission", async () => {
    const denial = { allowed: false, reason: "missing_permission" } as const;
    mocks.can.mockResolvedValue(denial);

    await expect(getCouncilPlazaAccess()).resolves.toBe(denial);
    expect(mocks.can).toHaveBeenCalledOnce();
    expect(mocks.can).toHaveBeenCalledWith("admin.manage_plazas");
  });

  it("resolves every visible destination from one authorization snapshot", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: [
        "admin.manage_plazas",
        "admin.view_audit_logs",
        "admin.view_users",
        "moderation.hide",
      ],
      userId: "user-1",
    });

    await expect(getCouncilShellAccess()).resolves.toEqual({
      allowed: true,
      canManagePlazas: true,
      canViewAudit: true,
      canViewReports: true,
      canViewUsers: true,
      userId: "user-1",
    });
    expect(mocks.getAuthorizationSnapshot).toHaveBeenCalledOnce();
  });

  it("opens the shell for an administrator whose only destination is Plazas", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["admin.manage_plazas"],
      userId: "user-1",
    });

    await expect(getCouncilShellAccess()).resolves.toMatchObject({
      allowed: true,
      canManagePlazas: true,
      canViewAudit: false,
      canViewReports: false,
      canViewUsers: false,
    });
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

  it("opens the shell for a moderator whose only destination is the queue", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["moderation.hide"],
      userId: "user-1",
    });

    await expect(getCouncilShellAccess()).resolves.toMatchObject({
      allowed: true,
      canViewAudit: false,
      canViewReports: true,
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

describe("getReportTargetModerationAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives a plain Moderator hide and restore but not quarantine or delete", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["moderation.hide", "moderation.restore", "moderation.warn"],
      userId: "user-1",
    });

    await expect(getReportTargetModerationAccess()).resolves.toEqual({
      canHide: true,
      canQuarantine: false,
      canDelete: false,
      canRestore: true,
    });
  });

  it("gives a Guardian every target action", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: [
        "moderation.hide",
        "moderation.restore",
        "moderation.quarantine",
        "moderation.delete",
      ],
      userId: "user-1",
    });

    await expect(getReportTargetModerationAccess()).resolves.toEqual({
      canHide: true,
      canQuarantine: true,
      canDelete: true,
      canRestore: true,
    });
  });

  it("denies every action when authorization fails closed", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: false,
      reason: "verification_failed",
    });

    await expect(getReportTargetModerationAccess()).resolves.toEqual({
      canHide: false,
      canQuarantine: false,
      canDelete: false,
      canRestore: false,
    });
  });
});
