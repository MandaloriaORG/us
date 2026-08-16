"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { setNotificationPreferences } from "@/lib/actions/holochat";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  type NotificationType,
} from "@/lib/holochat/notifications";

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
        <ul className="flex flex-col gap-2">
          {NOTIFICATION_TYPES.map((type) => (
            <li key={type} className="flex items-start gap-3">
              <Checkbox
                id={`pref-${type}`}
                checked={prefs[type]}
                onCheckedChange={(checked) => toggle(type, checked === true)}
                disabled={isPending}
              />
              <label
                htmlFor={`pref-${type}`}
                className="text-fg text-sm leading-6 peer-data-[disabled]:opacity-50"
              >
                {NOTIFICATION_TYPE_LABELS[type]}
              </label>
            </li>
          ))}
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
