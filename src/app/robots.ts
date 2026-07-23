import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/supabase/auth";

/**
 * Crawler policy.
 *
 * This is defence in depth, not the control. Private content is already
 * unreachable: the read RPCs return nothing to an anonymous caller, so a
 * members-only Plaza and its posts answer 404 to a crawler exactly as they do to
 * a visitor. What this file adds is an explicit refusal for the routes that are
 * private by purpose rather than by data — account flows, profile editing and
 * Council administration — so they never reach an index even as a redirect.
 *
 * There is deliberately no sitemap: publishing one would mean enumerating post
 * URLs, and that enumeration would have to re-derive visibility outside the
 * database. Discovery stays with the Plaza listing, which is already
 * visibility-filtered.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth/", "/council/", "/profile/edit", "/bookmarks"],
      },
    ],
    // Omitted rather than guessed when the canonical origin is not configured;
    // a wrong host is worse than none.
    ...(origin ? { host: origin } : {}),
  };
}
