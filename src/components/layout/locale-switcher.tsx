"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TranslateIcon } from "@phosphor-icons/react/dist/ssr";

import { LOCALE_COOKIE, locales } from "@/i18n/config";

/**
 * EN/ES language switcher for the header. Persists the choice in a cookie and
 * soft-refreshes the current route so next-intl re-resolves the locale. The
 * URL never changes: the locale is cookie-carried (see `src/i18n/routing.ts`).
 */
export function LocaleSwitcher() {
  const activeLocale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function switchLocale(next: string) {
    if (next === activeLocale || busy) return;
    setBusy(true);
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
    // Refresh is async; re-enable shortly after so a rapid second switch works.
    window.setTimeout(() => setBusy(false), 400);
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="border-border bg-bg-raised/60 flex items-center overflow-hidden rounded-lg border"
    >
      <TranslateIcon aria-hidden="true" className="text-fg-subtle ml-2 h-3.5 w-3.5" />
      {locales.map((locale) => {
        const active = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchLocale(locale)}
            aria-pressed={active}
            className={`focus-visible:ring-border-focus/24 flex h-8 min-w-9 cursor-pointer items-center justify-center px-1.5 text-xs font-semibold uppercase transition-colors focus-visible:ring-[3px] focus-visible:outline-hidden active:scale-[0.98] ${
              active ? "bg-brand/15 text-brand" : "text-fg-muted hover:bg-surface hover:text-fg"
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
