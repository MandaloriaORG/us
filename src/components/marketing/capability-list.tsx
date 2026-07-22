import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const capabilities = [
  {
    title: "Plazas",
    description: "Durable discussions where ideas can be challenged, refined, and traced.",
    href: "/plazas",
  },
  {
    title: "Codex Libre",
    description: "Reviewed, versioned knowledge connected to the conversations that produced it.",
    href: "/codex",
  },
  {
    title: "Holochat",
    description: "Live channels for the conversations that need an immediate shared space.",
    href: "/holochat",
  },
  {
    title: "Casas, Clanes, and Círculos",
    description: "Structures for belonging and shared responsibility across the network.",
    href: "/clans",
  },
] as const;

/**
 * Tailark capability-section adaptation rendered as one continuous semantic list.
 *
 * Responsibility: route visitors to Mandaloria's four public product areas. Use
 * after the public hero; do not use as application navigation or for arbitrary
 * collections. It has standard marketing density, no loading/error ownership,
 * and rows reflow from a stacked mobile layout to aligned desktop columns. Each
 * row is one descriptive native link with a visible focus state and a decorative
 * icon hidden from assistive technology. Copy should remain a short title plus
 * one sentence; long text wraps without clipping at 320px and no content is
 * hidden at any viewport.
 *
 * Source structure adapted from Tailark's composable feature-section patterns;
 * upstream cards, illustrations, animation, and palette styles are omitted.
 * @see https://tailark.com/r/features-4.json
 */
function CapabilityList() {
  return (
    <section aria-labelledby="capabilities-title">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="capabilities-title" className="text-2xl font-semibold tracking-tight text-fg">
            One network, four ways to participate
          </h2>
          <p className="mt-3 text-base text-fg-muted">
            Move between durable debate, live conversation, reviewed knowledge, and community
            responsibility without losing context.
          </p>
        </div>

        <ul className="mt-8 border-b border-border">
          {capabilities.map((capability) => (
            <li key={capability.href} className="border-t border-border">
              <Link
                href={capability.href}
                className="group grid min-h-11 min-w-0 gap-2 py-4 transition-colors duration-fast hover:bg-surface focus-visible:bg-surface sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-3"
              >
                <span className="font-medium text-fg transition-colors duration-fast group-hover:text-brand">
                  {capability.title}
                </span>
                <span className="min-w-0 text-sm text-fg-muted">{capability.description}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-4 w-4 text-fg-subtle transition-colors duration-fast group-hover:text-brand"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { CapabilityList };
