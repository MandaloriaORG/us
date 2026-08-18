import { cn } from "@/lib/cn";

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

export interface AuthorMarkProps {
  name: string;
  className?: string;
}

/**
 * Compact identity mark for an author row: the author's initials on a disc
 * that mirrors the canonical `Avatar` fallback — same surface, border and text
 * tokens, same initials algorithm. This is the deliberate no-photo state: the
 * post and comment read RPCs do not return an avatar field, so posts cannot
 * show a photo without changing the data contract. The author's name always
 * sits as adjacent text, so the mark is hidden from assistive tech. Swap this
 * for the canonical `Avatar` when a read path starts returning author avatars.
 */
export function AuthorMark({ name, className }: AuthorMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "border-border bg-bg-raised text-fg-muted inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
