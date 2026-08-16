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
 * Use once on the public landing page, directly below the hero. It is a quiet,
 * content-first list — one H2, short titles, one sentence each, borders as the
 * only divider — and must not be re-used as an application component or styled
 * like cards. No icons, no color-only meaning, no motion: the same reading
 * order works at 320 CSS pixels, 200% zoom, and with a keyboard or screen
 * reader. Source: Mandaloria custom component (brand/domain); no registry
 * primitive applies.
 */
export function ProductPrinciples() {
  return (
    <section aria-labelledby="principles-title" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 id="principles-title" className="text-fg text-2xl font-semibold tracking-tight">
          What Mandaloria stands for
        </h2>

        <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {principles.map((principle) => (
            <li key={principle.title} className="border-border border-t pt-4">
              <h3 className="text-fg text-sm font-semibold">{principle.title}</h3>
              <p className="text-fg-muted mt-1 max-w-2xl text-sm leading-6">{principle.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
