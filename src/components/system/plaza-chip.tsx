import { cn } from "@/lib/cn";

/**
 * Deterministic identity hue for a Plaza, derived from its slug. The value is
 * kept muted so the chip sits inside the Beskar palette: a low-saturation tint
 * for the fill and a readable foreground at the same hue. No curated lookup
 * table, so any slug gets a stable colour and the set needs no maintenance.
 */
export function plazaHue(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export interface PlazaChipProps {
  slug: string;
  name: string;
  /** Renders the name label (used in the feed); omit for a bare monogram tile. */
  showName?: boolean;
  className?: string;
}

/**
 * Compact identity chip for a Plaza: a tinted monogram tile plus its name.
 * The colour is derived from the slug, so the same Plaza is the same colour
 * everywhere. Pills are reserved for tags/status/filters, which is what a
 * Plaza chip is — a category filter on the post it labels.
 */
export function PlazaChip({ slug, name, showName = true, className }: PlazaChipProps) {
  const hue = plazaHue(slug);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 26% 19%)`,
        color: `hsl(${hue} 42% 78%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 42% 38% / 0.35)`,
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          backgroundColor: `hsl(${hue} 40% 30%)`,
          color: `hsl(${hue} 55% 90%)`,
        }}
      >
        {name.trim().charAt(0).toLocaleUpperCase() || "?"}
      </span>
      <span className="truncate">{showName ? name : null}</span>
    </span>
  );
}
