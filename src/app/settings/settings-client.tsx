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
import { Checkbox } from "@/components/ui/checkbox";
import { setNotificationPreferences } from "@/lib/actions/holochat";

interface SettingsClientProps {
  user: { id: string; displayName: string };
  initialPrefs: Record<string, boolean>;
  profileVisibility: "public" | "members" | "private";
}

const NOTIFICATION_TYPES = [
  {
    id: "mention",
    label: "Mentions (@you)",
    description: "Notify when someone mentions you in chat or posts",
  },
  {
    id: "friend_request",
    label: "Friend requests",
    description: "Notify when a clan member adds you",
  },
  {
    id: "codex_proposal",
    label: "Codex proposals",
    description: "Notify on proposals to your subscribed categories",
  },
  {
    id: "clan_announcement",
    label: "Clan announcements",
    description: "Important announcements from your clan leaders",
  },
  {
    id: "system",
    label: "System notices",
    description: "Security, moderation and platform announcements",
  },
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
      <nav className="space-y-1 md:col-span-1" aria-label="Settings navigation">
        <button
          type="button"
          aria-pressed={tab === "notifications"}
          onClick={() => setTab("notifications")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors active:scale-[0.98] ${
            tab === "notifications"
              ? "bg-surface text-fg ring-brand/40 ring-1"
              : "text-fg-muted hover:bg-surface/50 hover:text-fg"
          }`}
        >
          <BellIcon aria-hidden="true" className="h-4 w-4" />
          Notifications
        </button>

        <button
          type="button"
          aria-pressed={tab === "privacy"}
          onClick={() => setTab("privacy")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors active:scale-[0.98] ${
            tab === "privacy"
              ? "bg-surface text-fg ring-brand/40 ring-1"
              : "text-fg-muted hover:bg-surface/50 hover:text-fg"
          }`}
        >
          <ShieldCheckIcon aria-hidden="true" className="h-4 w-4" />
          Privacy & Visibility
        </button>

        <button
          type="button"
          aria-pressed={tab === "security"}
          onClick={() => setTab("security")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors active:scale-[0.98] ${
            tab === "security"
              ? "bg-surface text-fg ring-brand/40 ring-1"
              : "text-fg-muted hover:bg-surface/50 hover:text-fg"
          }`}
        >
          <LockKeyIcon aria-hidden="true" className="h-4 w-4" />
          Security & Password
        </button>

        <div className="border-border mt-3 border-t pt-3">
          <Link
            href="/profile/edit"
            className="text-fg-muted hover:bg-surface/50 hover:text-fg flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
          >
            <UserCircleIcon aria-hidden="true" className="h-4 w-4" />
            Edit Profile Data →
          </Link>
        </div>
      </nav>

      <div className="border-border bg-surface/50 rounded-lg border p-6 md:col-span-3">
        {tab === "notifications" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-fg text-lg font-semibold">Notification Preferences</h2>
              <p className="text-fg-muted mt-1 text-xs">
                Choose which events send in-app and outbox alerts to your account.
              </p>
            </div>

            <div className="divide-border/60 divide-y">
              {NOTIFICATION_TYPES.map((type) => (
                <div
                  key={type.id}
                  className="hover:bg-surface/30 -mx-2 flex items-start justify-between gap-3 px-2 py-3.5 transition-colors"
                >
                  <label htmlFor={`pref-${type.id}`} className="cursor-pointer pr-4">
                    <p className="text-fg text-sm font-medium">{type.label}</p>
                    <p className="text-fg-muted text-xs">{type.description}</p>
                  </label>
                  <Checkbox
                    id={`pref-${type.id}`}
                    checked={prefs[type.id] ?? false}
                    onCheckedChange={() => togglePref(type.id)}
                    aria-label={`Enable ${type.label}`}
                    className="mt-1"
                  />
                </div>
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
                <span className="text-brand flex items-center gap-1 text-xs font-medium">
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
              <p className="text-fg-muted mt-1 text-xs">
                Control who can see your profile, friend list, and activity.
              </p>
            </div>

            <div className="border-border bg-surface space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-fg text-sm font-medium">Profile Visibility</p>
                  <p className="text-fg-muted text-xs">
                    Currently set to:{" "}
                    <span className="text-fg font-semibold capitalize">{profileVisibility}</span>
                  </p>
                </div>
                <Link href="/profile/edit" className="text-brand text-xs hover:underline">
                  Change in Profile Editor →
                </Link>
              </div>
            </div>

            <div className="text-fg-muted space-y-1 text-xs">
              <p>
                • <strong>Public</strong>: visible to all visitors
              </p>
              <p>
                • <strong>Members</strong>: visible only to signed-in users
              </p>
              <p>
                • <strong>Private</strong>: only visible to you and administrators
              </p>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-fg text-lg font-semibold">Security & Password</h2>
              <p className="text-fg-muted mt-1 text-xs">
                Manage your credentials and session state.
              </p>
            </div>

            <div className="border-border bg-surface space-y-3 rounded-lg border p-4">
              <p className="text-fg text-sm font-medium">Password Reset</p>
              <p className="text-fg-muted text-xs">
                To update your password, request a secure reset link to your registered email.
              </p>
              <Link
                href="/auth/forgot-password"
                className="text-brand inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
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
