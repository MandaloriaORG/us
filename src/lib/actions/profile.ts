"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AvatarImageError, processAvatarImage } from "@/app/profile/avatar-image";
import type { Database } from "@/lib/database.types";
import { can, type PermissionDenialReason } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const AVATAR_SIGNED_URL_TTL_SECONDS = 300;
const MEMBER_PAGE_SIZE = 25;
const MAX_MEMBER_PAGE = 40_001;

const displayNameSchema = z
  .string({ invalid_type_error: "Enter a display name" })
  .max(50, "Display name must be at most 50 characters")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Display name contains unsupported characters",
  )
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Display name must be at least 2 characters")
      .max(50, "Display name must be at most 50 characters"),
  );

const bioSchema = z
  .string({ invalid_type_error: "Bio must be text" })
  .max(500, "Bio must be at most 500 characters")
  .transform((value) =>
    value
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim(),
  )
  .pipe(z.string().max(500, "Bio must be at most 500 characters"));

const websiteSchema = z
  .string({ invalid_type_error: "Enter a valid website address" })
  .trim()
  .max(2048, "Website address is too long")
  .transform((value, context) => {
    if (!value) return null;

    try {
      const url = new URL(value);
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use an http or https website without credentials",
        });
        return z.NEVER;
      }

      return url.href;
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid website address",
      });
      return z.NEVER;
    }
  });

const updateProfileSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema,
  website: websiteSchema,
  profileVisibility: z.enum(["public", "members", "private"], {
    invalid_type_error: "Choose who can view your profile",
  }),
});

const memberIdSchema = z.string().uuid();
const memberListInputSchema = z.object({
  search: z.string().trim().max(50).default(""),
  page: z.number().int().min(1).max(MAX_MEMBER_PAGE).default(1),
});

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type AvatarStorageClient = { storage: ServerClient["storage"] };
type MemberProfileRow = Database["public"]["Functions"]["get_member_profile"]["Returns"][number];

export interface ProfileResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  warning?: string;
}

function denialMessage(reason: PermissionDenialReason) {
  switch (reason) {
    case "not_authenticated":
      return "You must be signed in to edit your profile.";
    case "account_suspended":
    case "account_banned":
      return "This account cannot edit profiles.";
    case "profile_not_found":
      return "Your profile is unavailable.";
    case "missing_permission":
      return "You do not have permission to edit this profile.";
    case "verification_failed":
      return "We could not verify profile access. Try again.";
  }
}

async function signedAvatarUrls(client: ServerClient, paths: Array<string | null>) {
  const uniquePaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (uniquePaths.length === 0) return new Map<string, string>();

  const { data, error } = await client.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(uniquePaths, AVATAR_SIGNED_URL_TTL_SECONDS);

  if (error || !data) return new Map<string, string>();

  return new Map(
    data.flatMap((item) =>
      item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : [],
    ),
  );
}

function expectedAvatarPath(value: FormDataEntryValue | null, userId: string) {
  if (typeof value !== "string") return { valid: false as const };
  if (!value) return { valid: true as const, path: null };

  const [ownerId, objectName, extra] = value.split("/");
  const validObjectName =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(
      objectName ?? "",
    );

  return ownerId === userId && validObjectName && extra === undefined
    ? { valid: true as const, path: value }
    : { valid: false as const };
}

function avatarImageMessage(error: AvatarImageError) {
  switch (error.code) {
    case "empty_file":
      return "Choose an avatar image.";
    case "file_too_large":
      return "Avatar image must be 5 MiB or smaller.";
    case "too_many_pixels":
      return "Avatar image dimensions are too large.";
    case "unsupported_format":
      return "Use a static JPEG, PNG, or WebP image.";
    case "invalid_image":
      return "We could not read that avatar image.";
  }
}

async function removeAvatarObject(client: AvatarStorageClient, path: string) {
  try {
    const { error } = await client.storage.from(AVATAR_BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}

function revalidateProfileViews() {
  revalidatePath("/", "layout");
  revalidatePath("/members", "layout");
  revalidatePath("/profile/edit");
}

export async function getCurrentProfile() {
  const access = await can("profile.edit.own");

  if (!access.allowed) {
    if (access.reason === "not_authenticated") {
      return { status: "unauthenticated" as const };
    }

    return {
      status: "denied" as const,
      reason: access.reason,
      message: denialMessage(access.reason),
    };
  }

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { status: "error" as const };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_path, bio, website, profile_visibility")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) return { status: "error" as const };
    if (!profile) return { status: "not_found" as const };

    const urls = await signedAvatarUrls(supabase, [profile.avatar_path]);
    return {
      status: "ok" as const,
      profile: {
        ...profile,
        avatarUrl: profile.avatar_path ? (urls.get(profile.avatar_path) ?? null) : null,
      },
    };
  } catch {
    console.error("Current profile could not be loaded.");
    return { status: "error" as const };
  }
}

export async function getProfileById(id: string) {
  if (!memberIdSchema.safeParse(id).success) {
    return { status: "not_found" as const };
  }

  try {
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .rpc("get_member_profile", { p_user_id: id })
      .maybeSingle<MemberProfileRow>();

    if (profileError) return { status: "error" as const };
    if (!profile) return { status: "not_found" as const };

    const urls = await signedAvatarUrls(supabase, [profile.avatar_path]);

    return {
      status: "ok" as const,
      profile: {
        ...profile,
        avatarUrl: profile.avatar_path ? (urls.get(profile.avatar_path) ?? null) : null,
        roles: profile.role_names ?? [],
      },
    };
  } catch {
    console.error("Member profile could not be loaded.");
    return { status: "error" as const };
  }
}

export async function listMemberProfiles(input: { search?: string; page?: number } = {}) {
  const parsed = memberListInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_member_profiles", {
      p_search: parsed.data.search || undefined,
      p_limit: MEMBER_PAGE_SIZE,
      p_offset: (parsed.data.page - 1) * MEMBER_PAGE_SIZE,
    });

    if (error || !data) return { status: "error" as const };

    const urls = await signedAvatarUrls(
      supabase,
      data.map((profile) => profile.avatar_path),
    );

    return {
      status: "ok" as const,
      profiles: data.map((profile) => ({
        ...profile,
        avatarUrl: profile.avatar_path ? (urls.get(profile.avatar_path) ?? null) : null,
        roles: profile.role_names ?? [],
      })),
      totalCount: data[0]?.total_count ?? 0,
      page: parsed.data.page,
      pageSize: MEMBER_PAGE_SIZE,
      search: parsed.data.search,
    };
  } catch {
    console.error("Member directory could not be loaded.");
    return { status: "error" as const };
  }
}

export async function updateProfile(
  _prevState: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const access = await can("profile.edit.own");
  if (!access.allowed) return { error: denialMessage(access.reason) };

  const parsed = updateProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    website: formData.get("website"),
    profileVisibility: formData.get("profileVisibility"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.errors.map((issue) => [issue.path[0] as string, issue.message]),
      ),
    };
  }

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { error: "We could not verify profile access. Try again." };
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        bio: parsed.data.bio || null,
        website: parsed.data.website,
        profile_visibility: parsed.data.profileVisibility,
      })
      .eq("id", authData.user.id)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      return { error: "Profile changes could not be saved. Try again." };
    }

    revalidateProfileViews();
    return { success: "Profile updated." };
  } catch {
    console.error("Profile update failed.");
    return { error: "Profile changes could not be saved. Try again." };
  }
}

export async function uploadAvatar(
  _prevState: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const access = await can("profile.edit.own");
  if (!access.allowed) return { error: denialMessage(access.reason) };

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return { error: "We could not verify profile access. Try again." };
    }

    const expected = expectedAvatarPath(formData.get("expectedAvatarPath"), authData.user.id);
    if (!expected.valid) {
      return { error: "Avatar state is invalid. Refresh and try again." };
    }

    const file = formData.get("avatar");
    if (
      !file ||
      typeof file !== "object" ||
      !("size" in file) ||
      !("arrayBuffer" in file) ||
      typeof file.arrayBuffer !== "function"
    ) {
      return { fieldErrors: { avatar: "Choose an avatar image." } };
    }

    let processed: Buffer;
    try {
      processed = await processAvatarImage(file);
    } catch (error) {
      return {
        fieldErrors: {
          avatar:
            error instanceof AvatarImageError
              ? avatarImageMessage(error)
              : "We could not read that avatar image.",
        },
      };
    }

    const newPath = `${authData.user.id}/${randomUUID()}.webp`;
    const storageAdmin = createAdminClient();
    const { error: uploadError } = await storageAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(newPath, processed, {
        cacheControl: String(AVATAR_SIGNED_URL_TTL_SECONDS),
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) return { error: "Avatar could not be uploaded. Try again." };

    try {
      const { data: changed, error: changeError } = await supabase.rpc("set_profile_avatar", {
        p_expected_path: expected.path ?? "",
        p_new_path: newPath,
      });

      if (changeError || changed !== true) {
        const cleaned = await removeAvatarObject(storageAdmin, newPath);
        return {
          error:
            changed === false && !changeError
              ? "Your avatar changed in another session. Refresh and try again."
              : "Avatar could not be saved. Try again.",
          warning: cleaned ? undefined : "A temporary avatar may need cleanup.",
        };
      }

      const previousCleaned = expected.path
        ? await removeAvatarObject(storageAdmin, expected.path)
        : true;
      revalidateProfileViews();
      return {
        success: "Avatar updated.",
        warning: previousCleaned ? undefined : "The previous avatar may need cleanup.",
      };
    } catch {
      const cleaned = await removeAvatarObject(storageAdmin, newPath);
      return {
        error: "Avatar could not be saved. Try again.",
        warning: cleaned ? undefined : "A temporary avatar may need cleanup.",
      };
    }
  } catch {
    console.error("Avatar upload failed.");
    return { error: "Avatar could not be uploaded. Try again." };
  }
}

export async function resetAvatar(
  _prevState: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  const access = await can("profile.edit.own");
  if (!access.allowed) return { error: denialMessage(access.reason) };

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return { error: "We could not verify profile access. Try again." };
    }

    const expected = expectedAvatarPath(formData.get("expectedAvatarPath"), authData.user.id);
    if (!expected.valid || !expected.path) {
      return { error: "Avatar state is invalid. Refresh and try again." };
    }

    const { data: changed, error: changeError } = await supabase.rpc("reset_profile_avatar", {
      p_expected_path: expected.path,
    });

    if (changeError) return { error: "Avatar could not be removed. Try again." };
    if (changed !== true) {
      return { error: "Your avatar changed in another session. Refresh and try again." };
    }

    const storageAdmin = createAdminClient();
    const cleaned = await removeAvatarObject(storageAdmin, expected.path);
    revalidateProfileViews();
    return {
      success: "Avatar removed.",
      warning: cleaned ? undefined : "The previous avatar may need cleanup.",
    };
  } catch {
    console.error("Avatar reset failed.");
    return { error: "Avatar could not be removed. Try again." };
  }
}
