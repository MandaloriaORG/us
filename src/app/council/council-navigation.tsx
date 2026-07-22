"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Users } from "lucide-react";

import { cn } from "@/lib/cn";

export interface CouncilNavigationProps {
  canViewAudit: boolean;
  canViewUsers: boolean;
  className?: string;
  variant?: "horizontal" | "vertical";
}

const navigationItems = [
  {
    href: "/council/users",
    label: "Users",
    permission: "canViewUsers",
    Icon: Users,
  },
  {
    href: "/council/audit",
    label: "Audit logs",
    permission: "canViewAudit",
    Icon: ScrollText,
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
  canViewAudit,
  canViewUsers,
  className,
  variant = "vertical",
}: CouncilNavigationProps) {
  const pathname = usePathname();
  const permissions = { canViewAudit, canViewUsers };
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
              "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-fg-muted transition-colors duration-fast hover:bg-bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
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
