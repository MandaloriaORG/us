"use client";

import { useState, useTransition } from "react";
import {
  AtIcon,
  ChatCircleIcon,
  ChatTextIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  HeartIcon,
  MegaphoneIcon,
  ShieldIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { setNotificationPreferences } from "@/lib/actions/holochat";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  type NotificationType,
} from "@/lib/holochat/notifications";

const TYPE_ICONS: Record<NotificationType, typeof ChatCircleIcon> = {
  post_reply: ChatCircleIcon,
  comment_reply: ChatTextIcon,
  reaction: HeartIcon,
  mention: AtIcon,
  friend_request: EnvelopeIcon,
  clan_invite: ShieldIcon,
  warning: WarningIcon,
  announcement: MegaphoneIcon,
  report_resolved: CheckCircleIcon,
};

export interface NotificationPreferencesProps {
  initialPrefs: Record<NotificationType, boolean>;
}

/**
 * The preference form: one toggle per notification type, saved as a full map
 * because the RPC replaces the stored shape. The map is seeded from the saved
 * preferences merged over the all-enabled default, so a member who never opened
 * the form is opted in by default and only what they change is sent.
 */
export function NotificationPreferences({ initialPrefs }: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(initialPrefs);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(type: NotificationType, checked: boolean) {
    setSaved(false);
    setPrefs((current) => ({ ...current, [type]: checked }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await setNotificationPreferences({ types: prefs });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-4">
      <fieldset>
        <legend className="sr-only">Notification preferences</legend>
        <ul className="flex flex-col gap-1">
          {NOTIFICATION_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <li
                key={type}
                className="border-border hover:bg-surface/50 flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors"
              >
                <Checkbox
                  id={`pref-${type}`}
                  checked={prefs[type]}
                  onCheckedChange={(checked) => toggle(type, checked === true)}
                  disabled={isPending}
                />
                <label
                  htmlFor={`pref-${type}`}
                  className="flex min-w-0 flex-1 items-center gap-3 peer-data-[disabled]:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "border-border bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                      type === "warning" && "border-error/30",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn("text-fg-muted h-4 w-4", type === "warning" && "text-error")}
                    />
                  </span>
                  <span className="text-fg text-sm leading-6">
                    {NOTIFICATION_TYPE_LABELS[type]}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {saved ? (
        <p className="text-fg-muted flex items-center gap-1.5 text-xs">
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
          Preferences saved.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" loading={isPending} disabled={isPending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}
