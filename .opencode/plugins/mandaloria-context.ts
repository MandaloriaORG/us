import type { Plugin } from "@opencode-ai/plugin";

export const MandaloriaContextPlugin: Plugin = async () => ({
  "experimental.session.compacting": async (_input, output) => {
    output.context.push(
      "Preserve Mandaloria's mandatory rules from .agent/CONTEXT.md. Reload only the task-specific documents named there after compaction.",
    );
  },
});
