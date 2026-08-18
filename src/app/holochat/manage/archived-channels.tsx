"use client";

import { useState, useTransition } from "react";
import {
  ArchiveIcon,
  HashIcon,
  LockKeyIcon,
  MegaphoneIcon,
  ShieldIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adminSetChatChannelStatus } from "@/lib/actions/holochat";
import { CHAT_CHANNEL_KIND_LABELS, type AdminChannel } from "@/lib/holochat/types";

const KIND_ICONS = {
  public: HashIcon,
  announcements: MegaphoneIcon,
  clan: ShieldIcon,
  private: LockKeyIcon,
} as const;

export interface ArchivedChannelsProps {
  archived: AdminChannel[];
}

/**
 * The archived-channel reactivation panel for the Council manage surface. A
 * channel is archived by hiding it from the public list; this panel lets a
 * `chat.manage` holder see what was archived and bring it back, with a reason
 * for the audit log. Discrete by design: it only appears when something is
 * archived.
 */
export function ArchivedChannels({ archived }: ArchivedChannelsProps) {
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (archived.length === 0) return null;

  function confirmReactivate(channel: AdminChannel) {
    if (!reactivatingId || reason.trim().length < 3) return;

    setError(null);
    startTransition(async () => {
      const result = await adminSetChatChannelStatus({
        channelId: channel.id,
        expectedStatus: "archived",
        status: "active",
        reason,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setReactivatingId(null);
      setReason("");
    });
  }

  return (
    <section aria-labelledby="archived-channels-heading">
      <h2 id="archived-channels-heading" className="text-fg mb-3 text-sm font-medium">
        Archived channels
      </h2>
      <ul className="divide-border border-border flex flex-col divide-y rounded-md border">
        {archived.map((channel) => {
          const KindIcon = KIND_ICONS[channel.kind];
          return (
            <li
              key={channel.id}
              className="hover:bg-surface/40 px-3 py-3 transition-colors md:px-4"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-fg flex flex-wrap items-center gap-2 text-sm font-medium">
                    <KindIcon aria-hidden="true" className="text-fg-subtle h-4 w-4 shrink-0" />
                    <span className="truncate">{channel.name}</span>
                    <span className="border-border text-fg-subtle rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                      {CHAT_CHANNEL_KIND_LABELS[channel.kind]}
                    </span>
                  </p>
                  <p className="text-fg-subtle mt-0.5 text-xs">/{channel.slug}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-brand hover:text-brand"
                  onClick={() => {
                    setReactivatingId(channel.id);
                    setReason("");
                  }}
                >
                  <ArchiveIcon aria-hidden="true" className="h-4 w-4" />
                  Reactivate
                </Button>
              </div>

              {reactivatingId === channel.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    confirmReactivate(channel);
                  }}
                  className="border-border mt-4 flex w-full max-w-sm flex-col gap-3 border-t pt-4"
                >
                  <label
                    htmlFor={`reactivate-reason-${channel.id}`}
                    className="text-fg text-sm font-medium"
                  >
                    Reactivate this channel — why?
                  </label>
                  <Textarea
                    id={`reactivate-reason-${channel.id}`}
                    value={reason}
                    required
                    minLength={3}
                    maxLength={500}
                    disabled={isPending}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Short reason for the audit log"
                    className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {error ? (
                    <p role="alert" className="text-error text-xs">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      loading={isPending}
                      disabled={isPending || reason.trim().length < 3}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => setReactivatingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
