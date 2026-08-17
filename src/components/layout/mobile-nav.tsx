"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion, useReducedMotion } from "framer-motion";
import { ListIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export interface MobileNavItem {
  href: string;
  label: string;
}

export interface MobileNavProps {
  className?: string;
  items: readonly MobileNavItem[];
  triggerLabel?: string;
}

/**
 * Compact global navigation for mobile layouts.
 *
 * Provenance: shadcn Dropdown Menu behavior, backed directly by Radix UI's
 * DropdownMenu primitive and restyled with Mandaloria tokens.
 * @see https://ui.shadcn.com/docs/components/dropdown-menu
 * @see https://www.radix-ui.com/primitives/docs/components/dropdown-menu
 *
 * Use this overlay when the primary global links do not fit a narrow header;
 * use visible inline navigation at wider breakpoints and a simpler Link for a
 * single destination. It has one compact density and no cosmetic variants.
 * Radix owns opening, dismissal, keyboard navigation, focus return, and Escape;
 * the current pathname owns `aria-current`. Links have 44px targets, long labels
 * truncate, and many items scroll within the viewport. The parent supplies
 * resolved items and owns authorization, loading, empty, error, and permission
 * states and the responsive visibility breakpoint; this component never fetches
 * data or owns asynchronous state.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

export function MobileNav({ className, items, triggerLabel = "Open navigation" }: MobileNavProps) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={triggerLabel}
          className={cn(
            "text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
          disabled={items.length === 0}
          type="button"
        >
          <ListIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-dropdown border-border bg-bg-overlay text-fg max-h-(--radix-dropdown-menu-content-available-height) min-w-56 overflow-y-auto rounded-md border p-1 text-sm shadow-[0_12px_32px_-12px_hsl(0_0%_0%/0.8),0_0_0_1px_hsl(210_10%_18%/0.4)]"
          collisionPadding={8}
          sideOffset={8}
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {items.map((item, index) => {
              const isCurrent = pathname === item.href;

              return (
                <motion.div
                  key={item.href}
                  initial={reduced ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE, delay: 0.03 * index }}
                >
                  <DropdownMenu.Item asChild>
                    <Link
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        "text-fg-muted duration-fast focus:bg-surface focus:text-fg data-highlighted:bg-surface data-highlighted:text-fg flex min-h-11 max-w-64 cursor-pointer items-center rounded-xs px-3 py-2 outline-hidden transition-colors",
                        isCurrent && "bg-brand-muted text-fg font-medium",
                      )}
                      href={item.href}
                      prefetch
                    >
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </DropdownMenu.Item>
                </motion.div>
              );
            })}
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
