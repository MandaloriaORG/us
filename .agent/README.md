# Agent Context Loading

Mandaloria keeps startup context small. The SessionStart loader injects `.agent/DESIGN_RULES.md` as its primary context so every UI task receives the durable design and coding constraints. If that file is unavailable, it falls back to `.agent/CONTEXT.md`; agents read `CONTEXT.md` separately when domain terminology or invariants are relevant.

## Integrations

- Claude Code: `CLAUDE.md` imports the shared `AGENTS.md`, and `.claude/settings.json` runs the compact SessionStart hook.
- Codex: `.codex/hooks.json` runs the same hook after the project hook is trusted.
- OpenCode: `opencode.json` loads both `.agent/DESIGN_RULES.md` and `.agent/CONTEXT.md` as project instructions; its plugin preserves both sources and their task-specific routing reminder during compaction.
- Other AGENTS.md-compatible tools: root `AGENTS.md` points to the compact context.

## Token budget

The loader injects at most 5,000 characters. If `DESIGN_RULES.md` exceeds that limit, it injects only a short warning and asks the agent to read and reduce the file.

Keep detailed design rationale in `docs/DESIGN_SYSTEM.md` and verification criteria in `docs/dev/DESIGN_VERIFICATION.md`. Add only durable, compact constraints to `DESIGN_RULES.md`; keep domain invariants and document routing in `CONTEXT.md`.

## Verification

```sh
node .agent/hooks/load-context.mjs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s))'
```

In Codex, use `/hooks` to review and trust the project hook. Project-local hooks are skipped until the repository is trusted and the hook definition is approved.
