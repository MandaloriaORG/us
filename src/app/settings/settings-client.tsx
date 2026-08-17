"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  LockKeyIcon,
  CheckCircleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { setNotificationPreferences } from "@/lib/actions/holochat";

interface SettingsClientProps {
  user: { id: string; displayName: string };
  initialPrefs: Record<string, boolean>;
  profileVisibility: "public" | "members" | "private";
}

const NOTIFICATION_TYPES = [
  { id: "mention", label: "Mentions (@you)", description: "Notify when someone mentions you in chat or posts" },
  { id: "friend_request", label: "Friend requests", description: "Notify when a clan member adds you" },
  { id: "codex_proposal", label: "Codex proposals", description: "Notify on proposals to your subscribed categories" },
  { id: "clan_announcement", label: "Clan announcements", description: "Important announcements from your clan leaders" },
  { id: "system", label: "System notices", description: "Security, moderation and platform announcements" },
];

export function SettingsClient({ user, initialPrefs, profileVisibility }: SettingsClientProps) {
  const [tab, setTab] = useState<"notifications" | "privacy" | "security">("notifications");
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    mention: initialPrefs.mention ?? true,
    friend_request: initialPrefs.friend_request ?? true,
    codex_proposal: initialPrefs.codex_proposal ?? true,
    clan_announcement: initialPrefs.clan_announcement ?? true,
    system: initialPrefs.system ?? true,
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePref(type: string) {
    setPrefs((prev) => ({ ...prev, [type]: !prev[type] }));
    setSaved(false);
  }

  function handleSavePrefs() {
    setError(null);
    startTransition(async () => {
      const result = await setNotificationPreferences({ types: prefs });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      {/* Sidebar de pestañas tipo XenForo */}
      <nav className="space-y-1 md:col-span-1" aria-label="Settings navigation">
        <button
          type="button"
          onClick={() => setTab("notifications")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
            tab === "notifications"
              ? "bg-surface text-fg ring-1 ring-brand/40"
              : "text-fg-muted hover:bg-surface/50 hover:text-fg"
          }`}
        >
          <BellIcon aria-hidden="true" className="h-4 w-4" />
          Notifications
        </button>

        <button
          type="button"
          onClick={() => setTab("privacy")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
            tab === "privacy"
              ? "bg-surface text-fg ring-1 ring-brand/40"
              : "text-fg-muted hover:bg-surface/50 hover:text-fg"
          }`}
        >
          <ShieldCheckIcon aria-hidden="true" className="h-4 w-4" />
          Privacy & Visibility
        </button>

        <button
          type="button"
          onClick={() => setTab("security")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
            tab === "security"
              ? "bg-surface text-fg ring-1 ring-brand/40"
              : "text-fg-muted hover:bg-surface/50 hover:text-fg"
          }`}
        >
          <LockKeyIcon aria-hidden="true" className="h-4 w-4" />
          Security & Password
        </button>

        <div className="pt-3 border-t border-border mt-3">
          <Link
            href="/profile/edit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:bg-surface/50 hover:text-fg transition-colors"
          >
            <UserCircleIcon aria-hidden="true" className="h-4 w-4" />
            Edit Profile Data →
          </Link>
        </div>
      </nav>

      {/* Contenido principal */}
      <div className="rounded-xl border border-border bg-surface/50 p-6 md:col-span-3">
        {tab === "notifications" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-fg text-lg font-semibold">Notification Preferences</h2>
              <p className="text-fg-muted text-xs mt-1">
                Choose which events send in-app and outbox alerts to your account.
              </p>
            </div>

            <div className="divide-y divide-border/60">
              {NOTIFICATION_TYPES.map((type) => (
                <label
                  key={type.id}
                  className="flex items-start justify-between py-3.5 cursor-pointer hover:bg-surface/30 px-2 rounded -mx-2 transition-colors"
                >
                  <div className="pr-4">
                    <p className="text-fg text-sm font-medium">{type.label}</p>
                    <p className="text-fg-muted text-xs">{type.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[type.id] ?? false}
                    onChange={() => togglePref(type.id)}
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand focus:ring-offset-bg mt-1 cursor-pointer"
                  />
                </label>
              ))}
            </div>

            {error && <p className="text-error text-xs">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSavePrefs} disabled={isPending}>
                {isPending ? (
                  <>
                    <CircleNotchIcon aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Preferences"
                )}
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-brand font-medium">
                  <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
                  Saved
                </span>
              )}
            </div>
          </div>
        )}

        {tab === "privacy" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-fg text-lg font-semibold">Privacy & Visibility</h2>
              <p className="text-fg-muted text-xs mt-1">
                Control who can see your profile, friend list, and activity.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-fg text-sm font-medium">Profile Visibility</p>
                  <p className="text-fg-muted text-xs">Currently set to: <span className="text-fg font-semibold capitalize">{profileVisibility}</span></p>
                </div>
                <Link
                  href="/profile/edit"
                  className="text-xs text-brand hover:underline"
                >
                  Change in Profile Editor →
                </Link>
              </div>
            </div>

            <div className="text-xs text-fg-muted space-y-1">
              <p>• <strong>Public</strong>: visible to all visitors</p>
              <p>• <strong>Members</strong>: visible only to signed-in users</p>
              <p>• <strong>Private</strong>: only visible to you and administrators</p>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-fg text-lg font-semibold">Security & Password</h2>
              <p className="text-fg-muted text-xs mt-1">
                Manage your credentials and session state.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <p className="text-fg text-sm font-medium">Password Reset</p>
              <p className="text-fg-muted text-xs">
                To update your password, request a secure reset link to your registered email.
              </p>
              <Link
                href="/auth/forgot-password"
                className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-medium"
              >
                Request password reset link →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
