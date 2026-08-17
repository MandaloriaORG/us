"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { MandaloriaLogo } from "@/components/layout/mandaloria-logo";

export interface PublicHeroProps {
  /** Product-specific proof shown beside the copy, normally KnowledgePipeline. */
  visual: ReactNode;
}

const heroStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

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
 * The hero is the single brand-focal region on the home page: the Cinzel headline
 * carries a gold-to-amber gradient, an ambient radial glow plus a faint grid give
 * depth behind the copy, and the primary CTA casts a soft brand glow. Entry uses a
 * short staggered reveal that collapses to static under `prefers-reduced-motion`.
 * Source structure adapted from Tailark Veil Hero Section 3; upstream imagery and
 * client navigation intentionally omitted.
 * @see https://tailark.com/r/veil-hero-section-3.json
 */
function PublicHero({ visual }: PublicHeroProps) {
  const reduced = useReducedMotion();

  return (
    <section
      aria-labelledby="public-hero-title"
      className="border-border relative overflow-hidden border-b"
    >
      {/* Ambient background: radial brand glow + faint engineering grid, pure CSS. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="from-brand/10 absolute inset-x-0 top-0 h-72 bg-linear-to-b via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,var(--color-brand/14),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border/40)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border/40)_1px,transparent_1px)] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)] bg-[size:56px_56px] opacity-60" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-8 lg:py-24">
        <motion.div
          className="min-w-0"
          initial={reduced ? false : "hidden"}
          animate="visible"
          variants={heroStagger}
        >
          <motion.div
            variants={heroItem}
            className="mb-6 flex justify-start"
          >
            <MandaloriaLogo
              gradientId="ml-hero"
              className="drop-shadow-[0_0_30px_hsl(42_40%_55%/0.35)] h-16 w-16 sm:h-20 sm:w-20"
            />
          </motion.div>
          <motion.h1
            id="public-hero-title"
            variants={heroItem}
            className="font-display text-fg max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            <span className="from-brand via-brand-deep to-warning bg-linear-to-r bg-clip-text text-transparent">
              Essential knowledge,
            </span>{" "}
            kept free by the community.
          </motion.h1>
          <motion.p
            variants={heroItem}
            className="prose-width text-fg-muted mt-6 text-base sm:text-lg"
          >
            Mandaloria is a network around the Mandalorian philosophy. Ideas are debated in Plazas,
            followed live in Holochat, and become reviewed, sourced articles in Codex Libre —
            knowledge stays free because freedom carries responsibility.
          </motion.p>

          <motion.div variants={heroItem} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="w-full shadow-[0_8px_30px_-8px_var(--color-brand/45)] sm:w-auto"
            >
              <Link href="/plazas">
                Explore Plazas
                <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link href="/codex">Read Codex Libre</Link>
            </Button>
          </motion.div>
        </motion.div>

        <div className="min-w-0">{visual}</div>
      </div>
    </section>
  );
}

export { PublicHero };
