"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";
import { SmileyIcon } from "@phosphor-icons/react/dist/ssr";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import type { ReactionType } from "@/lib/content/queries";
import type { CallerReactions, ReactionCounts } from "@/lib/holochat/types";

/**
 * The Discord picker, lazy-loaded so it only downloads when opened; it ships
 * search + categories + a dark theme.
 */
const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
});

export interface ReactionPickerProps {
  /** The administrator-configured catalog from `listReactionTypes()`. */
  reactionTypes: ReactionType[];
  counts: ReactionCounts;
  callerReacted: CallerReactions;
  disabled?: boolean;
  /** A single in-flight key, so toggling the same reaction twice is not a race. */
  busyKey?: string | null;
  onToggle: (reactionKey: string) => void;
}

/** A pill's emoji: the catalog entry if the key is one of the curated slugs,
 *  otherwise the raw key itself (a free emoji like "❤️" or a ZWJ sequence). */
function emojiFor(reactionTypes: ReactionType[], key: string): string {
  return reactionTypes.find((r) => r.key === key)?.emoji ?? key;
}

/** A pill's accessible label: the catalog label when known, else the key. */
function labelFor(reactionTypes: ReactionType[], key: string): string {
  return reactionTypes.find((r) => r.key === key)?.label ?? key;
}

/**
 * Resolve a picked emoji to a reaction key: if the curated catalog already has
 * an entry for that exact emoji, use its curated key (reputation rules apply);
 * otherwise the raw emoji becomes a free reaction key (Discord style).
 */
function keyForEmoji(reactionTypes: ReactionType[], emoji: string): string {
  return reactionTypes.find((r) => r.emoji === emoji)?.key ?? emoji;
}

/**
 * Discord-style inline reaction row for a chat message. The pills are driven
 * by the REAL reactions on the message (counts + the caller's own), not by the
 * curated catalog — so a free emoji reacts exactly like Discord and shows up
 * as a pill too. The smiley trigger opens a full emoji picker with search;
 * unknown emoji keys are upserted into the catalog on the server.
 */
export function ReactionPicker({
  reactionTypes,
  counts,
  callerReacted,
  disabled,
  busyKey,
  onToggle,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  // Union of every key with a positive total and every key the caller touched.
  const visibleKeys = Array.from(
    new Set([
      ...Object.keys(counts).filter((key) => (counts[key] ?? 0) > 0),
      ...Object.keys(callerReacted).filter((key) => callerReacted[key] === true),
    ]),
  ).sort();

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleKeys.map((key) => {
        const reacted = callerReacted[key] === true;
        const total = counts[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={reacted}
            aria-label={`React with ${labelFor(reactionTypes, key)}`}
            disabled={disabled || busyKey === key}
            onClick={() => onToggle(key)}
            className={cn(
              "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex min-h-8 items-center gap-1 rounded-full border border-transparent px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-50",
              reacted && "border-border-raised bg-surface text-fg",
            )}
          >
            <span aria-hidden="true">{emojiFor(reactionTypes, key)}</span>
            {total !== undefined ? (
              <span className="text-fg-subtle tabular-nums">{total}</span>
            ) : null}
          </button>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add reaction"
            disabled={disabled}
            className={cn(
              "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex min-h-8 items-center justify-center rounded-full border border-transparent px-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-50",
            )}
          >
            <SmileyIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto border-0 p-0 shadow-none">
          <EmojiPicker
            theme={Theme.DARK}
            skinTonesDisabled
            searchDisabled={false}
            width="360px"
            height={420}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emoji) => {
              setOpen(false);
              onToggle(keyForEmoji(reactionTypes, emoji.emoji));
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
