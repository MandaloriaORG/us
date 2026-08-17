"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

export interface NavLinkItem {
  href: string;
  label: string;
  /** Warning tone (e.g. Council). */
  warning?: boolean;
}

interface NavLinksProps {
  items: readonly NavLinkItem[];
  className?: string;
}

/**
 * Desktop primary navigation with an animated active indicator.
 *
 * Server-safe: this client component owns only pathname-based state and renders
 * plain anchor links. The parent resolves authorization and items; hrefs, aria
 * labels, and focus rings mirror the prior inline links exactly.
 */
export function NavLinks({ items, className }: NavLinksProps) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {items.map((item) => {
        const isActive =
          !!pathname && (pathname === item.href || pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "duration-fast focus-visible:ring-border-focus relative flex min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:inline-flex",
              item.warning
                ? "text-warning hover:bg-warning/10 hover:text-warning"
                : isActive
                  ? "text-fg"
                  : "text-fg-muted hover:bg-surface hover:text-fg",
            )}
          >
            <span className="relative z-10">{item.label}</span>
            {isActive ? (
              <motion.span
                aria-hidden="true"
                initial={reduced ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "absolute inset-0 rounded-md",
                  item.warning
                    ? "bg-warning/10"
                    : "border-border-raised bg-surface/80 shadow-[inset_0_1px_0_hsl(42_40%_55%/0.08)]",
                )}
              />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
