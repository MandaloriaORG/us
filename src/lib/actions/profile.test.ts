import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminStorageFrom: vi.fn(),
  can: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createSignedUrls: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  processAvatarImage: vi.fn(),
  remove: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/app/profile/avatar-image", () => {
  class AvatarImageError extends Error {
    constructor(readonly code: string) {
      super(code);
      this.name = "AvatarImageError";
    }
  }

  return {
    AvatarImageError,
    processAvatarImage: mocks.processAvatarImage,
  };
});
vi.mock("@/lib/permissions", () => ({ can: mocks.can }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { AvatarImageError } from "@/app/profile/avatar-image";
import {
  getCurrentProfile,
  getProfileById,
  listMemberProfiles,
  resetAvatar,
  updateProfile,
  uploadAvatar,
} from "@/lib/actions/profile";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

const memberId = "00000000-0000-4000-8000-000000000001";
const oldAvatarPath = `${memberId}/00000000-0000-4000-8000-000000000002.webp`;

let currentProfileResult: QueryResult;
let memberProfileResult: QueryResult;
let memberListResult: QueryResult;
let setAvatarResult: QueryResult;
let resetAvatarResult: QueryResult;
let updateResult: QueryResult;
let updatePayload: Record<string, unknown> | undefined;
let selectValues: string[];

function form(
  values: Partial<Record<"bio" | "displayName" | "profileVisibility" | "website", string>> = {},
) {
  const data = new FormData();
  data.set("displayName", values.displayName ?? "Din Djarin");
  data.set("bio", values.bio ?? "Bounty hunter");
  data.set("website", values.website ?? "https://example.com");
  data.set("profileVisibility", values.profileVisibility ?? "public");
  return data;
}

function avatarForm(expectedPath = "") {
  const data = new FormData();
  data.set("expectedAvatarPath", expectedPath);
  data.set("avatar", new File(["image"], "avatar.png", { type: "image/png" }));
  return data;
}

function createProfileQuery() {
  let operation: "read" | "update" = "read";
  const result = () => (operation === "update" ? updateResult : currentProfileResult);
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(result())),
    select: vi.fn(),
    update: vi.fn(),
  };

  query.eq.mockReturnValue(query);
  query.select.mockImplementation((value: string) => {
    selectValues.push(value);
    return query;
  });
  query.update.mockImplementation((value: Record<string, unknown>) => {
    operation = "update";
    updatePayload = value;
    return query;
  });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  updatePayload = undefined;
  selectValues = [];
  currentProfileResult = {
    data: {
      id: memberId,
      display_name: "Din Djarin",
      avatar_path: oldAvatarPath,
      bio: "Bounty hunter",
      website: "https://example.com/",
      profile_visibility: "public",
    },
    error: null,
  };
  memberProfileResult = {
    data: {
      id: memberId,
      display_name: "Din Djarin",
      avatar_path: oldAvatarPath,
      bio: "Bounty hunter",
      website: "https://example.com/",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      role_names: ["Member"],
    },
    error: null,
  };
  memberListResult = {
    data: [
      {
        id: memberId,
        display_name: "Din Djarin",
        avatar_path: oldAvatarPath,
        bio: "Bounty hunter",
        website: "https://example.com/",
        created_at: "2025-01-01T00:00:00.000Z",
        role_names: ["Member"],
        total_count: 1,
      },
    ],
    error: null,
  };
  setAvatarResult = { data: true, error: null };
  resetAvatarResult = { data: true, error: null };
  updateResult = { data: { id: memberId }, error: null };

  mocks.can.mockResolvedValue({ allowed: true });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: memberId } },
    error: null,
  });
  mocks.processAvatarImage.mockResolvedValue(Buffer.from("webp"));
  mocks.createSignedUrls.mockImplementation((paths: string[], expiresIn: number) =>
    Promise.resolve({
      data: paths.map((path) => ({
        error: null,
        path,
        signedUrl: `https://storage.test/${path}?ttl=${expiresIn}`,
      })),
      error: null,
    }),
  );
  mocks.upload.mockResolvedValue({ data: { path: "uploaded" }, error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
  mocks.storageFrom.mockReturnValue({
    createSignedUrls: mocks.createSignedUrls,
  });
  mocks.adminStorageFrom.mockReturnValue({ remove: mocks.remove, upload: mocks.upload });
  mocks.createAdminClient.mockReturnValue({
    storage: { from: mocks.adminStorageFrom },
  });
  mocks.from.mockImplementation(() => createProfileQuery());
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "get_member_profile") {
      return { maybeSingle: () => Promise.resolve(memberProfileResult) };
    }
    if (name === "list_member_profiles") return Promise.resolve(memberListResult);
    if (name === "set_profile_avatar") return Promise.resolve(setAvatarResult);
    if (name === "reset_profile_avatar") return Promise.resolve(resetAvatarResult);
    throw new Error(`Unexpected RPC ${name}`);
  });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  });
});

describe("updateProfile", () => {
  it.each([
    ["not_authenticated", "You must be signed in"],
    ["account_suspended", "cannot edit profiles"],
    ["account_banned", "cannot edit profiles"],
    ["profile_not_found", "profile is unavailable"],
    ["missing_permission", "do not have permission"],
    ["verification_failed", "could not verify"],
  ])("fails closed for %s", async (reason, message) => {
    mocks.can.mockResolvedValue({ allowed: false, reason });

    await expect(updateProfile(null, form())).resolves.toEqual({
      error: expect.stringContaining(message),
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("normalizes and allowlists editable fields including privacy", async () => {
    const data = form({
      displayName: "  Din   Djarin  ",
      bio: "  Line one\r\nLine\u0000 two  ",
      website: " https://example.com/path ",
      profileVisibility: "members",
    });
    data.set("status", "active");
    data.set("role", "administrator");
    data.set("avatar_path", oldAvatarPath);

    await expect(updateProfile(null, data)).resolves.toEqual({ success: "Profile updated." });
    expect(updatePayload).toEqual({
      display_name: "Din Djarin",
      bio: "Line one\nLine two",
      website: "https://example.com/path",
      profile_visibility: "members",
    });
    expect(updatePayload).not.toHaveProperty("status");
    expect(updatePayload).not.toHaveProperty("role");
    expect(updatePayload).not.toHaveProperty("avatar_path");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects invalid privacy and unsafe text before creating a client", async () => {
    const privacyResult = await updateProfile(null, form({ profileVisibility: "staff-only" }));
    const displayResult = await updateProfile(null, form({ displayName: "Din\nDjarin" }));
    const bioResult = await updateProfile(null, form({ bio: "A".repeat(10_000) }));

    expect(privacyResult.fieldErrors?.profileVisibility).toBeDefined();
    expect(displayResult.fieldErrors?.displayName).toMatch(/unsupported characters/i);
    expect(bioResult.fieldErrors?.bio).toMatch(/at most 500/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["ftp://example.com", "https://user:secret@example.com", "not a URL"])(
    "rejects unsafe website value %s",
    async (website) => {
      const result = await updateProfile(null, form({ website }));
      expect(result.fieldErrors?.website).toBeDefined();
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );

  it("turns empty optional values into null", async () => {
    await updateProfile(null, form({ bio: "   ", website: "   " }));
    expect(updatePayload).toMatchObject({ bio: null, website: null });
  });

  it("does not expose database errors or claim success for zero updated rows", async () => {
    updateResult = { data: null, error: { message: "sensitive database detail" } };
    const failed = await updateProfile(null, form());
    expect(failed).toEqual({ error: "Profile changes could not be saved. Try again." });
    expect(JSON.stringify(failed)).not.toContain("sensitive database detail");

    updateResult = { data: null, error: null };
    await expect(updateProfile(null, form())).resolves.toEqual({
      error: "Profile changes could not be saved. Try again.",
    });
  });
});

describe("profile reads", () => {
  it("distinguishes unauthenticated, denied, and query-failure states", async () => {
    mocks.can.mockResolvedValueOnce({ allowed: false, reason: "not_authenticated" });
    await expect(getCurrentProfile()).resolves.toEqual({ status: "unauthenticated" });

    mocks.can.mockResolvedValueOnce({ allowed: false, reason: "verification_failed" });
    await expect(getCurrentProfile()).resolves.toMatchObject({
      status: "denied",
      reason: "verification_failed",
    });

    currentProfileResult = { data: null, error: { message: "database unavailable" } };
    await expect(getCurrentProfile()).resolves.toEqual({ status: "error" });
  });

  it("loads own privacy and resolves a 300-second signed avatar without persisting it", async () => {
    const result = await getCurrentProfile();

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        avatar_path: oldAvatarPath,
        avatarUrl: expect.stringContaining(oldAvatarPath),
        profile_visibility: "public",
      },
    });
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([oldAvatarPath], 300);
    expect(updatePayload).toBeUndefined();
  });

  it("rejects malformed IDs and uses the narrow member RPC", async () => {
    await expect(getProfileById("not-a-uuid")).resolves.toEqual({ status: "not_found" });
    expect(mocks.createClient).not.toHaveBeenCalled();

    const result = await getProfileById(memberId);
    expect(result).toMatchObject({
      status: "ok",
      profile: { display_name: "Din Djarin", roles: ["Member"] },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_member_profile", { p_user_id: memberId });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("treats invisible and failed member RPC results differently", async () => {
    memberProfileResult = { data: null, error: null };
    await expect(getProfileById(memberId)).resolves.toEqual({ status: "not_found" });

    memberProfileResult = { data: null, error: { message: "provider detail" } };
    await expect(getProfileById(memberId)).resolves.toEqual({ status: "error" });
  });

  it("bounds and paginates member list RPC calls", async () => {
    const result = await listMemberProfiles({ search: " Din ", page: 3 });

    expect(mocks.rpc).toHaveBeenCalledWith("list_member_profiles", {
      p_search: "Din",
      p_limit: 25,
      p_offset: 50,
    });
    expect(result).toMatchObject({
      status: "ok",
      totalCount: 1,
      page: 3,
      pageSize: 25,
      profiles: [{ avatarUrl: expect.stringContaining(oldAvatarPath), roles: ["Member"] }],
    });
  });

  it("rejects out-of-bounds member queries before creating a client", async () => {
    await expect(listMemberProfiles({ search: "A".repeat(51), page: 1 })).resolves.toEqual({
      status: "invalid",
    });
    await expect(listMemberProfiles({ page: 40_002 })).resolves.toEqual({ status: "invalid" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("avatar mutations", () => {
  it("uploads processed WebP and performs the initial empty-sentinel CAS", async () => {
    await expect(uploadAvatar(null, avatarForm())).resolves.toEqual({
      success: "Avatar updated.",
      warning: undefined,
    });

    const uploadedPath = mocks.upload.mock.calls[0]?.[0] as string;
    expect(uploadedPath).toMatch(new RegExp(`^${memberId}/[0-9a-f-]{36}\\.webp$`));
    expect(mocks.processAvatarImage).toHaveBeenCalledOnce();
    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(mocks.adminStorageFrom).toHaveBeenCalledWith("avatars");
    expect(mocks.upload).toHaveBeenCalledWith(
      uploadedPath,
      Buffer.from("webp"),
      expect.objectContaining({ contentType: "image/webp", upsert: false }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("set_profile_avatar", {
      p_expected_path: "",
      p_new_path: uploadedPath,
    });
  });

  it("deletes the previous object only after a successful CAS", async () => {
    await uploadAvatar(null, avatarForm(oldAvatarPath));

    expect(mocks.remove).toHaveBeenCalledWith([oldAvatarPath]);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.rpc.mock.invocationCallOrder.at(-1) ?? 0,
    );
  });

  it("deletes a losing upload and reports a stale CAS", async () => {
    setAvatarResult = { data: false, error: null };

    await expect(uploadAvatar(null, avatarForm(oldAvatarPath))).resolves.toMatchObject({
      error: expect.stringContaining("another session"),
    });
    const uploadedPath = mocks.upload.mock.calls[0]?.[0] as string;
    expect(mocks.remove).toHaveBeenCalledWith([uploadedPath]);
    expect(mocks.remove).not.toHaveBeenCalledWith([oldAvatarPath]);
  });

  it("reports cleanup failure without rolling back a successful DB change", async () => {
    mocks.remove.mockResolvedValue({ data: null, error: { message: "storage detail" } });

    await expect(uploadAvatar(null, avatarForm(oldAvatarPath))).resolves.toEqual({
      success: "Avatar updated.",
      warning: "The previous avatar may need cleanup.",
    });
  });

  it("never removes the new active object when old-object cleanup throws", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("network failure"));

    await expect(uploadAvatar(null, avatarForm(oldAvatarPath))).resolves.toEqual({
      success: "Avatar updated.",
      warning: "The previous avatar may need cleanup.",
    });
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith([oldAvatarPath]);
  });

  it("maps image failures to stable field errors before Storage access", async () => {
    mocks.processAvatarImage.mockRejectedValue(new AvatarImageError("file_too_large"));

    await expect(uploadAvatar(null, avatarForm())).resolves.toEqual({
      fieldErrors: { avatar: "Avatar image must be 5 MiB or smaller." },
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects forged expected paths before processing", async () => {
    await expect(
      uploadAvatar(
        null,
        avatarForm(
          "00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000002.webp",
        ),
      ),
    ).resolves.toMatchObject({ error: expect.stringContaining("state is invalid") });
    expect(mocks.processAvatarImage).not.toHaveBeenCalled();
  });

  it("resets with CAS before deleting the prior object", async () => {
    const data = new FormData();
    data.set("expectedAvatarPath", oldAvatarPath);

    await expect(resetAvatar(null, data)).resolves.toEqual({
      success: "Avatar removed.",
      warning: undefined,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("reset_profile_avatar", {
      p_expected_path: oldAvatarPath,
    });
    expect(mocks.remove).toHaveBeenCalledWith([oldAvatarPath]);
  });

  it("fails closed before image work for inactive users", async () => {
    mocks.can.mockResolvedValue({ allowed: false, reason: "account_suspended" });

    await expect(uploadAvatar(null, avatarForm())).resolves.toMatchObject({
      error: expect.stringContaining("cannot edit"),
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.processAvatarImage).not.toHaveBeenCalled();
  });
});
