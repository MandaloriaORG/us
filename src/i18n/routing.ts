export type Locale = "en" | "es";

/**
 * Locale is carried by cookie, not by the URL path, so existing routes and
 * links keep working unchanged. The middleware reads `NEXT_LOCALE` cookie or
 * falls back to the browser's Accept-Language.
 */
export const locales: Locale[] = ["en", "es"];
export const defaultLocale: Locale = "en";

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "es";
}

export const LOCALE_COOKIE = "NEXT_LOCALE";