"use client";

import { motion, useReducedMotion } from "framer-motion";

const principles = [
  {
    title: "Knowledge stays free",
    body: "Essential knowledge remains free and accessible to the community that needs it.",
  },
  {
    title: "Community before tool",
    body: "The network serves the people in it; the tool is never the point.",
  },
  {
    title: "Permanent knowledge",
    body: "What the community decides is worth knowing is kept, versioned, and preserved.",
  },
  {
    title: "Provenance",
    body: "Every claim keeps its source, and every article credits the conversation that produced it.",
  },
  {
    title: "Real responsibility",
    body: "Ranks and badges reflect demonstrable contribution, not self-appointed titles.",
  },
  {
    title: "Moderation from the start",
    body: "Moderation, privacy, and audit are built into the foundation, not bolted on later.",
  },
  {
    title: "Freedom requires responsibility",
    body: "Open participation works because each member carries their part.",
  },
] as const;

/**
 * Mandaloria-only product identity section: the philosophy of the network
 * stated plainly, not a feature list.
 *
 * Use once on the public landing page, directly below the hero. It states the
 * network's principles in a quiet card grid: one H2, short titles, one sentence
 * each. Cards lift and their border warms to the brand on hover, and the grid
 * reveals in a short stagger that collapses to static under
 * `prefers-reduced-motion`. No icons and no color-only meaning; the same reading
 * order works at 320 CSS pixels, 200% zoom, and with a keyboard or screen
 * reader. Source: Mandaloria custom component (brand/domain); no registry
 * primitive applies.
 */
export function ProductPrinciples() {
  const reduced = useReducedMotion();

  return (
    <section aria-labelledby="principles-title" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 id="principles-title" className="text-fg text-2xl font-semibold tracking-tight">
          What Mandaloria stands for
        </h2>

        <motion.ul
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial={reduced ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {principles.map((principle) => (
            <motion.li
              key={principle.title}
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="group border-border bg-bg-raised/40 duration-fast hover:border-brand/40 hover:bg-bg-raised relative rounded-lg border p-5 transition-[border-color,transform,background-color] hover:-translate-y-0.5"
            >
              <h3 className="text-fg duration-fast group-hover:text-brand text-sm font-semibold transition-colors">
                {principle.title}
              </h3>
              <p className="text-fg-muted mt-1 max-w-2xl text-sm leading-6">{principle.body}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
