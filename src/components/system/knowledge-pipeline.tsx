import { BookOpen, FileText, MessageSquare, ShieldCheck, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

interface KnowledgeStage {
  name: string;
  description: string;
  icon: LucideIcon;
  destination?: boolean;
}

const KNOWLEDGE_STAGES: readonly KnowledgeStage[] = [
  {
    name: "Conversation",
    description: "A useful question takes shape in the community.",
    icon: MessageSquare,
  },
  {
    name: "Proposal",
    description: "Allowed sources and contributors remain attached.",
    icon: FileText,
  },
  {
    name: "Review",
    description: "Evidence, privacy, and attribution are verified.",
    icon: ShieldCheck,
  },
  {
    name: "Codex Libre",
    description: "A reviewed version becomes lasting free knowledge.",
    icon: BookOpen,
    destination: true,
  },
];

export interface KnowledgePipelineProps {
  className?: string;
}

/**
 * Custom, server-renderable overview of Mandaloria's public knowledge lifecycle.
 *
 * Use once in a public identity or explanatory surface where the relationship
 * between conversation, proposal, review, and Codex Libre needs to be visible.
 * Do not use as live proposal progress, a workflow control, or a substitute for
 * the detailed Codex timeline. The component owns exactly four concise stages;
 * callers own surrounding headings, actions, loading, error, and permission
 * states. It stays compact, uses native ordered-list semantics, and changes only
 * from a vertical narrow-screen flow to four columns at `sm`. The visible
 * destination label communicates the final stage without relying on color.
 * There is no client boundary, asynchronous state, hidden
 * hover content, or motion, so the same reading order remains usable at 320 CSS
 * pixels, 200% zoom, with a keyboard, or with reduced motion enabled.
 *
 * Source: Mandaloria custom system component, derived from the lifecycle in
 * `docs/KNOWLEDGE_LIFECYCLE.md`; no external component registry is used.
 */
export function KnowledgePipeline({ className }: KnowledgePipelineProps) {
  return (
    <figure
      aria-describedby="knowledge-pipeline-description"
      aria-labelledby="knowledge-pipeline-title"
      className={cn("border-y border-border py-4 text-left", className)}
    >
      <figcaption id="knowledge-pipeline-title" className="text-sm font-semibold text-fg">
        Knowledge lifecycle
      </figcaption>
      <p id="knowledge-pipeline-description" className="mt-1 max-w-2xl text-sm text-fg-muted">
        Community insight becomes reviewed, attributable knowledge without losing its source.
      </p>

      <ol
        aria-label="Conversation to Codex Libre stages"
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4"
      >
        {KNOWLEDGE_STAGES.map((stage, index) => {
          const Icon = stage.icon;

          return (
            <li
              key={stage.name}
              className={cn(
                "min-w-0 border-l pl-4 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-4",
                stage.destination ? "border-brand" : "border-border",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="text-xs tabular-nums text-fg-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-fg-muted" />
                <span className="min-w-0 text-sm font-medium text-fg">{stage.name}</span>
              </div>

              <p className="mt-2 max-w-64 text-xs leading-5 text-fg-muted">{stage.description}</p>

              {stage.destination ? (
                <span className="mt-2 inline-flex rounded-full border border-brand/40 px-2 py-0.5 text-xs font-medium text-brand">
                  Destination
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
