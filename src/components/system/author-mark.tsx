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
 * Compact identity mark for an author row: the author's initials on a tinted
 * disc with a Beskar ring. Decorative by design — the author's name always
 * sits as adjacent text, so the mark is hidden from assistive tech.
 */
export function AuthorMark({ name, className }: AuthorMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-surface-raised text-brand border-brand/40 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
