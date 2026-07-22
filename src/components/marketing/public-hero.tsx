import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PublicHeroProps {
  /** Product-specific proof shown beside the copy, normally KnowledgePipeline. */
  visual: ReactNode;
}

/**
 * Tailark hero-structure adaptation for Mandaloria's public landing page.
 *
 * Responsibility: explain the product and offer its two primary public paths.
 * Use once, above the public capability list; do not use inside authenticated
 * product screens or without a meaningful Mandaloria visual. It keeps standard
 * marketing density, reflows to one column on narrow screens, and delegates all
 * visual state and asynchronous behavior to the supplied `visual`. The section
 * owns the page H1 while the supplied visual owns its own semantics; links retain
 * native keyboard and focus behavior. Keep the headline concise, the body near 65 characters per
 * line, and the visual safe for 320px viewports and missing/partial data.
 *
 * Source structure adapted from Tailark Veil Hero Section 3; upstream imagery,
 * client navigation, motion, and decorative treatments intentionally omitted.
 * @see https://tailark.com/r/veil-hero-section-3.json
 */
function PublicHero({ visual }: PublicHeroProps) {
  return (
    <section aria-labelledby="public-hero-title" className="border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-8 lg:py-24">
        <div className="min-w-0">
          <h1
            id="public-hero-title"
            className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl"
          >
            Conversation that becomes shared knowledge.
          </h1>
          <p className="mt-6 max-w-[65ch] text-base text-fg-muted sm:text-lg">
            Debate ideas in Plazas, review proposals with the community, and preserve what matters
            in Codex Libre with its sources and attribution intact.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/plazas">
                Explore Plazas
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link href="/codex">Read Codex Libre</Link>
            </Button>
          </div>
        </div>

        <div className="min-w-0">{visual}</div>
      </div>
    </section>
  );
}

export { PublicHero };
