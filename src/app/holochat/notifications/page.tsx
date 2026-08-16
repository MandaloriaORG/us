import Link from "next/link";
import { BellRingingIcon } from "@phosphor-icons/react/dist/ssr";

import { EmptyState } from "@/components/ui/empty-state";
import { NotificationBell } from "@/components/system/notification-bell";
import { getAuthorizationSnapshot } from "@/lib/permissions";
import {
  drainOutbox,
  getNotificationPreferences,
  listOwnNotifications,
} from "@/lib/holochat/queries";
import {
  defaultNotificationPreferences,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/holochat/notifications";
import { NotificationCenter } from "./notification-center";
import { NotificationPreferences } from "./notification-preferences";

export const metadata = {
  title: "Notifications · Mandaloria",
  description: "Your notifications and preferences.",
};

export default async function NotificationsPage() {
  const snapshot = await getAuthorizationSnapshot();
  if (!snapshot.allowed) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 md:px-6">
        <EmptyState
          icon={<BellRingingIcon aria-hidden="true" className="h-8 w-8" />}
          title="Sign in to see notifications"
          description="Replies, reactions and invitations land here once you are signed in."
          action={{ label: "Sign in", href: "/auth/login" }}
        />
      </div>
    );
  }

  await drainOutbox();

  const [page, storedPrefs] = await Promise.all([
    listOwnNotifications({ pageSize: 50 }),
    getNotificationPreferences(),
  ]);

  const prefs = { ...defaultNotificationPreferences() } as Record<NotificationType, boolean>;
  for (const type of NOTIFICATION_TYPES) {
    if (typeof storedPrefs[type] === "boolean") prefs[type] = storedPrefs[type];
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-6 md:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Notifications</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Replies, reactions, invitations and notices addressed to you.
          </p>
        </div>
        <NotificationBell />
      </header>

      <section aria-labelledby="notification-list-heading">
        <h2 id="notification-list-heading" className="text-fg mb-3 text-sm font-medium">
          Latest
        </h2>
        <NotificationCenter initialItems={page.items} nextCursor={page.nextCursor} />
      </section>

      <section aria-labelledby="notification-prefs-heading">
        <h2 id="notification-prefs-heading" className="text-fg mb-3 text-sm font-medium">
          Preferences
        </h2>
        <NotificationPreferences initialPrefs={prefs} />
      </section>

      <p className="text-fg-subtle text-xs">
        Prefer Holochat in the live view?{" "}
        <Link href="/holochat" className="text-brand underline underline-offset-2 hover:opacity-80">
          Back to channels
        </Link>
      </p>
    </div>
  );
}
