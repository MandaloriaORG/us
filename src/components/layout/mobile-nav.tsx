"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Menu } from "lucide-react";

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
export function MobileNav({ className, items, triggerLabel = "Open navigation" }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={triggerLabel}
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
          disabled={items.length === 0}
          type="button"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-dropdown max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-56 overflow-y-auto rounded-md border border-border bg-bg-overlay p-1 text-sm text-fg shadow-md"
          collisionPadding={8}
          sideOffset={8}
        >
          {items.map((item) => {
            const isCurrent = pathname === item.href;

            return (
              <DropdownMenu.Item asChild key={item.href}>
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 max-w-64 cursor-pointer items-center rounded-sm px-3 py-2 text-fg-muted outline-none transition-colors duration-fast focus:bg-surface focus:text-fg data-[highlighted]:bg-surface data-[highlighted]:text-fg",
                    isCurrent && "bg-brand-muted font-medium text-fg",
                  )}
                  href={item.href}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
