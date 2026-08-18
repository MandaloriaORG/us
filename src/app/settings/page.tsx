import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/actions/profile";
import { getNotificationPreferences } from "@/lib/holochat/queries";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const result = await getCurrentProfile();

  if (result.status === "unauthenticated") {
    redirect("/auth/login?next=/settings");
  }

  if (result.status !== "ok") {
    redirect("/profile/edit");
  }

  const prefs = await getNotificationPreferences();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-fg font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Account Settings
        </h1>
        <p className="text-fg-muted mt-1 text-sm">
          Manage your account preferences, notification rules, and security.
        </p>
      </div>

      <SettingsClient
        user={{ id: result.profile.id, displayName: result.profile.display_name }}
        initialPrefs={prefs ?? {}}
        profileVisibility={result.profile.profile_visibility as "public" | "members" | "private"}
      />
    </main>
  );
}
