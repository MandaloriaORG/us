"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  SealQuestionIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export function CodexCouncilNav() {
  const pathname = usePathname();

  const items = [
    { href: "/council/codex", label: "Articles", Icon: BookOpenIcon, exact: true },
    { href: "/council/codex/new", label: "New article", Icon: PlusIcon, exact: true },
    {
      href: "/council/codex/proposals",
      label: "Proposals",
      Icon: PaperPlaneTiltIcon,
      exact: false,
    },
    {
      href: "/council/codex/suggestions",
      label: "Suggestions",
      Icon: SealQuestionIcon,
      exact: false,
    },
  ] as const;

  return (
    <nav aria-label="Codex work" className="flex flex-wrap items-center gap-1">
      {items.map(({ href, label, Icon, exact }) => {
        const isCurrent = exact
          ? pathname === href
          : pathname.startsWith(`${href}/`) || pathname === href;
        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "text-fg-muted duration-fast hover:bg-bg-raised hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
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
