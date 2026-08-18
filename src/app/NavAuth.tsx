"use client";

import Link from "next/link";
import {
  CaretDownIcon,
  CircleNotchIcon,
  GearIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NotificationBell } from "@/components/system/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth";

interface NavAuthProps {
  user: { id: string; email?: string } | null;
  profile: { display_name: string; avatar_url: string | null } | null;
}

function LogoutButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("nav");

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={pending ? t("signingOut") : t("signOut")}
      className="text-fg-muted hover:text-error hover:bg-error/10 duration-fast flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors focus-visible:ring-border-focus focus-visible:ring-offset-bg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <CircleNotchIcon aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        <SignOutIcon aria-hidden="true" className="h-4 w-4" />
      )}
      {pending ? t("signingOut") : t("signOut")}
    </button>
  );
}

export function NavAuth({ user, profile }: NavAuthProps) {
  const t = useTranslations("nav");

  return (
    <div className="ml-2 flex items-center gap-1.5 sm:gap-2">
      <Link
        href="/search"
        prefetch
        aria-label={t("search")}
        className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <MagnifyingGlassIcon aria-hidden="true" className="h-5 w-5" />
      </Link>

      {!user ? (
        <Link
          href="/auth/login"
          prefetch
          className="border-border text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 items-center rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        >
          {t("signIn")}
        </Link>
      ) : (
        <>
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("openUserMenu")}
                className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg ring-brand/0 hover:ring-brand/30 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition-all hover:ring-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <Avatar
                  name={profile?.display_name ?? "Profile"}
                  src={profile?.avatar_url}
                  className="ring-brand/0 h-6 w-6 transition-shadow hover:shadow-[0_0_0_1px_hsl(42_40%_55%/0.4)]"
                />
                <span className="hidden sm:inline">
                  {profile?.display_name ?? "Profile"}
                </span>
                <CaretDownIcon
                  aria-hidden="true"
                  className="text-fg-subtle hidden h-3 w-3 sm:inline"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-fg truncate">
                {profile?.display_name ?? "Profile"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile/edit" prefetch aria-label={t("editProfile")}>
                  <UserIcon aria-hidden="true" className="h-4 w-4" />
                  {t("editProfile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" prefetch aria-label={t("settings")}>
                  <GearIcon aria-hidden="true" className="h-4 w-4" />
                  {t("settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <LocaleSwitcher />
              </div>
              <DropdownMenuSeparator />
              <form action={logout}>
                <LogoutButton />
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
