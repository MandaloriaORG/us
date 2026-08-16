"use client";

import Link from "next/link";
import { CircleNotchIcon, MagnifyingGlassIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { useFormStatus } from "react-dom";

import { NotificationBell } from "@/components/system/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth";

interface NavAuthProps {
  user: { id: string; email?: string } | null;
  profile: { display_name: string; avatar_url: string | null } | null;
}

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={pending ? "Signing out" : "Sign out"}
      className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <CircleNotchIcon aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        <SignOutIcon aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

export function NavAuth({ user, profile }: NavAuthProps) {
  return (
    <div className="ml-2 flex items-center gap-2">
      <Link
        href="/search"
        aria-label="Search"
        className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
      >
        <MagnifyingGlassIcon aria-hidden="true" className="h-5 w-5" />
      </Link>

      {!user ? (
        <Link
          href="/auth/login"
          className="border-border text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 items-center rounded-md border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        >
          Sign in
        </Link>
      ) : (
        <>
          <NotificationBell />
          <Link
            href="/profile/edit"
            aria-label="Edit profile"
            className="text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg flex min-h-11 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            <Avatar
              name={profile?.display_name ?? "Profile"}
              src={profile?.avatar_url}
              className="h-6 w-6"
            />
            <span className="hidden sm:inline">{profile?.display_name ?? "Profile"}</span>
          </Link>

          <form action={logout}>
            <LogoutButton />
          </form>
        </>
      )}
    </div>
  );
}
