#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const maxChars = 5000;

function findProjectRoot(start) {
  let current = start;
  const root = parse(current).root;

  while (true) {
    try {
      readFileSync(join(current, ".agent", "CONTEXT.md"));
      return current;
    } catch {
      if (current === root) return null;
      current = dirname(current);
    }
  }
}

const root = process.env.CLAUDE_PROJECT_DIR || findProjectRoot(process.cwd());

if (!root) {
  process.exit(0);
}

// Load DESIGN_RULES.md as primary injected context (actionable rules for agents)
const designRulesPath = join(root, ".agent", "DESIGN_RULES.md");
let context;

try {
  context = readFileSync(designRulesPath, "utf8").trim();
} catch {
  // Fallback to CONTEXT.md if DESIGN_RULES.md doesn't exist
  try {
    context = readFileSync(join(root, ".agent", "CONTEXT.md"), "utf8").trim();
  } catch {
    process.exit(0);
  }
}

if (context.length > maxChars) {
  context = [
    "Mandaloria context exceeded its 5000-character budget.",
    "Read .agent/DESIGN_RULES.md before working and reduce it before adding more rules.",
  ].join(" ");
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  }),
);
