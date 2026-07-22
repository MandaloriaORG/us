import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import {
  can,
  canAny,
  getAuthorizationSnapshot,
  getCurrentAuthorization,
  getUserPermissions,
  isAdmin,
  isStaff,
} from "@/lib/permissions";

type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null };

let profileResult: QueryResult;
const queryFilters: Array<{ column: string; value: unknown }> = [];

function ok(data: unknown): QueryResult {
  return { data, error: null };
}

function failed(message: string): QueryResult {
  return { data: null, error: { message } };
}

function createProfileQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(profileResult)),
  };

  query.select.mockReturnValue(query);
  query.eq.mockImplementation((column: string, value: unknown) => {
    queryFilters.push({ column, value });
    return query;
  });

  return query;
}

function setUser(user: { id: string } | null, error: QueryError | null = null) {
  mocks.getUser.mockResolvedValue({ data: { user }, error });
}

function setPermissionNames(...names: string[]) {
  mocks.rpc.mockResolvedValue({
    data: names.map((permission_name) => ({ permission_name })),
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryFilters.length = 0;

  setUser({ id: "user-1" });
  profileResult = ok({ status: "active" });
  setPermissionNames("profile.edit.own");

  mocks.from.mockImplementation((table: string) => {
    expect(table).toBe("profiles");
    return createProfileQuery();
  });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  });
});

describe("can", () => {
  it("denies an anonymous request without querying profile or permissions", async () => {
    setUser(null);

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason: "not_authenticated",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when authentication verification fails", async () => {
    setUser(null, { message: "auth unavailable" });

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason: "verification_failed",
    });
  });

  it("denies a user without a profile", async () => {
    profileResult = ok(null);

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason: "profile_not_found",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the profile query fails", async () => {
    profileResult = failed("profile query failed");

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason: "verification_failed",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["suspended", "account_suspended"],
    ["banned", "account_banned"],
  ] as const)("denies a %s account", async (status, reason) => {
    profileResult = ok({ status });

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the narrow permission RPC fails", async () => {
    mocks.rpc.mockResolvedValue(failed("permission lookup unavailable"));

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason: "verification_failed",
    });
  });

  it("grants only an exact permission name", async () => {
    await expect(can("profile.edit.own")).resolves.toEqual({ allowed: true });
  });

  it("scopes the profile lookup and calls only the current-user permission RPC", async () => {
    await can("profile.edit.own");

    expect(queryFilters).toEqual([{ column: "id", value: "user-1" }]);
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("current_user_permissions");
  });

  it.each(["profile.edit", "profile.edit.own.extra", "PROFILE.EDIT.OWN", "profile.%"])(
    "denies the non-exact permission %s",
    async (permission) => {
      await expect(can(permission)).resolves.toEqual({
        allowed: false,
        reason: "missing_permission",
      });
    },
  );

  it("fails closed when the client throws unexpectedly", async () => {
    mocks.createClient.mockRejectedValueOnce(new Error("network failure"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(can("profile.edit.own")).resolves.toEqual({
      allowed: false,
      reason: "verification_failed",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe("canAny", () => {
  it("denies an empty request without loading authorization context", async () => {
    await expect(canAny([])).resolves.toEqual({
      allowed: false,
      reason: "missing_permission",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("allows when any requested permission matches", async () => {
    setPermissionNames("profile.edit.own", "post.create");

    await expect(canAny(["admin.manage_roles", "post.create", "moderation.hide"])).resolves.toEqual(
      { allowed: true },
    );
  });

  it("loads authorization context once for several permissions", async () => {
    setPermissionNames("post.create");

    await canAny(["admin.manage_roles", "post.create", "moderation.hide"]);

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("preserves a terminal account denial", async () => {
    profileResult = ok({ status: "suspended" });

    await expect(canAny(["post.create", "admin.manage_roles"])).resolves.toEqual({
      allowed: false,
      reason: "account_suspended",
    });
  });
});

describe("getUserPermissions", () => {
  it("returns stable, unique permission names for an active user", async () => {
    setPermissionNames("post.create", "profile.edit.own", "post.create");

    await expect(getUserPermissions()).resolves.toEqual(["post.create", "profile.edit.own"]);
  });

  it.each(["suspended", "banned"] as const)(
    "returns no grants for a %s account",
    async (status) => {
      profileResult = ok({ status });

      await expect(getUserPermissions()).resolves.toEqual([]);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("returns no grants when verification fails", async () => {
    mocks.rpc.mockResolvedValue(failed("lookup failed"));

    await expect(getUserPermissions()).resolves.toEqual([]);
  });
});

describe("getCurrentAuthorization", () => {
  it("returns the active actor and stable permission names", async () => {
    setPermissionNames("post.create", "profile.edit.own", "post.create");

    await expect(getCurrentAuthorization()).resolves.toEqual({
      permissionNames: ["post.create", "profile.edit.own"],
      userId: "user-1",
    });
  });

  it("returns null when the actor is inactive", async () => {
    profileResult = ok({ status: "banned" });

    await expect(getCurrentAuthorization()).resolves.toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("getAuthorizationSnapshot", () => {
  it("returns the actor and grants from one authorization load", async () => {
    setPermissionNames("admin.view_audit_logs", "admin.view_users");

    await expect(getAuthorizationSnapshot()).resolves.toEqual({
      allowed: true,
      permissionNames: ["admin.view_audit_logs", "admin.view_users"],
      userId: "user-1",
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("preserves the precise authorization denial", async () => {
    setUser(null);

    await expect(getAuthorizationSnapshot()).resolves.toEqual({
      allowed: false,
      reason: "not_authenticated",
    });
  });
});

describe("role helpers", () => {
  it.each([
    [[], false],
    [["admin.manage_roles"], true],
  ] as const)("resolves administrator access", async (names, expected) => {
    setPermissionNames(...names);
    await expect(isAdmin()).resolves.toBe(expected);
  });

  it.each([
    [[], false],
    [["codex.view"], false],
    [["moderation.hide"], true],
    [["admin.manage_roles"], true],
  ] as const)("resolves staff access from exact grants", async (names, expected) => {
    setPermissionNames(...names);
    await expect(isStaff()).resolves.toBe(expected);
  });
});
