import type { Metadata } from "next";
import { Inter, Cinzel, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Shield } from "lucide-react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { canAny } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { NavAuth } from "./NavAuth";
import "@/styles/tokens.css";
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
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-toast -translate-y-20 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-bg"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-raised border-b border-border bg-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center justify-between px-4 py-0.5 md:px-6">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-fg transition-colors duration-fast hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Shield aria-hidden="true" className="h-5 w-5 text-brand" />
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
                className="hidden min-h-11 items-center rounded-md px-3 text-sm text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus sm:inline-flex"
              >
                Plazas
              </Link>
              <Link
                href="/codex"
                className="hidden min-h-11 items-center rounded-md px-3 text-sm text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus sm:inline-flex"
              >
                Codex
              </Link>
              <Link
                href="/members"
                className="hidden min-h-11 items-center rounded-md px-3 text-sm text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus sm:inline-flex"
              >
                Members
              </Link>

              {canOpenCouncil && (
                <Link
                  href="/council"
                  className="hidden min-h-11 items-center rounded-md px-3 text-sm text-warning transition-colors duration-fast hover:bg-warning/10 hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus sm:inline-flex"
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
