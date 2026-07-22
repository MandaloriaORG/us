import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  getCouncilShellAccess: vi.fn(),
  getCouncilUserAccess: vi.fn(),
  getCurrentAuthorization: vi.fn(),
  maybeSingle: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  rpc: vi.fn(),
  rolesOrder: vi.fn(),
  rolesSelect: vi.fn(),
}));

vi.mock("@/app/council/access", () => ({
  getCouncilShellAccess: mocks.getCouncilShellAccess,
  getCouncilUserAccess: mocks.getCouncilUserAccess,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  usePathname: () => "/council/users",
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/permissions", () => ({
  getCurrentAuthorization: mocks.getCurrentAuthorization,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import CouncilError from "./error";
import CouncilLayout, { dynamic, metadata } from "./layout";
import CouncilLoading from "./loading";
import CouncilPage from "./page";
import CouncilUserDetailPage from "./users/[id]/page";
import CouncilUsersPage from "./users/page";

type RpcError = { message: string };
type RpcResult = {
  data: unknown;
  error: RpcError | null;
};

type RpcOperation = {
  args: Record<string, unknown>;
  name: string;
};

const rpcResults = new Map<string, RpcResult[]>();
const rpcOperations: RpcOperation[] = [];
let rolesResult: RpcResult;
const userId = "00000000-0000-4000-8000-000000000001";
const secondUserId = "00000000-0000-4000-8000-000000000002";

function ok(data: unknown): RpcResult {
  return { data, error: null };
}

function failed(message: string): RpcResult {
  return { data: null, error: { message } };
}

function queueRpc(name: string, ...results: RpcResult[]) {
  rpcResults.set(name, results);
}

function nextRpcResult(name: string) {
  return rpcResults.get(name)?.shift() ?? ok(name === "council_list_users" ? [] : null);
}

const allowed = {
  allowed: true,
  canViewAudit: true,
  canViewUsers: true,
  userId: secondUserId,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  rpcResults.clear();
  rpcOperations.length = 0;

  mocks.getCouncilUserAccess.mockResolvedValue(allowed);
  mocks.getCouncilShellAccess.mockResolvedValue(allowed);
  mocks.getCurrentAuthorization.mockResolvedValue({
    permissionNames: [],
    userId: secondUserId,
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
  mocks.maybeSingle.mockImplementation(() => Promise.resolve(nextRpcResult("council_get_user")));
  mocks.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    rpcOperations.push({ name, args });
    if (name === "council_get_user") {
      return { maybeSingle: mocks.maybeSingle };
    }
    return Promise.resolve(nextRpcResult(name));
  });
  rolesResult = ok([]);
  const rolesQuery = {
    order: mocks.rolesOrder,
    select: mocks.rolesSelect,
  };
  mocks.rolesSelect.mockReturnValue(rolesQuery);
  mocks.rolesOrder.mockImplementation(() => Promise.resolve(rolesResult));
  mocks.from.mockImplementation((table: string) => {
    expect(table).toBe("roles");
    return rolesQuery;
  });
  mocks.createClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
});

describe("Council shell", () => {
  it("stays request-bound instead of authorizing during prerender", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("does not index Council routes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders navigation and children for authorized users", async () => {
    const element = await CouncilLayout({
      children: <p>Protected Council content</p>,
    });

    render(element);

    expect(screen.getByText("Protected Council content")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Users" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Users" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: "Audit logs" })).not.toHaveLength(0);
  });

  it("renders an explicit denial without protected children", async () => {
    mocks.getCouncilShellAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    const element = await CouncilLayout({
      children: <p>Protected Council content</p>,
    });
    render(element);

    expect(screen.getByRole("heading", { name: "Council access required" })).toBeInTheDocument();
    expect(screen.queryByText("Protected Council content")).not.toBeInTheDocument();
  });

  it("renders a recoverable verification failure without protected children", async () => {
    mocks.getCouncilShellAccess.mockResolvedValue({
      allowed: false,
      reason: "verification_failed",
    });

    const element = await CouncilLayout({ children: <p>Secret</p> });
    render(element);

    expect(screen.getByRole("alert")).toHaveTextContent("Council is temporarily unavailable");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/council");
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("uses a content-only loading state", () => {
    const { container } = render(<CouncilLoading />);

    expect(screen.getByLabelText("Loading Council users")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("aside")).toBeNull();
  });

  it("retries a local error without logging the raw error", () => {
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <CouncilError
        error={Object.assign(new Error("secret detail"), { digest: "abc123" })}
        reset={reset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Council content failed to load.", {
      digest: "abc123",
    });
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("secret detail"));
    consoleError.mockRestore();
  });

  it("routes the Council root to the first permitted destination", async () => {
    await expect(CouncilPage()).rejects.toThrow("NEXT_REDIRECT:/council/users");

    mocks.getCouncilShellAccess.mockResolvedValue({
      allowed: true,
      canViewAudit: true,
      canViewUsers: false,
      userId: secondUserId,
    });
    await expect(CouncilPage()).rejects.toThrow("NEXT_REDIRECT:/council/audit");
  });

  it("does not redirect a denied Council root", async () => {
    mocks.getCouncilShellAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    await expect(CouncilPage()).resolves.toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("Council users list", () => {
  it("checks page-level access before creating an authenticated client", async () => {
    mocks.getCouncilUserAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    await expect(CouncilUsersPage({ searchParams: {} })).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("surfaces an authorization verification failure", async () => {
    mocks.getCouncilUserAccess.mockResolvedValue({
      allowed: false,
      reason: "verification_failed",
    });

    await expect(CouncilUsersPage({ searchParams: {} })).rejects.toThrow(
      "Council authorization could not be verified",
    );
  });

  it("renders the unfiltered empty state with visible filter labels", async () => {
    const element = await CouncilUsersPage({ searchParams: {} });
    render(element);

    expect(screen.getByLabelText("Search members")).toBeInTheDocument();
    expect(screen.getByLabelText("Account status")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort users")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No members are available" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("uses the list RPC contract and renders roles returned by it", async () => {
    queueRpc(
      "council_list_users",
      ok([
        {
          id: userId,
          display_name: "Din Djarin",
          avatar_path: `${userId}/private.webp`,
          status: "active",
          created_at: "2025-01-15T00:00:00Z",
          role_names: ["Administrator"],
          total_count: 2,
        },
        {
          id: secondUserId,
          display_name: "Bo-Katan",
          avatar_path: null,
          status: "suspended",
          created_at: "2025-03-20T00:00:00Z",
          role_names: [],
          total_count: 2,
        },
      ]),
    );

    const element = await CouncilUsersPage({ searchParams: {} });
    const { container } = render(element);

    expect(screen.getByRole("link", { name: /Din Djarin/ })).toHaveAttribute(
      "href",
      `/council/users/${userId}`,
    );
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("suspended")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(rpcOperations).toEqual([
      {
        name: "council_list_users",
        args: {
          p_limit: 25,
          p_offset: 0,
          p_search: undefined,
          p_sort: "created_desc",
          p_status: undefined,
        },
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("passes bounded URL filters and pagination as exact RPC arguments", async () => {
    queueRpc(
      "council_list_users",
      ok([
        {
          id: userId,
          display_name: "Din",
          status: "suspended",
          created_at: "2025-01-01T00:00:00Z",
          role_names: [],
          total_count: 60,
        },
      ]),
    );

    const element = await CouncilUsersPage({
      searchParams: {
        page: "2",
        q: "Din",
        sort: "name_desc",
        status: "suspended",
      },
    });
    render(element);

    expect(rpcOperations).toEqual([
      {
        name: "council_list_users",
        args: {
          p_limit: 25,
          p_offset: 25,
          p_search: "Din",
          p_sort: "name_desc",
          p_status: "suspended",
        },
      },
    ]);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/council/users?q=Din&status=suspended&sort=name_desc",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/council/users?q=Din&status=suspended&sort=name_desc&page=3",
    );
  });

  it("probes the first row and redirects an empty out-of-range page", async () => {
    queueRpc(
      "council_list_users",
      ok([]),
      ok([
        {
          id: userId,
          display_name: "Din",
          status: "active",
          created_at: "2025-01-01T00:00:00Z",
          role_names: [],
          total_count: 60,
        },
      ]),
    );

    await expect(
      CouncilUsersPage({
        searchParams: { page: "99", q: "Din", status: "active" },
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/council/users?q=Din&status=active&page=3");
    expect(rpcOperations).toEqual([
      {
        name: "council_list_users",
        args: {
          p_limit: 25,
          p_offset: 2450,
          p_search: "Din",
          p_sort: "created_desc",
          p_status: "active",
        },
      },
      {
        name: "council_list_users",
        args: {
          p_limit: 1,
          p_offset: 0,
          p_search: "Din",
          p_sort: "created_desc",
          p_status: "active",
        },
      },
    ]);
  });

  it("normalizes partial and excessively large page values before querying", async () => {
    await CouncilUsersPage({ searchParams: { page: "2oops" } });
    await CouncilUsersPage({ searchParams: { page: "9999999999999999" } });

    expect(rpcOperations.map((operation) => operation.args.p_offset)).toEqual([0, 0]);
  });

  it("tolerates nullable fields and unknown statuses without exposing avatar paths", async () => {
    queueRpc(
      "council_list_users",
      ok([
        {
          id: userId,
          display_name: null,
          avatar_path: `${userId}/private.webp`,
          status: "paused",
          created_at: null,
          role_names: null,
          total_count: 1,
        },
      ]),
    );

    const element = await CouncilUsersPage({ searchParams: {} });
    const { container } = render(element);

    expect(screen.getByRole("link", { name: "Unnamed member" })).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.getByText("No assigned roles")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a filter-specific no-results state with recovery", async () => {
    const element = await CouncilUsersPage({
      searchParams: { q: "missing" },
    });
    render(element);

    expect(
      screen.getByRole("heading", {
        name: "No members match these filters",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Clear filters" })).not.toHaveLength(0);
  });

  it("surfaces list and out-of-range probe failures safely", async () => {
    queueRpc("council_list_users", failed("private database detail"));
    await expect(CouncilUsersPage({ searchParams: {} })).rejects.toThrow(
      "Council users could not be loaded",
    );

    queueRpc("council_list_users", ok([]), failed("private probe detail"));
    await expect(CouncilUsersPage({ searchParams: { page: "2" } })).rejects.toThrow(
      "Council users could not be loaded",
    );
  });
});

describe("Council user detail", () => {
  const profile = {
    id: userId,
    display_name: "Din Djarin",
    avatar_path: `${userId}/private.webp`,
    bio: "Bounty hunter turned foundling father.",
    website: "https://mandalorian.example.com/path",
    status: "active",
    created_at: "2025-01-15T00:00:00Z",
    roles: [
      {
        id: "00000000-0000-4000-8000-000000000010",
        name: "Moderator",
        description: "Moderates content",
        is_protected: false,
      },
    ],
  };

  it("checks page-level access before creating an authenticated client", async () => {
    mocks.getCouncilUserAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    await expect(CouncilUserDetailPage({ params: { id: userId } })).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed user id before creating the client", async () => {
    await expect(CouncilUserDetailPage({ params: { id: "not-a-uuid" } })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("distinguishes a missing RPC row from a safe query failure", async () => {
    queueRpc("council_get_user", ok(null));
    await expect(
      CouncilUserDetailPage({
        params: { id: "00000000-0000-4000-8000-000000000099" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    queueRpc("council_get_user", failed("private database detail"));
    await expect(CouncilUserDetailPage({ params: { id: userId } })).rejects.toThrow(
      "Council user profile could not be loaded",
    );
  });

  it("uses the singular detail RPC and renders safe profile data", async () => {
    queueRpc("council_get_user", ok(profile));

    const element = await CouncilUserDetailPage({ params: { id: userId } });
    const { container } = render(element);

    expect(screen.getByRole("heading", { name: "Din Djarin" })).toBeInTheDocument();
    expect(screen.getByText("Moderator")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mandalorian.example.com" })).toHaveAttribute(
      "href",
      "https://mandalorian.example.com/path",
    );
    expect(rpcOperations).toEqual([
      {
        name: "council_get_user",
        args: { p_user_id: userId },
      },
    ]);
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
  });

  it("ignores an unsafe website without crashing", async () => {
    queueRpc("council_get_user", ok({ ...profile, website: "javascript:alert(1)" }));

    const element = await CouncilUserDetailPage({ params: { id: userId } });
    render(element);

    expect(screen.queryByRole("link", { name: /alert/ })).toBeNull();
  });

  it("keeps valid role JSON and ignores nullable or malformed entries", async () => {
    queueRpc(
      "council_get_user",
      ok({
        ...profile,
        display_name: null,
        status: "paused",
        created_at: null,
        roles: [
          null,
          { id: "invalid-role", name: "Missing protection", description: null },
          {
            id: "00000000-0000-4000-8000-000000000011",
            name: "Reviewer",
            description: null,
            is_protected: true,
          },
        ],
      }),
    );

    const element = await CouncilUserDetailPage({ params: { id: userId } });
    render(element);

    expect(screen.getByRole("heading", { name: "Unnamed member" })).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.queryByText("Missing protection")).toBeNull();
    expect(screen.getByText(/Joined/)).toHaveTextContent("Joined Unknown");
  });

  it("renders an empty role state for nullable role JSON", async () => {
    queueRpc("council_get_user", ok({ ...profile, roles: null }));

    const element = await CouncilUserDetailPage({ params: { id: userId } });
    render(element);

    expect(screen.getByText("This member has no assigned roles.")).toBeInTheDocument();
  });

  it("renders only the management controls granted by current permissions", async () => {
    mocks.getCurrentAuthorization.mockResolvedValue({
      permissionNames: ["admin.manage_roles", "moderation.suspend"],
      userId: secondUserId,
    });
    rolesResult = ok([
      {
        id: "00000000-0000-4000-8000-000000000010",
        name: "Moderator",
        description: "Moderates content",
        is_protected: false,
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        name: "Member",
        description: null,
        is_protected: false,
      },
    ]);
    queueRpc("council_get_user", ok(profile));

    const element = await CouncilUserDetailPage({ params: { id: userId } });
    render(element);

    expect(screen.getByRole("heading", { name: "Manage user" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change status" })).toHaveTextContent(
      "Suspend account",
    );
    expect(screen.getByRole("combobox", { name: "Change status" })).not.toHaveTextContent(
      "Ban account",
    );
    expect(screen.getByRole("option", { name: "Member" })).toBeInTheDocument();
    expect(mocks.rolesSelect).toHaveBeenCalledWith("id, name, description, is_protected");
    expect(mocks.rolesOrder).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("fails safely when assignable roles cannot be loaded", async () => {
    mocks.getCurrentAuthorization.mockResolvedValue({
      permissionNames: ["admin.manage_roles"],
      userId: secondUserId,
    });
    rolesResult = failed("private role lookup detail");
    queueRpc("council_get_user", ok(profile));

    await expect(CouncilUserDetailPage({ params: { id: userId } })).rejects.toThrow(
      "Council roles could not be loaded",
    );
  });

  it("does not offer impossible status or role actions on the current actor", async () => {
    mocks.getCurrentAuthorization.mockResolvedValue({
      permissionNames: [
        "admin.manage_roles",
        "admin.manage_protected_roles",
        "moderation.suspend",
        "moderation.ban",
      ],
      userId,
    });
    queueRpc("council_get_user", ok(profile));

    const element = await CouncilUserDetailPage({ params: { id: userId } });
    render(element);

    expect(
      screen.getByText("You cannot change your own account status or role assignments."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Change status" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Assign role" })).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
