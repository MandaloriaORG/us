import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  loadClanDetail,
  loadClanInvitation,
  loadClanList,
  loadInternalRoles,
  loadRankList,
} from "@/lib/clans/loaders";

const clanId = "00000000-0000-4000-8000-000000000001";

interface RpcAnswer {
  data: unknown;
  error: { code: string; message: string } | null;
}

const rpcAnswers: RpcAnswer[] = [];

function queueRpc(data: unknown) {
  rpcAnswers.push({ data, error: null });
}

function rpcBuilder(answer: RpcAnswer) {
  return {
    maybeSingle: () =>
      Promise.resolve({
        data: Array.isArray(answer.data) ? (answer.data[0] ?? null) : answer.data,
        error: answer.error,
      }),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: answer.data, error: answer.error }).then(onFulfilled),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcAnswers.length = 0;
  mocks.createClient.mockResolvedValue({
    rpc: mocks.rpc,
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrls: vi.fn().mockResolvedValue({
          data: [
            {
              path: "the-forge/emblem.webp",
              signedUrl: "https://cdn.example/x",
              error: null,
            },
          ],
          error: null,
        }),
      }),
    },
  });
  mocks.rpc.mockImplementation(() => rpcBuilder(rpcAnswers.shift() ?? { data: null, error: null }));
});

describe("loadClanList", () => {
  it("returns the clan rows", async () => {
    queueRpc([{ id: clanId, slug: "the-forge", name: "The Forge", member_count: 2 }]);

    await expect(loadClanList()).resolves.toMatchObject({
      status: "ok",
      data: [{ slug: "the-forge", name: "The Forge" }],
    });
  });

  it("degrades to an error", async () => {
    mocks.rpc.mockRejectedValue(new Error("db down"));
    await expect(loadClanList()).resolves.toEqual({ status: "error" });
  });
});

describe("loadClanDetail", () => {
  it("loads the clan, its members and a signed emblem URL", async () => {
    queueRpc({
      id: clanId,
      slug: "the-forge",
      name: "The Forge",
      emblem_path: "the-forge/emblem.webp",
      can_manage: true,
    });
    queueRpc([
      { member_id: "00000000-0000-4000-8000-000000000002", display_name: "Din", role: "leader" },
    ]);

    const result = await loadClanDetail("the-forge");

    expect(result).toMatchObject({ status: "ok" });
    if (result.status === "ok") {
      expect(result.clan).toMatchObject({ name: "The Forge", can_manage: true });
      expect(result.clan.emblemUrl).toBe("https://cdn.example/x");
      expect(result.members[0]).toMatchObject({ display_name: "Din" });
    }
  });

  it("reports not_found for a missing clan", async () => {
    queueRpc(null);
    await expect(loadClanDetail("missing")).resolves.toEqual({ status: "not_found" });
  });

  it("degrades to an error", async () => {
    mocks.rpc.mockRejectedValue(new Error("db down"));
    await expect(loadClanDetail("the-forge")).resolves.toEqual({ status: "error" });
  });
});

describe("loadInternalRoles", () => {
  it("returns roles for the leader", async () => {
    queueRpc([
      {
        internal_role_id: clanId,
        name: "Archivist",
        permissions: ["clan.announce"],
        member_count: 1,
      },
    ]);

    await expect(loadInternalRoles(clanId)).resolves.toMatchObject({
      status: "ok",
      roles: [{ name: "Archivist" }],
    });
  });

  it("maps a permission denial to a denied state", async () => {
    rpcAnswers.push({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(loadInternalRoles(clanId)).resolves.toEqual({ status: "denied" });
  });
});

describe("loadRankList", () => {
  it("returns ranks ordered as the RPC provides them", async () => {
    queueRpc([{ slug: "master", name: "Master", status: "active", sort_order: 1 }]);

    await expect(loadRankList()).resolves.toMatchObject({
      status: "ok",
      data: [{ slug: "master", name: "Master" }],
    });
  });
});

describe("loadClanInvitation", () => {
  it("finds the clan invitation from the caller's notifications", async () => {
    queueRpc([
      {
        notification_id: "20000000-0000-4000-8000-000000000001",
        type: "clan_invite",
        payload: {
          clan_id: clanId,
          clan_slug: "the-forge",
          membership_id: "20000000-0000-4000-8000-000000000002",
        },
        read_at: null,
        created_at: "2025-01-01",
      },
    ]);

    await expect(loadClanInvitation(clanId)).resolves.toEqual({
      membershipId: "20000000-0000-4000-8000-000000000002",
      clanSlug: "the-forge",
    });
  });

  it("ignores notifications for other clans or other types", async () => {
    queueRpc([
      {
        notification_id: "20000000-0000-4000-8000-000000000001",
        type: "friend_request",
        payload: { clan_id: clanId },
        read_at: null,
        created_at: "2025-01-01",
      },
      {
        notification_id: "20000000-0000-4000-8000-000000000002",
        type: "clan_invite",
        payload: { clan_id: "99999999-0000-4000-8000-000000000009", membership_id: "x" },
        read_at: null,
        created_at: "2025-01-01",
      },
    ]);

    await expect(loadClanInvitation(clanId)).resolves.toBeNull();
  });

  it("returns null when notifications cannot be read", async () => {
    mocks.rpc.mockRejectedValue(new Error("db down"));
    await expect(loadClanInvitation(clanId)).resolves.toBeNull();
  });
});
