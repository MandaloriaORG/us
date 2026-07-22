import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

const toneClasses = {
  neutral: "border-border text-fg-muted",
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  danger: "border-error/30 text-error",
} as const;

export type StatusBadgeTone = keyof typeof toneClasses;

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: StatusBadgeTone;
}

/**
 * Origin/coss-style compact badge for a short, already-known status.
 *
 * Use for one or two words in tables and metadata. Do not use colour as the
 * only status signal, put interactive behavior inside it, or use it for long
 * explanatory copy. The caller owns status translation and async updates.
 *
 * @see https://coss.com/ui/docs/components/badge
 */
export function StatusBadge({ children, tone = "neutral", className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      data-tone={tone}
      {...props}
    >
      {children}
    </span>
  );
}
