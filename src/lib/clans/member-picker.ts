import { listMemberProfiles } from "@/lib/actions/profile";

export interface MemberSearchProfile {
  id: string;
  display_name: string;
  avatarUrl: string | null;
}

/** Load the member directory for the clan picker surfaces, or `"empty"` while
 * idle and `"error"` on failure. */
export async function loadMemberPicker(
  search: string,
): Promise<MemberSearchProfile[] | "empty" | "error"> {
  if (!search) return "empty";
  const result = await listMemberProfiles({ search, page: 1 });
  if (result.status === "invalid") return "empty";
  if (result.status === "error") return "error";
  return result.profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    avatarUrl: profile.avatarUrl,
  }));
}
