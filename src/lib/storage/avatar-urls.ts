import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "avatars";
const AVATAR_SIGNED_URL_TTL_SECONDS = 300;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve a set of avatar storage paths to short-lived signed URLs.
 * Returns a Map<path, signedUrl>. Missing/invalid paths and storage errors
 * resolve to nothing (fall back to initials in <Avatar>).
 */
export async function signedAvatarUrls(
  client: ServerClient,
  paths: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(
    new Set(paths.filter((path): path is string => Boolean(path))),
  );
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

/** Pick the signed URL for a single path out of a Map, or null. */
export function avatarUrlFor(
  map: Map<string, string>,
  path: string | null | undefined,
): string | null {
  return path ? (map.get(path) ?? null) : null;
}
