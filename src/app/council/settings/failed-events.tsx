"use client";

import { useState, useTransition } from "react";
import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { reprocessOutboxEvent } from "@/lib/actions/holochat";
import { formatRelativeTime } from "@/lib/time";
import type { FailedOutboxEvent } from "@/lib/holochat/types";

export interface FailedEventsProps {
  events: FailedOutboxEvent[];
}

/**
 * The Council's failed-event surface. A notification event that exhausted its
 * delivery attempts sits here, inspectable and reprocessable by hand; the
 * retry re-queues it for the drainer. Read and written only through the
 * `admin.manage_settings`-gated outbox RPCs.
 */
export function FailedEvents({ events: initial }: FailedEventsProps) {
  const [events, setEvents] = useState<FailedOutboxEvent[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (events.length === 0) {
    return (
      <section aria-labelledby="failed-events-heading" className="mt-8">
        <h2 id="failed-events-heading" className="text-fg text-lg font-semibold">
          Event delivery
        </h2>
        <p className="text-fg-muted mt-1 text-sm">
          Notifications that could not be delivered after repeated attempts.
        </p>
        <div className="border-border bg-bg-raised mt-4 rounded-md border p-6">
          <EmptyState
            icon={<WarningCircleIcon aria-hidden="true" className="h-6 w-6" />}
            title="No failed events"
            description="Every notification event has been delivered or is still retrying."
          />
        </div>
      </section>
    );
  }

  function retry(eventId: string) {
    setBusyId(eventId);
    setError(null);
    startTransition(async () => {
      const result = await reprocessOutboxEvent(eventId);
      setBusyId(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEvents((current) => current.filter((event) => event.event_id !== eventId));
    });
  }

  return (
    <section aria-labelledby="failed-events-heading" className="mt-8">
      <h2 id="failed-events-heading" className="text-fg text-lg font-semibold">
        Event delivery
      </h2>
      <p className="text-fg-muted mt-1 text-sm">
        Notifications that could not be delivered after repeated attempts. Retry re-queues one for
        the drainer.
      </p>

      {error ? (
        <p role="alert" className="text-error mt-3 text-xs">
          {error}
        </p>
      ) : null}

      <ul className="divide-border border-border mt-4 flex flex-col divide-y rounded-md border">
        {events.map((event) => (
          <li
            key={event.event_id}
            className="hover:bg-surface/40 px-3 py-3 transition-colors md:px-4"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-fg text-sm font-medium">{event.event_type}</p>
                <p className="text-fg-subtle mt-0.5 text-xs">
                  {event.attempts} {event.attempts === 1 ? "attempt" : "attempts"} ·{" "}
                  {formatRelativeTime(event.created_at)}
                </p>
                {event.last_error ? (
                  <p className="text-fg-subtle mt-0.5 truncate text-xs" title={event.last_error}>
                    {event.last_error}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-brand hover:text-brand"
                loading={isPending && busyId === event.event_id}
                disabled={isPending}
                onClick={() => retry(event.event_id)}
              >
                <ArrowClockwiseIcon aria-hidden="true" className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
