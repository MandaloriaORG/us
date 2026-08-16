"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimpleIcon,
  ListChecksIcon,
  PaperPlaneTiltIcon,
  SealQuestionIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export function CodexNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  if (!signedIn) return null;

  const items = [
    { href: "/codex/propose", label: "Propose a conversation", Icon: PaperPlaneTiltIcon },
    { href: "/codex/bookmarks", label: "Saved articles", Icon: BookmarkSimpleIcon },
    { href: "/codex/proposals", label: "My proposals", Icon: ListChecksIcon },
    { href: "/codex/suggestions", label: "My suggestions", Icon: SealQuestionIcon },
  ] as const;

  return (
    <nav aria-label="Your Codex" className="flex flex-wrap items-center gap-1">
      {items.map(({ href, label, Icon }) => {
        const isCurrent = pathname === href;
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
