# Mandaloria Agent Instructions

<!-- codebase-memory-mcp:start -->
# Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.
ALWAYS prefer MCP graph tools over grep/glob/file-search for code discovery.

## Priority Order
1. `search_graph`
2. `trace_path`
3. `get_code_snippet`
4. `query_graph`
5. `get_architecture`

Fall back to `rg` for non-code files, literal strings, configuration, or insufficient graph results.
<!-- codebase-memory-mcp:end -->

## Required Context

Session hooks inject `.agent/CONTEXT.md`. If it was not injected, read it before working.

Do not load every document at startup. Use the routing table in `.agent/CONTEXT.md` and read only the files relevant to the current task. For large checklists, locate the relevant heading instead of reading the entire file.

## Non-negotiable Rules

- The repository is the source of truth for schema and reproducible configuration.
- No Supabase change may exist only in the Dashboard.
- Database, RLS, Storage, Auth, Realtime, cron, webhook, or infrastructure changes must follow `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md`.
- Never expose secrets or service-role credentials.
- Preserve user changes and do not edit unrelated files.
- Mark checklist items complete only after implementation and verification.
- Update affected documentation when a domain or architectural decision changes.
