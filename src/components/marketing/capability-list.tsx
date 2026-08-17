"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRightIcon,
  ChatCircleDotsIcon,
  BookOpenIcon,
  UsersThreeIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

const capabilities = [
  {
    title: "Plazas",
    description: "Durable discussions where ideas can be challenged, refined, and traced.",
    href: "/plazas",
    icon: SquaresFourIcon,
  },
  {
    title: "Codex Libre",
    description: "Reviewed, versioned knowledge connected to the conversations that produced it.",
    href: "/codex",
    icon: BookOpenIcon,
  },
  {
    title: "Holochat",
    description: "Live channels for the conversations that need an immediate shared space.",
    href: "/holochat",
    icon: ChatCircleDotsIcon,
  },
  {
    title: "Casas, Clanes, and Círculos",
    description: "Structures for belonging and shared responsibility across the network.",
    href: "/clans",
    icon: UsersThreeIcon,
  },
] as const;

/**
 * Tailark capability-section adaptation rendered as one continuous semantic list.
 *
 * Responsibility: route visitors to Mandaloria's four public product areas. Use
 * after the public hero; do not use as application navigation or for arbitrary
 * collections. It has standard marketing density, no loading/error ownership,
 * and rows reflow from a stacked mobile layout to aligned desktop columns. Each
 * row is one descriptive native link with a visible focus state, a decorative
 * icon treatment, and an arrow hidden from assistive technology. Rows reveal in
 * a short stagger that collapses to static under `prefers-reduced-motion`. Copy
 * should remain a short title plus one sentence; long text wraps without
 * clipping at 320px and no content is hidden at any viewport.
 *
 * Source structure adapted from Tailark's composable feature-section patterns;
 * upstream cards, illustrations, and palette styles are omitted.
 * @see https://tailark.com/r/features-4.json
 */
function CapabilityList() {
  const reduced = useReducedMotion();

  return (
    <section aria-labelledby="capabilities-title">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="capabilities-title" className="text-fg text-2xl font-semibold tracking-tight">
            One network, four ways to participate
          </h2>
          <p className="text-fg-muted mt-3 text-base">
            Move between durable debate, live conversation, reviewed knowledge, and community
            responsibility without losing context.
          </p>
        </div>

        <motion.ul
          className="border-border mt-8 border-b"
          initial={reduced ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <motion.li
                key={capability.href}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
                className="border-border border-t"
              >
                <Link
                  href={capability.href}
                  className="group duration-fast hover:bg-surface focus-visible:bg-surface grid min-h-11 min-w-0 gap-2 py-4 transition-colors sm:grid-cols-[auto_minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-3"
                >
                  <span className="border-border/70 bg-bg-raised text-brand-muted duration-fast group-hover:border-brand/40 group-hover:text-brand hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors sm:flex">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="text-fg duration-fast group-hover:text-brand font-medium transition-colors">
                    {capability.title}
                  </span>
                  <span className="text-fg-muted min-w-0 text-sm">{capability.description}</span>
                  <ArrowUpRightIcon
                    aria-hidden="true"
                    className="text-fg-subtle duration-fast group-hover:text-brand h-4 w-4 transition-colors"
                  />
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}

export { CapabilityList };
