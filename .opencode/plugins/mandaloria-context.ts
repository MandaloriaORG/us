import type { Plugin } from "@opencode-ai/plugin";

export const MandaloriaContextPlugin: Plugin = async () => ({
  "experimental.session.compacting": async (_input, output) => {
    output.context.push(
      "Preserve Mandaloria's mandatory design and coding rules from .agent/DESIGN_RULES.md plus its domain and Supabase invariants from .agent/CONTEXT.md. Reload only the task-specific documents routed by those files after compaction.",
    );
  },
});
