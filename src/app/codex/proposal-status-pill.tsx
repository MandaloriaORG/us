"use client";

import { motion, useReducedMotion } from "framer-motion";

import { Badge } from "@/components/origin/badge";
import { cn } from "@/lib/cn";
import { PROPOSAL_STATUS_LABELS, type CodexProposalStatus } from "@/lib/codex/states";

/**
 * Semantic pill for proposal status: gold for the open pipeline, green for a
 * published article, red for a proposal that closed without one. The dot plus
 * the label keep the meaning readable without colour alone.
 */
const STATUS_PILL_STYLES: Record<CodexProposalStatus, string> = {
  proposed: "border-brand/35 bg-brand/10 text-brand dark:bg-brand/20",
  classified: "border-brand/35 bg-brand/10 text-brand dark:bg-brand/20",
  drafting: "border-brand/35 bg-brand/10 text-brand dark:bg-brand/20",
  reviewed: "border-brand/35 bg-brand/10 text-brand dark:bg-brand/20",
  reopened: "border-brand/35 bg-brand/10 text-brand dark:bg-brand/20",
  published: "border-success/35 bg-success/10 text-success-foreground dark:bg-success/20",
  rejected:
    "border-destructive/35 bg-destructive/10 text-destructive-foreground dark:bg-destructive/20",
  withdrawn:
    "border-destructive/35 bg-destructive/10 text-destructive-foreground dark:bg-destructive/20",
  replaced:
    "border-destructive/35 bg-destructive/10 text-destructive-foreground dark:bg-destructive/20",
};

const STATUS_DOT_STYLES: Record<CodexProposalStatus, string> = {
  proposed: "bg-brand",
  classified: "bg-brand",
  drafting: "bg-brand",
  reviewed: "bg-brand",
  reopened: "bg-brand",
  published: "bg-success",
  rejected: "bg-destructive",
  withdrawn: "bg-destructive",
  replaced: "bg-destructive",
};

export function ProposalStatusPill({ status }: { status: CodexProposalStatus }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      animate={{ opacity: 1, y: 0 }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Badge variant="outline" className={STATUS_PILL_STYLES[status]}>
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", STATUS_DOT_STYLES[status])}
        />
        {PROPOSAL_STATUS_LABELS[status]}
      </Badge>
    </motion.span>
  );
}
