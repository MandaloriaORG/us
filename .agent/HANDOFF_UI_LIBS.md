# Handoff — UI Libraries Migration (coss / ReUI / Tailark)

Last updated: 2026-07-23. Author: previous session (compacted).

Read this file if you are picking up UI/design work on Mandaloria and do not
have prior conversation memory. Everything here reflects the state of the
working tree at handoff — verify with `git status` before editing.

---

## 1. Why this migration existed

The codebase had hand-written components that looked like coss / ReUI /
Tailark but were not the real registry components. The user asked:

> "no quiero clones hechos a mano, quiero los reales"

Goal: install the actual registry components via `pnpm dlx shadcn add`,
keep the Mandaloria (Beskar) palette, and apply the design rules on top —
never re-implement a registry primitive from scratch.

A permanent rule now lives in `.agent/DESIGN_RULES.md` (see
"Components & Code" → "No hand-written clones of registry components").

## 2. What was completed

All tasks below are DONE. Verification: `pnpm typecheck` (0), `pnpm lint`
(0), `pnpm test` (419/419), `pnpm build` (20 routes) — all green at handoff.

- Tailwind CSS v3 → v4 migration. `tailwind.config.ts` deleted;
  `src/styles/tokens.css` folded into `src/styles/globals.css` under
  `@theme`. PostCSS uses `@tailwindcss/postcss`. Beskar palette lives in
  `@theme` as raw `hsl()` values with shadcn compat aliases
  (`--color-background: var(--color-bg)`, etc.).
- `components.json` aliases: `@coss → @/components/origin`,
  `@reui → @/components/reui` (dir removed but alias kept for future
  installs), `@tailark → @/components/marketing`. `css` path fixed to
  `src/styles/globals.css`.
- coss primitives installed real (Base UI-backed) in
  `src/components/origin/`: `field.tsx`, `input.tsx`, `input-group.tsx`,
  `select.tsx`, `badge.tsx`, `textarea.tsx`.
- Thin composition wrappers rewritten on top of coss `Field` + `Input`:
  `origin/text-input.tsx`, `origin/password-input.tsx`,
  `origin/search-input.tsx`. Each adds label + description + inline error
  + optional Phosphor icon. They are not clones.
- `origin/native-select.tsx` kept as a Mandaloria server adapter — a
  native `<select>` for RSC URL-filter forms where coss `Select`
  (client-only) is not usable.
- `origin/status-badge.tsx` deleted. Consumers migrated to coss `Badge`
  with `variant="success|warning|error|outline"` (mapping:
  `danger → error`, `neutral → outline`).
- shadcn primitives (Radix) installed in `src/components/ui/`:
  `checkbox`, `dropdown-menu`, `input`, `popover`, `select`, `separator`,
  `spinner` (plus existing `button`, `skeleton`, `avatar`, `empty-state`).
- `src/components/ui/data-table.tsx` — Mandaloria server-rendered
  `<table>` for URL-driven pagination/sort/filter. NOT a wrapper of
  ReUI DataGrid. Column/row shape is documented at the top of the file.
- ReUI DataGrid attempt abandoned and `src/components/reui/` deleted.
  Reason: ReUI DataGrid mixes Base UI patterns (render props,
  `alignItemWithTrigger`, indeterminate checkbox) that conflict with the
  Radix primitives we install for shadcn. The server-rendered table is
  architecturally correct for our URL-state pages.
- Icons: Phosphor only, from `@phosphor-icons/react/dist/ssr`, regular
  weight. Registry `lucide-react` imports are remapped as part of
  adaptation. See `docs/adr/0003-phosphor-icon-set.md`.
- Button variants preserved: `primary | secondary | ghost | destructive`
  with sizes `sm | md | lg | icon | icon-sm`. `Loader2` swapped for
  `CircleNotchIcon`.
- Docs updated: `src/components/README.md` (provenance table, no-clones
  section, Tailwind 4 + Base UI compat note), `.agent/DESIGN_RULES.md`
  (no-clones rule under "Components & Code").
- `.eslintrc.json` extended with `next/typescript`, `no-explicit-any`,
  `no-unused-vars` (with `^_` ignore).

## 3. What is NOT done / open items

- Working tree has ~93 modified/untracked files pending review. Nothing
  is committed. `git status --short` will show the full list. The user
  has not asked to commit — do not commit unprompted. When they ask,
  stage in logical chunks (Tailwind v4 migration; coss install +
  wrappers; ReUI removal + data-table; docs + rules). Note: unrelated
  in-progress work (plazas/posts feature, content actions, Supabase
  migrations 0007/0008) is mixed into the untracked file list — do not
  bundle that into the UI-libs commit.
- Visual QA (2026-07-23): ran `pnpm typecheck` (0 errors), `pnpm lint`
  (0), `pnpm test` (419/419), `pnpm build` (22 routes, 2 more than the
  20 at last handoff — `/plazas/[slug]`, `/posts/[postId]`, `robots.txt`
  from the unrelated in-progress feature). Then drove a headless
  Chromium (`playwright-core` + system `/usr/bin/chromium`, no
  `chromium-cli`/browser-automation MCP installed in this environment)
  against `pnpm dev` and screenshotted `/`, `/auth/login`,
  `/auth/register`, `/auth/forgot-password`, `/members`. All render
  correctly: Beskar dark/gold palette, coss `Field`+`Input` with
  Phosphor icons, primary button gold fill, sober empty state on
  `/members`. No console/hydration errors (one unrelated pre-existing
  `favicon.ico` 404, not part of this migration).
  `/council/users`, `/council/audit`, `/profile/edit` correctly
  redirect unauthenticated requests to
  `/auth/login?reason=session_unavailable&next=...` — confirms the
  auth gate still works post-migration, but the actual authenticated
  rendering of those three pages (real coss `Badge`/`Select` usage,
  data-table) is still unverified — there's no documented test/council
  account. Do this next if the user wants full coverage: create a user,
  grant council role, re-run the same screenshot pass signed in.
- If the user asks to add more coss / ReUI / Tailark components in the
  future: install real via `pnpm dlx shadcn add @<ns>/<name>` and only
  add a thin wrapper if you need label/error/icon composition. Do not
  reimplement.

## 4. Non-obvious decisions worth knowing

- **Server vs client tables.** `ui/data-table` stays server-rendered
  because pages drive filters/pagination through URL search params
  (`?q=...&status=...&page=2`). Back button restores state. Do not
  swap it for a client TanStack table unless a page genuinely needs
  in-page interactive sort — and even then, keep the URL-driven
  version as the default.
- **Base UI `Field.Error` gotcha.** Base UI only renders `Field.Error`
  while it itself is tracking validity, and hides the message
  otherwise, which also strips the input's accessible description.
  Mandaloria decides validity on the server (Server Action result or
  DB rejection), so `origin/field.tsx` re-exports its own `FieldError`
  that always renders. Do not swap it for the raw primitive. See the
  note in `src/components/README.md` under "Compatibility policy".
- **native-select is a feature, not a clone.** Coss `Select` is a
  client component. Filter forms in `council/users`, `council/audit`,
  `members`, and `profile/edit` are RSC. Keeping a native `<select>`
  wrapper avoids forcing those pages client-side.
- **Tailwind v4 tokens live in one place.** All colour tokens belong
  in `src/styles/globals.css` under `@theme`. There is no
  `tailwind.config.ts` any more. `dark:` variants are avoided; theme
  overrides go through CSS custom properties.

## 5. How to verify before shipping

```
pnpm typecheck   # 0 errors expected
pnpm lint        # 0 warnings/errors expected
pnpm test        # 419 passing expected
pnpm build       # 20 routes, no runtime warnings
pnpm dev         # smoke test in browser: auth, council, profile, marketing
```

## 6. Routing (where to look before editing)

- Design rules & no-clones: `.agent/DESIGN_RULES.md`.
- Design system spec: `docs/DESIGN_SYSTEM.md`.
- Verification gate: `docs/dev/DESIGN_VERIFICATION.md`.
- Component inventory & provenance: `src/components/README.md`.
- Domain terminology (Plazas, Codex Libre, Casas, Clanes):
  `.agent/CONTEXT.md`.
- Icon ADR: `docs/adr/0003-phosphor-icon-set.md`.
- Tech stack ADR: `docs/adr/0002-tech-stack-design-system.md`.

## 7. Delete this file when

The current UI migration work is committed AND the user confirms the
visual QA pass. This file is a temporary handoff, not permanent
documentation.
