"use client";

import { useState, useTransition } from "react";
import {
  ArrowClockwiseIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminAddChatChannelMember,
  adminSetChatChannelStatus,
  searchMembers,
} from "@/lib/actions/holochat";
import { cn } from "@/lib/cn";
import { CHAT_CHANNEL_KIND_LABELS, type ChatChannelSummary } from "@/lib/holochat/types";
import { ChannelForm } from "./channel-form";

export interface ChannelAdminProps {
  channels: ChatChannelSummary[];
}

export function ChannelAdmin({ channels: initial }: ChannelAdminProps) {
  const [channels, setChannels] = useState<ChatChannelSummary[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [membersId, setMembersId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmArchive(channel: ChatChannelSummary) {
    if (!archivingId || archiveReason.trim().length < 3) return;

    setError(null);
    startTransition(async () => {
      const result = await adminSetChatChannelStatus({
        channelId: channel.id,
        expectedStatus: "active",
        status: "archived",
        reason: archiveReason,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // An archived channel leaves the read list, so it leaves this one too.
      setChannels((current) => current.filter((item) => item.id !== channel.id));
      setArchivingId(null);
      setArchiveReason("");
    });
  }

  return (
    <div className="flex w-full flex-col gap-10">
      <section aria-labelledby="new-channel-heading">
        <h2 id="new-channel-heading" className="text-fg mb-3 text-sm font-medium">
          New channel
        </h2>
        <ChannelForm mode="create" />
      </section>

      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="channel-list-heading">
        <h2 id="channel-list-heading" className="text-fg mb-3 text-sm font-medium">
          Channels
        </h2>
        <ul className="divide-border border-border flex flex-col divide-y rounded-md border">
          {channels.map((channel) => {
            return (
              <li key={channel.id} className="px-3 py-3 md:px-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-fg flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{channel.name}</span>
                      <span className="border-border text-fg-subtle rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                        {CHAT_CHANNEL_KIND_LABELS[channel.kind]}
                      </span>
                    </p>
                    <p className="text-fg-subtle mt-0.5 text-xs">/{channel.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(channel.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setArchivingId(channel.id);
                        setArchiveReason("");
                      }}
                    >
                      Archive
                    </Button>
                    {channel.kind === "private" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setMembersId(membersId === channel.id ? null : channel.id)}
                      >
                        Members
                      </Button>
                    ) : null}
                  </div>
                </div>

                {editingId === channel.id ? (
                  <div className="border-border mt-4 border-t pt-4">
                    <ChannelForm mode="edit" channel={channel} onSaved={() => setEditingId(null)} />
                  </div>
                ) : null}

                {archivingId === channel.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      confirmArchive(channel);
                    }}
                    className="border-border mt-4 flex w-full max-w-sm flex-col gap-3 border-t pt-4"
                  >
                    <label
                      htmlFor={`archive-reason-${channel.id}`}
                      className="text-fg text-sm font-medium"
                    >
                      Archive this channel — why?
                    </label>
                    <textarea
                      id={`archive-reason-${channel.id}`}
                      value={archiveReason}
                      required
                      minLength={3}
                      maxLength={500}
                      disabled={isPending}
                      onChange={(event) => setArchiveReason(event.target.value)}
                      placeholder="Short reason for the audit log"
                      className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        loading={isPending}
                        disabled={isPending || archiveReason.trim().length < 3}
                      >
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => setArchivingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}

                {membersId === channel.id ? (
                  <MemberPanel
                    channelId={channel.id}
                    onDone={() => setMembersId(null)}
                    disabled={isPending}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function MemberPanel({
  channelId,
  onDone,
  disabled,
}: {
  channelId: string;
  onDone: () => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; display_name: string }[]>([]);
  const [searched, setSearched] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSearch() {
    setFeedback(null);
    startTransition(async () => {
      const found = await searchMembers({ query });
      setResults(found);
      setSearched(true);
    });
  }

  function apply(memberId: string, remove: boolean) {
    setBusyId(memberId);
    setFeedback(null);
    startTransition(async () => {
      const result = await adminAddChatChannelMember({ channelId, memberId, remove });
      setBusyId(null);
      if (!result.ok) {
        setFeedback(result.message);
        return;
      }
      setFeedback(remove ? "Removed." : "Added.");
    });
  }

  return (
    <div className="border-border mt-4 flex w-full max-w-md flex-col gap-3 border-t pt-4">
      <p className="text-fg text-sm font-medium">Channel members</p>
      <div className="flex gap-2">
        <Input
          value={query}
          disabled={disabled || Boolean(busyId)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch();
            }
          }}
          placeholder="Search members by name"
          aria-label="Search members"
          className="border-border bg-bg text-fg duration-fast h-11 flex-1 rounded-md border px-3 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:opacity-50"
        />
        <Button type="button" size="sm" variant="secondary" onClick={runSearch} loading={isPending}>
          <MagnifyingGlassIcon aria-hidden="true" className="h-4 w-4" />
          Search
        </Button>
      </div>

      {searched && results.length === 0 ? (
        <p className="text-fg-subtle text-xs">No members match that name.</p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {results.map((member) => (
          <li key={member.id} className="flex items-center gap-2">
            <span className="text-fg min-w-0 flex-1 truncate text-sm">{member.display_name}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || Boolean(busyId)}
              onClick={() => apply(member.id, false)}
            >
              <UserPlusIcon aria-hidden="true" className="h-4 w-4" />
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-error"
              disabled={disabled || Boolean(busyId)}
              onClick={() => apply(member.id, true)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      {feedback ? (
        <p
          className={cn(
            "text-xs",
            feedback === "Added." || feedback === "Removed." ? "text-fg-muted" : "text-error",
          )}
        >
          {feedback}
        </p>
      ) : null}

      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        <ArrowClockwiseIcon aria-hidden="true" className="h-4 w-4" />
        Close
      </Button>
    </div>
  );
}
