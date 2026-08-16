"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  BuildingsIcon,
  FlagIcon,
  GavelIcon,
  GearIcon,
  ScrollIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export interface CouncilNavigationProps {
  canManageCodex: boolean;
  canManagePlazas: boolean;
  canManageSettings: boolean;
  canViewAudit: boolean;
  canViewReports: boolean;
  canViewUsers: boolean;
  className?: string;
  variant?: "horizontal" | "vertical";
}

const navigationItems = [
  {
    href: "/council/users",
    label: "Users",
    permission: "canViewUsers",
    Icon: UsersIcon,
  },
  {
    href: "/council/reports",
    label: "Reports",
    permission: "canViewReports",
    Icon: FlagIcon,
  },
  {
    // Appeals are read by whoever works the queue: the same permission the
    // appeal RPCs re-check.
    href: "/council/appeals",
    label: "Appeals",
    permission: "canViewReports",
    Icon: GavelIcon,
  },
  {
    href: "/council/plazas",
    label: "Plazas",
    permission: "canManagePlazas",
    Icon: BuildingsIcon,
  },
  {
    href: "/council/audit",
    label: "Audit logs",
    permission: "canViewAudit",
    Icon: ScrollIcon,
  },
  {
    // The Codex work surface is its own destination inside the shell; the
    // nested CodexCouncilNav carries its internal pages.
    href: "/council/codex",
    label: "Codex",
    permission: "canManageCodex",
    Icon: BookOpenIcon,
  },
  {
    href: "/council/settings",
    label: "Settings",
    permission: "canManageSettings",
    Icon: GearIcon,
  },
] as const;

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Permission-filtered Council destinations for both the mobile header and the
 * desktop sidebar. The server resolves authority; this client component only
 * filters already-authorized links and derives the active route.
 */
export function CouncilNavigation({
  canManageCodex,
  canManagePlazas,
  canManageSettings,
  canViewAudit,
  canViewReports,
  canViewUsers,
  className,
  variant = "vertical",
}: CouncilNavigationProps) {
  const pathname = usePathname();
  const permissions = {
    canManageCodex,
    canManagePlazas,
    canManageSettings,
    canViewAudit,
    canViewReports,
    canViewUsers,
  };
  const visibleItems = navigationItems.filter((item) => permissions[item.permission]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Council navigation"
      className={cn(
        variant === "horizontal" ? "flex items-center gap-1" : "flex flex-col gap-1",
        className,
      )}
    >
      {visibleItems.map(({ href, label, Icon }) => {
        const isCurrent = isCurrentRoute(pathname, href);

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "text-fg-muted duration-fast hover:bg-bg-raised hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
              variant === "horizontal" ? "shrink-0" : "w-full",
              isCurrent && "bg-bg-raised text-fg",
            )}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
