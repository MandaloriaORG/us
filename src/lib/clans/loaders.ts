import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

const EMBLEM_BUCKET = "clan-emblems";
const EMBLEM_SIGNED_URL_TTL_SECONDS = 300;

type ListClansRow = Database["public"]["Functions"]["list_clans"]["Returns"][number];
type GetClanRow = Database["public"]["Functions"]["get_clan"]["Returns"][number];
type ListClanMembersRow = Database["public"]["Functions"]["list_clan_members"]["Returns"][number];
type ListInternalRolesRow =
  Database["public"]["Functions"]["list_clan_internal_roles"]["Returns"][number];
type ListRanksRow = Database["public"]["Functions"]["list_ranks"]["Returns"][number];

export type ClanSummary = ListClansRow;
export type ClanDetail = GetClanRow;
export type ClanMemberRow = ListClanMembersRow;
export type InternalRoleRow = ListInternalRolesRow;
export type RankRow = ListRanksRow;

export type LoadResult<T> = { status: "ok"; data: T } | { status: "error" };

async function signedEmblemUrls(
  client: Awaited<ReturnType<typeof createClient>>,
  paths: Array<string | null>,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (uniquePaths.length === 0) return new Map();

  const { data, error } = await client.storage
    .from(EMBLEM_BUCKET)
    .createSignedUrls(uniquePaths, EMBLEM_SIGNED_URL_TTL_SECONDS);

  if (error || !data) return new Map();

  return new Map(
    data.flatMap((item) =>
      item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : [],
    ),
  );
}

export async function loadClanList(): Promise<LoadResult<(ClanSummary & { emblemUrl: string | null })[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_clans");
    if (error || !data) return { status: "error" };

    const emblemUrls = await signedEmblemUrls(
      supabase,
      data.map((clan) => clan.emblem_path),
    );

    const clans = data.map((clan) => ({
      ...clan,
      emblemUrl: clan.emblem_path ? (emblemUrls.get(clan.emblem_path) ?? null) : null,
    }));

    return { status: "ok", data: clans };
  } catch {
    return { status: "error" };
  }
}

export type ClanDetailLoad =
  | {
      status: "ok";
      clan: ClanDetail & { emblemUrl: string | null };
      members: ClanMemberRow[];
    }
  | { status: "not_found" }
  | { status: "error" };

export async function loadClanDetail(slug: string): Promise<ClanDetailLoad> {
  try {
    const supabase = await createClient();
    const { data: clan, error: clanError } = await supabase
      .rpc("get_clan", { p_slug: slug })
      .maybeSingle<GetClanRow>();

    if (clanError) return { status: "error" };
    if (!clan) return { status: "not_found" };

    const [members, emblemUrls] = await Promise.all([
      supabase.rpc("list_clan_members", { p_clan_id: clan.id, p_limit: 100 }),
      signedEmblemUrls(supabase, [clan.emblem_path]),
    ]);

    return {
      status: "ok",
      clan: {
        ...clan,
        emblemUrl: clan.emblem_path ? (emblemUrls.get(clan.emblem_path) ?? null) : null,
      },
      members: members.error ? [] : (members.data ?? []),
    };
  } catch {
    return { status: "error" };
  }
}

/** Internal roles are leader/admin-only; the RPC refuses everyone else, so a
 * `denied` status lets the route render the panel only when it is allowed. */
export type InternalRolesLoad =
  { status: "ok"; roles: InternalRoleRow[] } | { status: "denied" } | { status: "error" };

export async function loadInternalRoles(clanId: string): Promise<InternalRolesLoad> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_clan_internal_roles", {
      p_clan_id: clanId,
    });
    if (error) {
      return error.code === "42501" ? { status: "denied" } : { status: "error" };
    }
    return { status: "ok", roles: data ?? [] };
  } catch {
    return { status: "error" };
  }
}

export async function loadRankList(): Promise<LoadResult<RankRow[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_ranks");
    if (error || !data) return { status: "error" };
    return { status: "ok", data };
  } catch {
    return { status: "error" };
  }
}

export interface OpenClanInvitation {
  membershipId: string;
  clanSlug: string;
}

/** The caller's open invitation to a clan, derived from their `clan_invite`
 * notification whose payload names this clan. Invitations are answered with
 * `respond_to_clan_invite`, and answering does not delete the notification, so
 * a fresh read always reflects the current membership row. */
export async function loadClanInvitation(clanId: string): Promise<OpenClanInvitation | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_own_notifications", {
      p_unread_only: false,
      p_limit: 50,
    });
    if (error || !data) return null;

    const invitation = data.find((row) => {
      if (row.type !== "clan_invite") return false;
      const payload = row.payload as {
        clan_id?: string;
        membership_id?: string;
        clan_slug?: string;
      };
      return payload?.clan_id === clanId && typeof payload?.membership_id === "string";
    });

    if (!invitation) return null;
    const payload = invitation.payload as {
      membership_id?: string;
      clan_slug?: string;
    };
    return {
      membershipId: payload.membership_id as string,
      clanSlug: payload.clan_slug ?? "",
    };
  } catch {
    return null;
  }
}

/** Resolve a clan's emblem to a short-lived signed URL, or null when there is
 * none or it cannot be read. */
export async function loadEmblemUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const supabase = await createClient();
    const urls = await signedEmblemUrls(supabase, [path]);
    return urls.get(path) ?? null;
  } catch {
    return null;
  }
}
