"use client";

import Link from "next/link";
import { Loader2, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

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
      className="flex h-11 w-11 items-center justify-center rounded-md text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

export function NavAuth({ user, profile }: NavAuthProps) {
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="ml-2 inline-flex h-11 items-center rounded-md border border-border px-3 text-xs font-medium text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="ml-2 flex items-center gap-2">
      <Link
        href="/profile/edit"
        aria-label="Edit profile"
        className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1 text-sm text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
    </div>
  );
}
