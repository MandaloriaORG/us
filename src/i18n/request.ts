import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { defaultLocale, isLocale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isLocale(cookie) ? cookie : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
  };
});