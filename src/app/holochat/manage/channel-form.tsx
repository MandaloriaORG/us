"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { adminCreateChatChannel, adminUpdateChatChannel } from "@/lib/actions/holochat";
import type { ChatChannelSummary } from "@/lib/holochat/types";

const INPUT_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/30 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 h-11 w-full rounded-md border px-3 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

export interface ChannelFormProps {
  mode: "create" | "edit";
  channel?: ChatChannelSummary;
  /** Called after a successful create, so the parent can scroll to / open it. */
  onSaved?: (channelId: string) => void;
}

/**
 * Create or edit a channel. The kind and address are fixed at creation; editing
 * changes name, description and sort order only, matching the RPCs.
 */
export function ChannelForm({ mode, channel, onSaved }: ChannelFormProps) {
  const [name, setName] = useState(channel?.name ?? "");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<"public" | "announcements" | "private">("public");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [sortOrder, setSortOrder] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const editing = mode === "edit";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSaved(false);

    startTransition(async () => {
      const result = editing
        ? await adminUpdateChatChannel({
            channelId: channel!.id,
            name,
            description,
            sortOrder,
          })
        : await adminCreateChatChannel({
            slug,
            name,
            kind,
            description,
            sortOrder,
          });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }
      setSaved(true);
      onSaved?.(result.channelId);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg flex-col gap-4">
      {editing ? null : (
        <div className="flex flex-col gap-2">
          <label htmlFor="channel-slug" className="text-fg text-sm font-medium">
            Address
          </label>
          <Input
            id="channel-slug"
            value={slug}
            disabled={isPending}
            aria-invalid={fieldErrors.slug ? true : undefined}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="new-channel"
            className={INPUT_CLASS}
          />
          {fieldErrors.slug ? (
            <p role="alert" className="text-error text-xs">
              {fieldErrors.slug}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="channel-name" className="text-fg text-sm font-medium">
          Name
        </label>
        <Input
          id="channel-name"
          value={name}
          disabled={isPending}
          aria-invalid={fieldErrors.name ? true : undefined}
          onChange={(event) => setName(event.target.value)}
          placeholder="General"
          className={INPUT_CLASS}
        />
        {fieldErrors.name ? (
          <p role="alert" className="text-error text-xs">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      {editing ? null : (
        <NativeSelect
          id="channel-kind"
          label="Kind"
          value={kind}
          disabled={isPending}
          error={fieldErrors.kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          <option value="public">Public — everyone can read and post</option>
          <option value="announcements">Announcements — Council writes only</option>
          <option value="private">Private — only added members</option>
        </NativeSelect>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="channel-description" className="text-fg text-sm font-medium">
          Description <span className="text-fg-subtle font-normal">(optional)</span>
        </label>
        <textarea
          id="channel-description"
          value={description}
          disabled={isPending}
          maxLength={500}
          rows={2}
          aria-invalid={fieldErrors.description ? true : undefined}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is this channel for?"
          className="border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error min-h-16 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {fieldErrors.description ? (
          <p role="alert" className="text-error text-xs">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="channel-sort" className="text-fg text-sm font-medium">
          Position
        </label>
        <Input
          id="channel-sort"
          type="number"
          value={Number.isInteger(sortOrder) ? String(sortOrder) : ""}
          disabled={isPending}
          aria-invalid={fieldErrors.sortOrder ? true : undefined}
          onChange={(event) => setSortOrder(Number(event.target.value))}
          className={INPUT_CLASS}
        />
        {fieldErrors.sortOrder ? (
          <p role="alert" className="text-error text-xs">
            {fieldErrors.sortOrder}
          </p>
        ) : null}
      </div>

      {saved ? (
        <p className="text-fg-muted flex items-center gap-1.5 text-xs">
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
          {editing ? "Channel updated." : "Channel created."}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-error text-xs">
          {formError}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" loading={isPending} disabled={isPending}>
          {editing ? "Save changes" : "Create channel"}
        </Button>
      </div>
    </form>
  );
}
