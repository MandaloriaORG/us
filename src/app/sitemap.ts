import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/supabase/auth";

/**
 * Sitemap of public hubs only.
 *
 * Deliberately no content listings: enumerating post/plaza URLs would require
 * re-deriving visibility outside the database. These routes are the stable,
 * publicly reachable entry points — discovery into content happens through the
 * Plaza listing, which is already visibility-filtered server-side.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  if (!origin) return [];

  const routes = ["", "/plazas", "/codex", "/clans", "/members", "/holochat", "/search"];

  return routes.map((route) => ({
    url: `${origin}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.6,
  }));
}