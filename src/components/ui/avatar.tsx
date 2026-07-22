"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/cn";

export interface AvatarProps {
  name: string;
  src?: string | null;
  /** Leave empty when the adjacent text already identifies the person. */
  alt?: string;
  className?: string;
}

export function safeAvatarUrl(value: string | null | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    return url.protocol === "https:" || (url.protocol === "http:" && isLoopback)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function initials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();

  return value || "?";
}

/**
 * Radix/shadcn-style avatar with a deterministic text fallback.
 *
 * Use for a person or account identity. Do not use it as a decorative icon.
 * Only HTTPS images are rendered; invalid, missing, or failed images fall back
 * to initials. Loading behavior belongs to Radix and no async authority or data
 * fetching belongs in this component. The default 40px size may be overridden
 * by the caller, but the circle and readable fallback must be preserved.
 *
 * @see https://www.radix-ui.com/primitives/docs/components/avatar
 */
export function Avatar({ name, src, alt = "", className }: AvatarProps) {
  const safeSrc = safeAvatarUrl(src);

  return (
    <AvatarPrimitive.Root
      aria-label={alt || undefined}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-bg-raised",
        className,
      )}
      role={alt ? "img" : undefined}
    >
      {safeSrc ? (
        <AvatarPrimitive.Image alt="" className="h-full w-full object-cover" src={safeSrc} />
      ) : null}
      <AvatarPrimitive.Fallback
        aria-hidden={alt ? undefined : true}
        className="flex h-full w-full items-center justify-center text-xs font-medium text-fg-muted"
        delayMs={safeSrc ? 200 : 0}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
