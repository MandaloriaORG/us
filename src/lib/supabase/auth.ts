import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type AccountStatus = Database["public"]["Tables"]["profiles"]["Row"]["status"];

export type AccountStatusResult = { ok: true; status: AccountStatus } | { ok: false };

/**
 * Resolve a user-controlled redirect without allowing a different origin.
 * Fragments and query parameters are preserved for valid local destinations.
 */
export function safeRedirectPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/",
) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const base = new URL("https://mandaloria.invalid");
    const destination = new URL(value, base);

    if (destination.origin !== base.origin) return fallback;

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

/** Return the configured public application origin without path or credentials. */
export function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;

  if (!configured) {
    return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
  }

  try {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return null;
    }
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Read the server-owned account state. Callers fail closed when it cannot be
 * verified; Auth metadata is deliberately not used as an authority source.
 */
export async function readAccountStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountStatusResult> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return { ok: false };
    return { ok: true, status: data.status };
  } catch {
    return { ok: false };
  }
}
