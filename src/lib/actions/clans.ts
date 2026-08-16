"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { EmblemImageError, emblemImageMessage, processEmblemImage } from "@/lib/clans/emblem-image";
import {
  databaseFailure,
  invalidInput,
  revalidate,
  RETRY_RESULT,
  type ClanActionResult,
} from "@/lib/clans/errors";
import {
  badgeStatusSchema,
  clanMemberRoleSchema,
  clanPrivacySchema,
  clanStatusSchema,
  evidenceVisibilitySchema,
  hexColorSchema,
  internalPermissionsSchema,
  nameSchema,
  optionalText,
  rankStatusSchema,
  reasonSchema,
  slugSchema,
  uuidSchema,
} from "@/lib/clans/schemas";

const EMBLEM_BUCKET = "clan-emblems";
const EMBLEM_SIGNED_URL_TTL_SECONDS = 300;

const CLAN_NAME = nameSchema(80, "Name");
const DESCRIPTION = optionalText(1000, "Description");
const MISSION = optionalText(2000, "Mission");
const ROLE_NAME = nameSchema(60, "Role name");
const ROLE_DESCRIPTION = optionalText(500, "Description");
const RANK_NAME = nameSchema(60, "Name");
const RANK_DESCRIPTION = optionalText(500, "Description");
const BADGE_NAME = nameSchema(60, "Name");
const BADGE_DESCRIPTION = optionalText(500, "Description");
const NOTE = optionalText(500, "Note");
const EVIDENCE = optionalText(500, "Evidence reference");
const SHORT_SLUG = slugSchema.pipe(z.string().max(40, "Slug must be at most 40 characters"));

function refresh(paths: string[]) {
  revalidate(() => {
    for (const path of paths) revalidatePath(path);
  });
}

const CLAN_PATHS = (slug: string) => ["/clans", `/clans/${slug}`, `/clans/${slug}/manage`];

const IDENTITY_PATHS = (userId: string) => ["/members", `/members/${userId}`];

type RpcResult = { error: ClanActionResult | null; data: Record<string, unknown>[] | null };
type DatabaseFunctions = Database["public"]["Functions"];

async function callRpc<Name extends keyof DatabaseFunctions>(
  rpc: Name,
  args: DatabaseFunctions[Name]["Args"],
): Promise<RpcResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(rpc, args);
    if (error) return { error: databaseFailure(error), data: null };
    return { error: null, data: (data as unknown as Record<string, unknown>[] | null) ?? null };
  } catch (error) {
    return { error: databaseFailure(error), data: null };
  }
}

/* ── Clan administration ──────────────────────────────────────────────────── */

const createClanSchema = z.object({
  slug: slugSchema,
  name: CLAN_NAME,
  description: DESCRIPTION,
  privacy: clanPrivacySchema.default("open"),
  mission: MISSION,
  leaderId: uuidSchema,
});

export async function createClan(input: unknown): Promise<ClanActionResult> {
  const parsed = createClanSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error, data } = await callRpc("admin_create_clan", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_description: parsed.data.description as string,
    p_privacy: parsed.data.privacy,
    p_mission: parsed.data.mission as string,
    p_leader_id: parsed.data.leaderId,
  });
  if (error) return error;
  const clanId = data?.[0]?.clan_id;
  if (typeof clanId !== "string") return RETRY_RESULT;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, value: parsed.data.slug };
}

const updateClanSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  name: CLAN_NAME,
  description: DESCRIPTION,
  privacy: clanPrivacySchema,
  mission: MISSION,
});

export async function updateClan(input: unknown): Promise<ClanActionResult> {
  const parsed = updateClanSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("admin_update_clan", {
    p_clan_id: parsed.data.clanId,
    p_name: parsed.data.name,
    p_description: parsed.data.description as string,
    p_privacy: parsed.data.privacy,
    p_mission: parsed.data.mission as string,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, value: parsed.data.clanId };
}

const setClanStatusSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  expectedStatus: clanStatusSchema,
  status: clanStatusSchema,
  reason: reasonSchema,
});

export async function setClanStatus(input: unknown): Promise<ClanActionResult> {
  const parsed = setClanStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("admin_set_clan_status", {
    p_clan_id: parsed.data.clanId,
    p_expected_status: parsed.data.expectedStatus,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true };
}

/** Upload a new emblem: server-side re-encode, service-role upload, then a
 * compare-and-swap pointer update — exactly the avatar pipeline. */
export async function uploadClanEmblem(
  _prevState: ClanActionResult | null,
  formData: FormData,
): Promise<ClanActionResult> {
  const clanId = String(formData.get("clanId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const expectedPath = String(formData.get("expectedEmblemPath") ?? "");

  if (!uuidSchema.safeParse(clanId).success || !slugSchema.safeParse(slug).success) {
    return RETRY_RESULT;
  }

  try {
    const supabase = await createClient();
    const { data: clan, error: clanError } = await supabase
      .rpc("get_clan", { p_slug: slug })
      .maybeSingle<{ id: string; can_manage: boolean }>();
    if (clanError || !clan) return databaseFailure(clanError ?? new Error("clan missing"));
    if (!clan.can_manage) {
      return { ok: false, code: "access_denied", message: "You cannot manage this clan." };
    }
    if (clan.id !== clanId) return RETRY_RESULT;

    const file = formData.get("emblem");
    if (
      !file ||
      typeof file !== "object" ||
      !("size" in file) ||
      !("arrayBuffer" in file) ||
      typeof file.arrayBuffer !== "function"
    ) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Choose an emblem image.",
        fieldErrors: { emblem: "Choose an emblem image." },
      };
    }

    let processed: Buffer;
    try {
      processed = await processEmblemImage(file);
    } catch (imageError) {
      const message =
        imageError instanceof EmblemImageError
          ? emblemImageMessage(imageError)
          : "We could not read that emblem image.";
      return { ok: false, code: "invalid_input", message, fieldErrors: { emblem: message } };
    }

    const newPath = `${clanId}/${randomUUID()}.webp`;
    const storageAdmin = createAdminClient();
    const { error: uploadError } = await storageAdmin.storage
      .from(EMBLEM_BUCKET)
      .upload(newPath, processed, {
        cacheControl: String(EMBLEM_SIGNED_URL_TTL_SECONDS),
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) return RETRY_RESULT;

    try {
      // Migration 0018's `set_clan_emblem` compares with `is not distinct from`
      // but — unlike the avatar RPC — never `nullif`s an empty string, so an
      // empty sentinel would never match a clan with no emblem yet. Send NULL
      // for the initial upload so `NULL is not distinct from NULL` holds.
      const { data: changed, error: changeError } = await supabase.rpc("set_clan_emblem", {
        p_clan_id: clanId,
        p_expected_path: (expectedPath === "" ? null : expectedPath) as string,
        p_new_path: newPath,
      });

      if (changeError || changed !== true) {
        await removeEmblemObject(storageAdmin, newPath);
        return changed === false && !changeError
          ? {
              ok: false,
              code: "conflict",
              message: "The emblem changed in another session. Refresh and try again.",
            }
          : RETRY_RESULT;
      }

      const previousCleaned = expectedPath
        ? await removeEmblemObject(storageAdmin, expectedPath)
        : true;
      refresh(CLAN_PATHS(slug));
      return {
        ok: true,
        message: previousCleaned
          ? "Emblem updated."
          : "Emblem updated. The previous file may need cleanup.",
      };
    } catch {
      await removeEmblemObject(storageAdmin, newPath);
      return RETRY_RESULT;
    }
  } catch {
    return RETRY_RESULT;
  }
}

export async function resetClanEmblem(
  _prevState: ClanActionResult | null,
  formData: FormData,
): Promise<ClanActionResult> {
  const clanId = String(formData.get("clanId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const expectedPath = String(formData.get("expectedEmblemPath") ?? "");

  if (!uuidSchema.safeParse(clanId).success || !slugSchema.safeParse(slug).success) {
    return RETRY_RESULT;
  }
  if (!expectedPath) return RETRY_RESULT;

  try {
    const supabase = await createClient();
    const { data: clan, error: clanError } = await supabase
      .rpc("get_clan", { p_slug: slug })
      .maybeSingle<{ id: string; can_manage: boolean }>();
    if (clanError || !clan) return databaseFailure(clanError ?? new Error("clan missing"));
    if (!clan.can_manage) {
      return { ok: false, code: "access_denied", message: "You cannot manage this clan." };
    }

    const { data: changed, error: changeError } = await supabase.rpc("reset_clan_emblem", {
      p_clan_id: clanId,
      p_expected_path: expectedPath,
    });

    if (changeError) return databaseFailure(changeError);
    if (changed !== true) {
      return {
        ok: false,
        code: "conflict",
        message: "The emblem changed in another session. Refresh and try again.",
      };
    }

    await removeEmblemObject(createAdminClient(), expectedPath);
    refresh(CLAN_PATHS(slug));
    return { ok: true, message: "Emblem removed." };
  } catch {
    return RETRY_RESULT;
  }
}

async function removeEmblemObject(
  client: ReturnType<typeof createAdminClient>,
  path: string,
): Promise<boolean> {
  try {
    const { error } = await client.storage.from(EMBLEM_BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}

/* ── Clan membership ──────────────────────────────────────────────────────── */

export async function requestMembership(input: unknown): Promise<ClanActionResult> {
  const parsed = z.object({ clanId: uuidSchema, slug: slugSchema }).safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error, data } = await callRpc("request_clan_membership", {
    p_clan_id: parsed.data.clanId,
  });
  if (error) return error;
  const status = data?.[0]?.status;
  refresh(CLAN_PATHS(parsed.data.slug));
  return {
    ok: true,
    message:
      status === "pending" ? "Request sent — the leaders will review it." : "You joined this clan.",
  };
}

const inviteSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  memberId: uuidSchema,
  note: NOTE,
});

export async function inviteToClan(input: unknown): Promise<ClanActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("invite_to_clan", {
    p_clan_id: parsed.data.clanId,
    p_member_id: parsed.data.memberId,
    p_note: parsed.data.note as string,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "Invitation sent." };
}

const respondInviteSchema = z.object({
  membershipId: uuidSchema,
  slug: slugSchema,
  accept: z.boolean(),
});

export async function respondToInvite(input: unknown): Promise<ClanActionResult> {
  const parsed = respondInviteSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("respond_to_clan_invite", {
    p_membership_id: parsed.data.membershipId,
    p_accept: parsed.data.accept,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return {
    ok: true,
    message: parsed.data.accept ? "You joined the clan." : "Invitation declined.",
  };
}

const reviewRequestSchema = z.object({
  membershipId: uuidSchema,
  slug: slugSchema,
  accept: z.boolean(),
  reason: optionalText(500, "Reason"),
});

export async function reviewRequest(input: unknown): Promise<ClanActionResult> {
  const parsed = reviewRequestSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("review_clan_request", {
    p_membership_id: parsed.data.membershipId,
    p_accept: parsed.data.accept,
    p_reason: parsed.data.reason as string,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return {
    ok: true,
    message: parsed.data.accept ? "Request accepted." : "Request rejected.",
  };
}

const leaveSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  reason: optionalText(500, "Reason"),
});

export async function leaveClan(input: unknown): Promise<ClanActionResult> {
  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("leave_clan", {
    p_clan_id: parsed.data.clanId,
    p_reason: parsed.data.reason as string,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "You left the clan." };
}

const expelSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  memberId: uuidSchema,
  reason: reasonSchema,
});

export async function expelMember(input: unknown): Promise<ClanActionResult> {
  const parsed = expelSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("expel_clan_member", {
    p_clan_id: parsed.data.clanId,
    p_member_id: parsed.data.memberId,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "Member expelled." };
}

const transferSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  memberId: uuidSchema,
  reason: reasonSchema,
});

export async function transferLeadership(input: unknown): Promise<ClanActionResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("transfer_clan_leadership", {
    p_clan_id: parsed.data.clanId,
    p_new_leader_member_id: parsed.data.memberId,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "Leadership transferred." };
}

const setMemberRoleSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  memberId: uuidSchema,
  role: clanMemberRoleSchema,
  reason: reasonSchema,
});

export async function setMemberRole(input: unknown): Promise<ClanActionResult> {
  const parsed = setMemberRoleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("set_clan_member_role", {
    p_clan_id: parsed.data.clanId,
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "Role updated." };
}

/* ── Internal roles ───────────────────────────────────────────────────────── */

const upsertInternalRoleSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  name: ROLE_NAME,
  description: ROLE_DESCRIPTION,
  permissions: internalPermissionsSchema,
});

export async function upsertInternalRole(input: unknown): Promise<ClanActionResult> {
  const parsed = upsertInternalRoleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("upsert_clan_internal_role", {
    p_clan_id: parsed.data.clanId,
    p_name: parsed.data.name,
    p_description: parsed.data.description as string,
    p_permissions: parsed.data.permissions,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "Role saved." };
}

const removeInternalRoleSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  internalRoleId: uuidSchema,
});

export async function removeInternalRole(input: unknown): Promise<ClanActionResult> {
  const parsed = removeInternalRoleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("remove_clan_internal_role", {
    p_clan_id: parsed.data.clanId,
    p_internal_role_id: parsed.data.internalRoleId,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: "Role removed." };
}

const assignInternalRoleSchema = z.object({
  clanId: uuidSchema,
  slug: slugSchema,
  memberId: uuidSchema,
  internalRoleId: uuidSchema,
  remove: z.boolean().default(false),
});

export async function assignInternalRole(input: unknown): Promise<ClanActionResult> {
  const parsed = assignInternalRoleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("assign_clan_internal_role", {
    p_clan_id: parsed.data.clanId,
    p_member_id: parsed.data.memberId,
    p_internal_role_id: parsed.data.internalRoleId,
    p_remove: parsed.data.remove,
  });
  if (error) return error;
  refresh(CLAN_PATHS(parsed.data.slug));
  return { ok: true, message: parsed.data.remove ? "Assignment removed." : "Role assigned." };
}

/* ── Ranks ────────────────────────────────────────────────────────────────── */

const upsertRankSchema = z.object({
  slug: SHORT_SLUG,
  name: RANK_NAME,
  description: RANK_DESCRIPTION,
  color: hexColorSchema,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export async function upsertRank(input: unknown): Promise<ClanActionResult> {
  const parsed = upsertRankSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("admin_upsert_rank", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_description: parsed.data.description as string,
    p_color: parsed.data.color as string,
    p_sort_order: parsed.data.sortOrder,
  });
  if (error) return error;
  refresh(["/clans/ranks"]);
  return { ok: true, value: parsed.data.slug };
}

const setRankStatusSchema = z.object({
  slug: SHORT_SLUG,
  expectedStatus: rankStatusSchema,
  status: rankStatusSchema,
  reason: reasonSchema,
});

export async function setRankStatus(input: unknown): Promise<ClanActionResult> {
  const parsed = setRankStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("admin_set_rank_status", {
    p_slug: parsed.data.slug,
    p_expected_status: parsed.data.expectedStatus,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(["/clans/ranks", "/members"]);
  return { ok: true };
}

const assignRankSchema = z.object({
  userId: uuidSchema,
  rankSlug: SHORT_SLUG,
  reason: reasonSchema,
});

export async function assignRank(input: unknown): Promise<ClanActionResult> {
  const parsed = assignRankSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("assign_rank", {
    p_user_id: parsed.data.userId,
    p_rank_slug: parsed.data.rankSlug,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(["/clans/ranks", ...IDENTITY_PATHS(parsed.data.userId)]);
  return { ok: true, message: "Rank assigned." };
}

const removeRankSchema = z.object({
  userId: uuidSchema,
  reason: reasonSchema,
});

export async function removeRank(input: unknown): Promise<ClanActionResult> {
  const parsed = removeRankSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("remove_rank", {
    p_user_id: parsed.data.userId,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(["/clans/ranks", ...IDENTITY_PATHS(parsed.data.userId)]);
  return { ok: true, message: "Rank removed." };
}

/* ── Badges ───────────────────────────────────────────────────────────────── */

const upsertBadgeSchema = z.object({
  slug: SHORT_SLUG,
  name: BADGE_NAME,
  description: BADGE_DESCRIPTION,
  requiredIssuerPermission: optionalText(60, "Issuer permission"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export async function upsertBadge(input: unknown): Promise<ClanActionResult> {
  const parsed = upsertBadgeSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("admin_upsert_badge", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_description: parsed.data.description as string,
    p_required_issuer_permission: parsed.data.requiredIssuerPermission as string,
    p_sort_order: parsed.data.sortOrder,
  });
  if (error) return error;
  refresh(["/clans/badges"]);
  return { ok: true, value: parsed.data.slug };
}

const setBadgeStatusSchema = z.object({
  slug: SHORT_SLUG,
  expectedStatus: badgeStatusSchema,
  status: badgeStatusSchema,
  reason: reasonSchema,
});

export async function setBadgeStatus(input: unknown): Promise<ClanActionResult> {
  const parsed = setBadgeStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("admin_set_badge_status", {
    p_slug: parsed.data.slug,
    p_expected_status: parsed.data.expectedStatus,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(["/clans/badges", "/members"]);
  return { ok: true };
}

const awardBadgeSchema = z.object({
  userId: uuidSchema,
  badgeSlug: SHORT_SLUG,
  reason: reasonSchema,
  evidenceRef: EVIDENCE,
  evidenceVisibility: evidenceVisibilitySchema.default("public"),
});

export async function awardBadge(input: unknown): Promise<ClanActionResult> {
  const parsed = awardBadgeSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("award_badge", {
    p_user_id: parsed.data.userId,
    p_badge_slug: parsed.data.badgeSlug,
    p_reason: parsed.data.reason,
    p_evidence_ref: parsed.data.evidenceRef as string,
    p_evidence_visibility: parsed.data.evidenceVisibility,
  });
  if (error) return error;
  refresh(["/clans/badges", ...IDENTITY_PATHS(parsed.data.userId)]);
  return { ok: true, message: "Badge awarded." };
}

const revokeBadgeSchema = z.object({
  userBadgeId: uuidSchema,
  userId: uuidSchema,
  reason: reasonSchema,
});

export async function revokeBadge(input: unknown): Promise<ClanActionResult> {
  const parsed = revokeBadgeSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("revoke_badge", {
    p_user_badge_id: parsed.data.userBadgeId,
    p_reason: parsed.data.reason,
  });
  if (error) return error;
  refresh(["/clans/badges", ...IDENTITY_PATHS(parsed.data.userId)]);
  return { ok: true, message: "Badge revoked." };
}

/* ── Friends and blocks ───────────────────────────────────────────────────── */

const sendFriendSchema = z.object({
  addresseeId: uuidSchema,
  note: NOTE,
});

export async function sendFriendRequest(input: unknown): Promise<ClanActionResult> {
  const parsed = sendFriendSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("send_friend_request", {
    p_addressee_id: parsed.data.addresseeId,
    p_note: parsed.data.note as string,
  });
  if (error) return error;
  refresh(["/clans/connections", ...IDENTITY_PATHS(parsed.data.addresseeId)]);
  return { ok: true, message: "Friend request sent." };
}

const respondFriendSchema = z.object({
  friendshipId: uuidSchema,
  peerId: uuidSchema,
  accept: z.boolean(),
});

export async function respondFriendRequest(input: unknown): Promise<ClanActionResult> {
  const parsed = respondFriendSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("respond_friend_request", {
    p_friendship_id: parsed.data.friendshipId,
    p_accept: parsed.data.accept,
  });
  if (error) return error;
  refresh(["/clans/connections", ...IDENTITY_PATHS(parsed.data.peerId)]);
  return {
    ok: true,
    message: parsed.data.accept ? "Request accepted." : "Request rejected.",
  };
}

const friendshipSchema = z.object({
  friendshipId: uuidSchema,
  peerId: uuidSchema,
});

export async function cancelFriendRequest(input: unknown): Promise<ClanActionResult> {
  const parsed = friendshipSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("cancel_friend_request", {
    p_friendship_id: parsed.data.friendshipId,
  });
  if (error) return error;
  refresh(["/clans/connections", ...IDENTITY_PATHS(parsed.data.peerId)]);
  return { ok: true, message: "Request cancelled." };
}

export async function removeFriend(input: unknown): Promise<ClanActionResult> {
  const parsed = friendshipSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("remove_friend", {
    p_friendship_id: parsed.data.friendshipId,
  });
  if (error) return error;
  refresh(["/clans/connections", ...IDENTITY_PATHS(parsed.data.peerId)]);
  return { ok: true, message: "Friend removed." };
}

const blockSchema = z.object({
  blockedId: uuidSchema,
  reason: optionalText(500, "Reason"),
});

export async function blockUser(input: unknown): Promise<ClanActionResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("block_user", {
    p_blocked_id: parsed.data.blockedId,
    p_reason: parsed.data.reason as string,
  });
  if (error) return error;
  refresh(["/clans/connections", ...IDENTITY_PATHS(parsed.data.blockedId)]);
  return { ok: true, message: "Member blocked." };
}

const blockedIdSchema = z.object({ blockedId: uuidSchema });

export async function unblockUser(input: unknown): Promise<ClanActionResult> {
  const parsed = blockedIdSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await callRpc("unblock_user", {
    p_blocked_id: parsed.data.blockedId,
  });
  if (error) return error;
  refresh(["/clans/connections", ...IDENTITY_PATHS(parsed.data.blockedId)]);
  return { ok: true, message: "Member unblocked." };
}
