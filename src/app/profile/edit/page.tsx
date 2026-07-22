import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/lib/actions/profile";
import { ProfileEditor } from "./ProfileEditor";

export default async function ProfileEditPage() {
  const result = await getCurrentProfile();

  if (result.status === "unauthenticated") {
    redirect("/auth/login?next=/profile/edit");
  }

  if (result.status === "denied") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <div role="alert">
          <EmptyState
            title="Profile editing unavailable"
            description={result.message}
            action={{ label: "Return home", href: "/" }}
          />
        </div>
      </main>
    );
  }

  if (result.status === "error") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <div role="alert">
          <EmptyState
            title="Profile temporarily unavailable"
            description="We could not load your profile. Try again."
            action={{ label: "Try again", href: "/profile/edit" }}
          />
        </div>
      </main>
    );
  }

  if (result.status === "not_found") {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <EmptyState
          title="Profile not found"
          description="Your account does not have a profile yet."
          action={{ label: "Return home", href: "/" }}
        />
      </main>
    );
  }

  const { profile } = result;
  const profileVisibility = ["public", "members", "private"].includes(profile.profile_visibility)
    ? (profile.profile_visibility as "public" | "members" | "private")
    : "public";

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-fg">Edit profile</h1>
      <p className="mt-1 text-sm text-fg-muted">Update the information shown on your profile.</p>

      <ProfileEditor
        displayName={profile.display_name}
        bio={profile.bio ?? ""}
        website={profile.website ?? ""}
        avatarPath={profile.avatar_path}
        avatarUrl={profile.avatarUrl}
        profileVisibility={profileVisibility}
      />
    </main>
  );
}
