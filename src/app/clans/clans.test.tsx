import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadClanList: vi.fn(),
  loadClanDetail: vi.fn(),
  loadInternalRoles: vi.fn(),
  loadRankList: vi.fn(),
  loadClanInvitation: vi.fn(),
  loadMemberPicker: vi.fn(),
  loadConnections: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
  can: vi.fn(),
  canAny: vi.fn(),
  listMemberProfiles: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/clans/loaders", () => ({
  loadClanList: mocks.loadClanList,
  loadClanDetail: mocks.loadClanDetail,
  loadInternalRoles: mocks.loadInternalRoles,
  loadRankList: mocks.loadRankList,
  loadClanInvitation: mocks.loadClanInvitation,
}));
vi.mock("@/lib/clans/member-picker", () => ({ loadMemberPicker: mocks.loadMemberPicker }));
vi.mock("@/lib/clans/identity", () => ({ loadConnections: mocks.loadConnections }));
vi.mock("@/lib/permissions", () => ({
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
  can: mocks.can,
  canAny: mocks.canAny,
}));
vi.mock("@/lib/actions/profile", () => ({ listMemberProfiles: mocks.listMemberProfiles }));
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: () => [null, vi.fn()],
    useFormStatus: () => ({ pending: false }),
  };
});
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/actions/clans", () => ({
  createClan: vi.fn(),
  updateClan: vi.fn(),
  setClanStatus: vi.fn(),
  uploadClanEmblem: vi.fn(),
  resetClanEmblem: vi.fn(),
  requestMembership: vi.fn(),
  inviteToClan: vi.fn(),
  respondToInvite: vi.fn(),
  leaveClan: vi.fn(),
  expelMember: vi.fn(),
  transferLeadership: vi.fn(),
  setMemberRole: vi.fn(),
  upsertInternalRole: vi.fn(),
  removeInternalRole: vi.fn(),
  assignInternalRole: vi.fn(),
  upsertRank: vi.fn(),
  setRankStatus: vi.fn(),
  assignRank: vi.fn(),
  upsertBadge: vi.fn(),
  setBadgeStatus: vi.fn(),
  awardBadge: vi.fn(),
  revokeBadge: vi.fn(),
  sendFriendRequest: vi.fn(),
  respondFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

import ClansPage from "@/app/clans/page";
import ClanDetailPage from "@/app/clans/[slug]/page";
import ClanManagePage from "@/app/clans/[slug]/manage/page";
import NewClanPage from "@/app/clans/new/page";
import RanksPage from "@/app/clans/ranks/page";
import BadgesPage from "@/app/clans/badges/page";
import ConnectionsPage from "@/app/clans/connections/page";

const clanId = "00000000-0000-4000-8000-000000000001";
const leaderId = "00000000-0000-4000-8000-000000000002";
const memberId = "00000000-0000-4000-8000-000000000003";

function clanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: clanId,
    slug: "the-forge",
    name: "The Forge",
    description: "Where work is shown.",
    privacy: "open" as const,
    mission: "Keep the forge records.",
    leader_id: leaderId,
    leader_display_name: "Din Djarin",
    member_count: 2,
    caller_is_member: false,
    caller_role: null,
    ...overrides,
  };
}

function clanDetail(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok" as const,
    clan: {
      id: clanId,
      slug: "the-forge",
      name: "The Forge",
      description: "Where work is shown.",
      emblem_path: null,
      emblemUrl: null,
      privacy: "open" as const,
      mission: "Keep the forge records.",
      status: "active" as const,
      leader_id: leaderId,
      leader_display_name: "Din Djarin",
      member_count: 2,
      caller_is_member: false,
      caller_role: null,
      can_manage: false,
      ...overrides,
    },
    members: [
      {
        member_id: leaderId,
        display_name: "Din Djarin",
        role: "leader" as const,
        joined_at: "2025-01-01",
      },
      {
        member_id: memberId,
        display_name: "Bo-Katan",
        role: "member" as const,
        joined_at: "2025-01-01",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadClanList.mockResolvedValue({ status: "ok", data: [clanRow()] });
  mocks.loadClanDetail.mockResolvedValue(clanDetail());
  mocks.loadInternalRoles.mockResolvedValue({ status: "ok", roles: [] });
  mocks.loadClanInvitation.mockResolvedValue(null);
  mocks.loadRankList.mockResolvedValue({ status: "ok", data: [] });
  mocks.loadConnections.mockResolvedValue({ status: "ok", requests: [], friends: [], blocks: [] });
  mocks.loadMemberPicker.mockResolvedValue("empty");
  mocks.listMemberProfiles.mockResolvedValue({ status: "empty" });
  mocks.getAuthorizationSnapshot.mockResolvedValue({ allowed: false, reason: "not_authenticated" });
  mocks.can.mockResolvedValue({ allowed: false, reason: "missing_permission" });
  mocks.canAny.mockResolvedValue({ allowed: false, reason: "missing_permission" });
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
});

describe("clan list", () => {
  it("renders the clan rows and their leaders", async () => {
    render(await ClansPage());

    expect(screen.getByRole("heading", { name: "Clans & Casas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /The Forge/ })).toHaveAttribute(
      "href",
      "/clans/the-forge",
    );
    expect(screen.getByText(/Led by Din Djarin/)).toBeInTheDocument();
  });

  it("shows an error state instead of an empty directory on failure", async () => {
    mocks.loadClanList.mockResolvedValue({ status: "error" });

    render(await ClansPage());

    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
  });

  it("offers the create-clan link to administrators only", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["admin.manage_clans"],
      userId: memberId,
    });

    render(await ClansPage());

    expect(screen.getByRole("link", { name: "Create clan" })).toHaveAttribute("href", "/clans/new");
  });
});

describe("clan detail", () => {
  it("renders the header, mission, members and privacy", async () => {
    render(await ClanDetailPage({ params: { slug: "the-forge" } }));

    expect(screen.getByRole("heading", { name: "The Forge" })).toBeInTheDocument();
    expect(screen.getByText(/Keep the forge records/)).toBeInTheDocument();
    expect(screen.getByText("Din Djarin")).toBeInTheDocument();
    expect(screen.getByText("Bo-Katan")).toBeInTheDocument();
    expect(screen.getByText(/2 members/)).toBeInTheDocument();
  });

  it("uses the not-found boundary for invisible clans", async () => {
    mocks.loadClanDetail.mockResolvedValue({ status: "not_found" });

    await expect(ClanDetailPage({ params: { slug: "missing" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("offers to join an open clan to a signed-in non-member", async () => {
    mocks.loadClanDetail.mockResolvedValue(clanDetail());
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: [],
      userId: "50000000-0000-4000-8000-000000000009",
    });

    render(await ClanDetailPage({ params: { slug: "the-forge" } }));

    expect(screen.getByRole("button", { name: "Join clan" })).toBeInTheDocument();
  });

  it("links to the management page for the leader", async () => {
    mocks.loadClanDetail.mockResolvedValue(
      clanDetail({ caller_is_member: true, can_manage: true, caller_role: "leader" }),
    );

    render(await ClanDetailPage({ params: { slug: "the-forge" } }));

    expect(screen.getByRole("link", { name: "Manage clan" })).toHaveAttribute(
      "href",
      "/clans/the-forge/manage",
    );
  });
});

describe("clan management", () => {
  it("restricts management to the leader or an administrator", async () => {
    render(await ClanManagePage({ params: { slug: "the-forge" } }));

    expect(screen.getByRole("heading", { name: "Management restricted" })).toBeInTheDocument();
  });

  it("shows the admin identity form to administrators", async () => {
    mocks.loadClanDetail.mockResolvedValue(
      clanDetail({ can_manage: true, caller_is_member: true, caller_role: "leader" }),
    );
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: ["admin.manage_clans"],
      userId: leaderId,
    });

    render(await ClanManagePage({ params: { slug: "the-forge" } }));

    expect(screen.getByRole("heading", { name: "Identity & privacy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Internal roles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite a member" })).toBeInTheDocument();
  });
});

describe("new clan", () => {
  it("denies non-administrators", async () => {
    render(await NewClanPage({}));

    expect(screen.getByRole("heading", { name: "Administration required" })).toBeInTheDocument();
  });
});

describe("ranks admin", () => {
  it("denies holders without rank.manage", async () => {
    render(await RanksPage({}));

    expect(screen.getByRole("heading", { name: "Administration required" })).toBeInTheDocument();
  });

  it("lists defined ranks for the manager", async () => {
    mocks.can.mockResolvedValue({ allowed: true });
    mocks.loadRankList.mockResolvedValue({
      status: "ok",
      data: [
        {
          slug: "master",
          name: "Master",
          description: "Top.",
          color: null,
          sort_order: 1,
          status: "active",
        },
      ],
    });

    render(await RanksPage({}));

    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New rank" })).toBeInTheDocument();
  });
});

describe("badges admin", () => {
  it("denies holders without badge permissions", async () => {
    render(await BadgesPage({}));

    expect(screen.getByRole("heading", { name: "Administration required" })).toBeInTheDocument();
  });

  it("renders the create and award surfaces for a badge manager", async () => {
    mocks.canAny.mockResolvedValue({ allowed: true });

    render(await BadgesPage({}));

    expect(screen.getByRole("heading", { name: "New badge" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Award a badge" })).toBeInTheDocument();
  });
});

describe("connections", () => {
  it("redirects anonymous visitors to sign in", async () => {
    await expect(ConnectionsPage({})).rejects.toThrow(
      "NEXT_REDIRECT:/auth/login?next=/clans/connections",
    );
  });

  it("renders requests, friends and blocks for a member", async () => {
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      allowed: true,
      permissionNames: [],
      userId: memberId,
    });
    mocks.loadConnections.mockResolvedValue({
      status: "ok",
      requests: [
        {
          friendshipId: "20000000-0000-4000-8000-000000000001",
          peerId: leaderId,
          peerName: "Din Djarin",
          direction: "incoming",
          createdAt: "2025-01-01",
        },
      ],
      friends: [],
      blocks: [],
    });

    render(await ConnectionsPage({}));

    expect(screen.getByRole("heading", { name: "Connections" })).toBeInTheDocument();
    expect(screen.getByText("Din Djarin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
  });
});
