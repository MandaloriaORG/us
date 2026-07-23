import type { Metadata } from "next";
import { Inter, Cinzel, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { ShieldIcon } from "@phosphor-icons/react/dist/ssr";

import { MobileNav } from "@/components/layout/mobile-nav";
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
    { href: "/codex", label: "Codex Libre" },
    { href: "/members", label: "Members" },
    ...(canOpenCouncil ? [{ href: "/council", label: "Council" }] : []),
  ];

  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${cinzel.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="z-toast bg-brand text-brand-fg focus:ring-border-focus focus:ring-offset-bg fixed top-3 left-3 -translate-y-20 rounded-md px-4 py-2 text-sm font-medium transition-transform focus:translate-y-0 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
        >
          Skip to content
        </a>

        <header className="z-raised border-border bg-bg/95 sticky top-0 border-b backdrop-blur-xs">
          <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center justify-between px-4 py-0.5 md:px-6">
            <Link
              href="/"
              className="text-fg duration-fast hover:text-brand focus-visible:ring-border-focus focus-visible:ring-offset-bg flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              <ShieldIcon aria-hidden="true" className="text-brand h-5 w-5" />
              Mandaloria
            </Link>

            <nav
              aria-label="Primary navigation"
              className="flex max-w-full flex-wrap items-center justify-end gap-1"
            >
              <MobileNav
                className="sm:hidden"
                items={mobileNavigationItems}
                triggerLabel="Open main navigation"
              />
              <Link
                href="/plazas"
                className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus hidden min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:inline-flex"
              >
                Plazas
              </Link>
              <Link
                href="/codex"
                className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus hidden min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:inline-flex"
              >
                Codex
              </Link>
              <Link
                href="/members"
                className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus hidden min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:inline-flex"
              >
                Members
              </Link>

              {canOpenCouncil && (
                <Link
                  href="/council"
                  className="text-warning duration-fast hover:bg-warning/10 hover:text-warning focus-visible:ring-border-focus hidden min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:inline-flex"
                >
                  Council
                </Link>
              )}

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
