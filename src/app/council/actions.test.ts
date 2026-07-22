import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  assignUserRole,
  removeUserRole,
  setUserStatus,
  type ChangeUserRoleInput,
  type CouncilActionResult,
  type SetUserStatusInput,
} from "@/app/council/actions";

const targetUserId = "10000000-0000-4000-8000-000000000001";
const roleId = "20000000-0000-4000-8000-000000000001";
const auditLogId = "30000000-0000-4000-8000-000000000001";

const statusInput: SetUserStatusInput = {
  targetUserId,
  expectedStatus: "active",
  status: "suspended",
  reason: "Repeated harassment",
};

const roleInput: ChangeUserRoleInput = {
  targetUserId,
  roleId,
  reason: "Approved by Council",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: auditLogId, error: null });
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("Council mutation actions", () => {
  it.each([
    {
      action: setUserStatus,
      input: { ...statusInput, reason: "  Repeated harassment  " },
      rpc: "council_set_user_status",
      args: {
        p_user_id: targetUserId,
        p_expected_status: "active",
        p_status: "suspended",
        p_reason: "Repeated harassment",
      },
    },
    {
      action: assignUserRole,
      input: { ...roleInput, reason: "  Approved by Council  " },
      rpc: "council_assign_user_role",
      args: {
        p_user_id: targetUserId,
        p_role_id: roleId,
        p_reason: "Approved by Council",
      },
    },
    {
      action: removeUserRole,
      input: { ...roleInput, reason: "  Role no longer required  " },
      rpc: "council_remove_user_role",
      args: {
        p_user_id: targetUserId,
        p_role_id: roleId,
        p_reason: "Role no longer required",
      },
    },
  ])("calls $rpc with only its audited RPC arguments", async ({ action, input, rpc, args }) => {
    await expect(action(input as never)).resolves.toEqual({
      ok: true,
      auditLogId,
    });

    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(rpc, args);
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/council/users");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, `/council/users/${targetUserId}`);
  });

  it.each([
    ["malformed target id", setUserStatus, { ...statusInput, targetUserId: "not-a-uuid" }],
    ["unknown status", setUserStatus, { ...statusInput, status: "deleted" }],
    ["unknown expected status", setUserStatus, { ...statusInput, expectedStatus: "deleted" }],
    ["short trimmed reason", setUserStatus, { ...statusInput, reason: "  x  " }],
    ["oversized reason", setUserStatus, { ...statusInput, reason: "x".repeat(501) }],
    ["malformed role id", assignUserRole, { ...roleInput, roleId: "not-a-uuid" }],
  ])("rejects %s before creating a database client", async (_label, action, input) => {
    await expect(action(input as never)).resolves.toEqual({
      ok: false,
      code: "invalid_input",
      message: "Check the action details and try again.",
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "access_denied", "You do not have permission to make this change."],
    ["22023", "invalid_request", "This change is not valid for the current account state."],
    ["23514", "protected_last_administrator", "The last Administrator role cannot be removed."],
    ["XX000", "retry", "The change could not be saved. Try again."],
  ])("maps SQLSTATE %s to a stable UI result", async (code, resultCode, message) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "sensitive database details", hint: "private schema detail" },
    });

    const result = await setUserStatus(statusInput);

    expect(result).toEqual({ ok: false, code: resultCode, message });
    expect(JSON.stringify(result)).not.toContain("sensitive database details");
    expect(JSON.stringify(result)).not.toContain("private schema detail");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps a thrown provider failure without exposing it", async () => {
    mocks.rpc.mockRejectedValue(
      Object.assign(new Error("provider connection string"), { code: "42501" }),
    );

    const result = await assignUserRole(roleInput);

    expect(result).toEqual({
      ok: false,
      code: "access_denied",
      message: "You do not have permission to make this change.",
    });
    expect(JSON.stringify(result)).not.toContain("provider connection string");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not claim success or revalidate for an invalid audit identifier", async () => {
    mocks.rpc.mockResolvedValue({ data: "not-an-audit-uuid", error: null });

    const result = await removeUserRole(roleInput);

    expect(result).toEqual({
      ok: false,
      code: "retry",
      message: "The change could not be saved. Try again.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps a committed success when cache invalidation fails", async () => {
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    const result: CouncilActionResult = await setUserStatus(statusInput);

    expect(result).toEqual({ ok: true, auditLogId });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenLastCalledWith(`/council/users/${targetUserId}`);
  });
});
