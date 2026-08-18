import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { loadConnections, loadProfileIdentity, loadSocialState } from "@/lib/clans/identity";

const me = "00000000-0000-4000-8000-000000000001";
const target = "00000000-0000-4000-8000-000000000002";
const friendshipId = "00000000-0000-4000-8000-000000000003";

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
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation(() => rpcBuilder(rpcAnswers.shift() ?? { data: null, error: null }));
});

describe("loadProfileIdentity", () => {
  it("maps the rank and badge rows into display DTOs", async () => {
    queueRpc({ slug: "master", name: "Master", color: "#aabbcc", assigned_at: "2025-01-01" });
    queueRpc([
      {
        badge_id: "20000000-0000-4000-8000-000000000001",
        slug: "historian",
        name: "Historian",
        description: "Kept records.",
        issuer_display_name: "Bo-Katan",
        reason: "Restored the forge.",
        evidence_ref: null,
        evidence_visibility: "private",
        status: "awarded",
        awarded_at: "2025-01-01",
        revoked_reason: null,
        revoked_at: null,
      },
    ]);

    const identity = await loadProfileIdentity(target, false);

    expect(identity).toMatchObject({
      status: "ok",
      rank: { slug: "master", name: "Master", color: "#aabbcc" },
    });
    expect(identity.status === "ok" && identity.badges[0]).toMatchObject({
      name: "Historian",
      issuerName: "Bo-Katan",
      evidenceRef: null,
      evidenceVisibility: "private",
      status: "awarded",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("list_profile_badges", {
      p_user_id: target,
      p_include_private: false,
    });
  });

  it("requests private evidence only when the viewer is entitled", async () => {
    queueRpc(null);
    queueRpc([]);

    await loadProfileIdentity(me, true);

    expect(mocks.rpc).toHaveBeenCalledWith("list_profile_badges", {
      p_user_id: me,
      p_include_private: true,
    });
  });

  it("degrades to an error state when the RPC fails", async () => {
    mocks.rpc.mockRejectedValue(new Error("db down"));

    await expect(loadProfileIdentity(target)).resolves.toEqual({ status: "error" });
  });
});

describe("loadSocialState", () => {
  it("returns none for an anonymous viewer or the viewer's own profile", async () => {
    await expect(loadSocialState(null, target)).resolves.toEqual({ relationship: "none" });
    await expect(loadSocialState(me, me)).resolves.toEqual({ relationship: "none" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("finds an incoming request", async () => {
    queueRpc([
      {
        friendship_id: friendshipId,
        peer_id: target,
        direction: "incoming",
        created_at: "2025-01-01",
      },
    ]);
    queueRpc([]);
    queueRpc([]);

    await expect(loadSocialState(me, target)).resolves.toEqual({
      relationship: "incoming_request",
      friendshipId,
      createdAt: "2025-01-01",
    });
  });

  it("finds an outgoing request", async () => {
    queueRpc([
      {
        friendship_id: friendshipId,
        peer_id: target,
        direction: "outgoing",
        created_at: "2025-01-01",
      },
    ]);
    queueRpc([]);
    queueRpc([]);

    await expect(loadSocialState(me, target)).resolves.toEqual({
      relationship: "outgoing_request",
      friendshipId,
      createdAt: "2025-01-01",
    });
  });

  it("treats a block as the strongest state", async () => {
    queueRpc([]);
    queueRpc([]);
    queueRpc([{ blocked_id: target, created_at: "2025-01-01" }]);

    await expect(loadSocialState(me, target)).resolves.toEqual({
      relationship: "blocked_by_me",
    });
  });

  it("finds an accepted friendship", async () => {
    queueRpc([]);
    queueRpc([{ friend_id: target, friends_since: "2025-01-01" }]);
    queueRpc([]);

    await expect(loadSocialState(me, target)).resolves.toEqual({
      relationship: "friends",
      friendsSince: "2025-01-01",
    });
  });

  it("defaults to none when the lists cannot be read", async () => {
    mocks.rpc.mockRejectedValue(new Error("db down"));

    await expect(loadSocialState(me, target)).resolves.toEqual({ relationship: "none" });
  });
});

describe("loadConnections", () => {
  it("maps the three lists into the connections DTO", async () => {
    queueRpc([
      {
        friendship_id: friendshipId,
        peer_id: target,
        peer_display_name: "Din",
        direction: "incoming",
        created_at: "2025-01-01",
      },
    ]);
    queueRpc([
      {
        friend_id: "30000000-0000-4000-8000-000000000001",
        display_name: "Bo",
        avatar_path: null,
        friends_since: "2025-01-01",
      },
    ]);
    queueRpc([]);

    const connections = await loadConnections();

    expect(connections).toMatchObject({ status: "ok" });
    if (connections.status === "ok") {
      expect(connections.requests[0]).toMatchObject({ peerName: "Din", direction: "incoming" });
      expect(connections.friends[0]).toMatchObject({
        friendId: "30000000-0000-4000-8000-000000000001",
      });
      expect(connections.blocks).toEqual([]);
    }
  });

  it("resolves friend avatar paths to signed URLs", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: mocks.rpc,
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrls: vi.fn().mockResolvedValue({
            data: [
              {
                path: "bo/avatar.webp",
                signedUrl: "https://cdn.test/bo.webp",
                error: null,
              },
            ],
            error: null,
          }),
        }),
      },
    });
    queueRpc([]);
    queueRpc([
      {
        friend_id: "30000000-0000-4000-8000-000000000001",
        display_name: "Bo",
        avatar_path: "bo/avatar.webp",
        friends_since: "2025-01-01",
      },
    ]);
    queueRpc([]);

    const connections = await loadConnections();

    expect(connections.status).toBe("ok");
    if (connections.status === "ok") {
      expect(connections.friends[0]).toMatchObject({
        friendId: "30000000-0000-4000-8000-000000000001",
        avatarPath: "bo/avatar.webp",
        avatarUrl: "https://cdn.test/bo.webp",
      });
    }
  });

  it("degrades to an error state", async () => {
    mocks.rpc.mockRejectedValue(new Error("db down"));

    await expect(loadConnections()).resolves.toEqual({ status: "error" });
  });
});
