# Agent Context Loading

Mandaloria keeps startup context small. `.agent/CONTEXT.md` contains only mandatory invariants and routes agents to task-specific documentation.

## Integrations

- Claude Code: `CLAUDE.md` imports the shared `AGENTS.md`, and `.claude/settings.json` runs the compact SessionStart hook.
- Codex: `.codex/hooks.json` runs the same hook after the project hook is trusted.
- OpenCode: `opencode.json` loads the compact context as project instructions; its plugin preserves the reminder during compaction.
- Other AGENTS.md-compatible tools: root `AGENTS.md` points to the compact context.

## Token budget

The loader injects at most 5,000 characters. If the compact file exceeds that limit, it injects only a short warning and asks the agent to read and reduce the file.

Keep detailed requirements in `docs/`. Add only durable invariants and document-routing rules to `.agent/CONTEXT.md`.

## Verification

```sh
node .agent/hooks/load-context.mjs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s))'
```

In Codex, use `/hooks` to review and trust the project hook. Project-local hooks are skipped until the repository is trusted and the hook definition is approved.
