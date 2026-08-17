"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface PipelineVisualProps {
  /** The server-rendered KnowledgePipeline figure to present. */
  children: ReactNode;
}

/**
 * Client presentation wrapper for the public knowledge-lifecycle figure.
 *
 * Mandaloria-only brand treatment: the pipeline stays a clean, semantic server
 * component (no client boundary, no motion classes inside it), while this
 * wrapper adds the flagship "alive" feel around it - a soft brand glow that
 * drifts across the top edge. The glow is decorative and aria-hidden; the
 * pipeline itself is never hidden, so content stays queryable and visible in
 * every state. The drift collapses to static under `prefers-reduced-motion`.
 * Use once, as the hero visual on the public home page; never nest a second
 * instance.
 */
export function PipelineVisual({ children }: PipelineVisualProps) {
  const reduced = useReducedMotion();

  return (
    <div className="relative">
      {reduced ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden"
        >
          <motion.div
            className="via-brand/70 h-full w-1/3 bg-linear-to-r from-transparent to-transparent"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 3.2, ease: "linear", repeat: Infinity }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
