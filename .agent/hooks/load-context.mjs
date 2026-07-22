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

const contextPath = join(root, ".agent", "CONTEXT.md");
let context;

try {
  context = readFileSync(contextPath, "utf8").trim();
} catch {
  process.exit(0);
}

if (context.length > maxChars) {
  context = [
    "Mandaloria context exceeded its 5000-character budget.",
    "Read .agent/CONTEXT.md before working and reduce it before adding more rules.",
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
