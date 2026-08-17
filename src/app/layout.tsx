import type { Metadata } from "next";
import { Inter, Cinzel, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { MandaloriaLogo } from "@/components/layout/mandaloria-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { canAny } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { NavAuth } from "./NavAuth";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Mandaloria",
    template: "%s | Mandaloria",
  },
  description:
    "A community and knowledge network for the Mandalorian philosophy. Plazas, Codex Libre, Holochat, and Clans.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let canOpenCouncil = false;

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("display_name, avatar_path")
      .eq("id", user.id)
      .single();

    if (p) {
      let avatarUrl: string | null = null;
      if (p.avatar_path) {
        try {
          const { data: signedAvatar } = await supabase.storage
            .from("avatars")
            .createSignedUrl(p.avatar_path, 300);
          avatarUrl = signedAvatar?.signedUrl ?? null;
        } catch {
          console.error("Navigation avatar could not be signed.");
        }
      }
      profile = { display_name: p.display_name, avatar_url: avatarUrl };
    }
    canOpenCouncil = (await canAny(["admin.view_users", "admin.view_audit_logs"])).allowed;
  }

  const mobileNavigationItems = [
    { href: "/plazas", label: "Plazas" },
    { href: "/holochat", label: "Holochat" },
    { href: "/codex", label: "Codex Libre" },
    { href: "/clans", label: "Clans and Casas" },
    { href: "/members", label: "Members" },
    ...(canOpenCouncil ? [{ href: "/council", label: "Council" }] : []),
  ];

  const t = await getTranslations("nav");
  const currentLocale = await getLocale();
  const translatedNavItems = mobileNavigationItems.map((item) => ({
    ...item,
    label: t(item.href.replace("/", "") as "plazas"),
  }));

  return (
    <html
      lang={currentLocale}
      className={`dark ${inter.variable} ${cinzel.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="z-toast bg-brand text-brand-fg focus:ring-border-focus focus:ring-offset-bg fixed top-3 left-3 -translate-y-20 rounded-md px-4 py-2 text-sm font-medium transition-transform focus:translate-y-0 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
        >
          {t("skipToContent")}
        </a>

        <header className="z-raised border-border bg-bg/70 supports-[backdrop-filter]:bg-bg/70 sticky top-0 border-b shadow-[0_1px_0_hsl(210_10%_18%/0.6),0_8px_24px_-16px_hsl(0_0%_0%/0.8)] backdrop-blur-md">
          <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center justify-between px-4 py-0.5 md:px-6">
            <Link
              href="/"
              prefetch
              aria-label="Mandaloria home"
              className="duration-fast group focus-visible:ring-border-focus focus-visible:ring-offset-bg flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              <MandaloriaLogo
                gradientId="ml-nav"
                className="duration-fast h-6 w-6 transition-transform group-hover:scale-105"
              />
              <span className="bg-[linear-gradient(90deg,hsl(42_40%_55%),hsl(45_70%_62%))] bg-clip-text text-transparent">
                Mandaloria
              </span>
            </Link>

            <nav
              aria-label="Primary navigation"
              className="flex max-w-full flex-wrap items-center justify-end gap-1"
            >
              <MobileNav
                className="sm:hidden"
                items={translatedNavItems}
                triggerLabel="Open main navigation"
              />
              <NavLinks
                className="hidden sm:flex"
                items={translatedNavItems.map((item) => ({
                  href: item.href,
                  label: item.label,
                  ...(item.href === "/council" ? { warning: true } : {}),
                }))}
              />
              <LocaleSwitcher />
              <NavAuth user={user} profile={profile} />
            </nav>
          </div>
        </header>

        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
