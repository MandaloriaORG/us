# Mandaloria Design & Coding Rules

Mandatory for UI work. Source: `docs/DESIGN_SYSTEM.md`; gate: `docs/dev/DESIGN_VERIFICATION.md`.

## Product UI & Layout

- Dark, precise, compact, content-first; routine UI quiet, brand effects in one focal region.
- Hierarchy: typography → spacing → alignment/divider → surface. One H1/primary action. No repeated eyebrow+title+description or obvious help.
- 4px grid: related 8-16px, groups 24px, sections 24-40px. Gutters 16/24/32px. App padding 12-16px; dialogs 20-24px; no default `p-8/p-10`.
- Use an alignment spine, no arbitrary offsets/widths. Controls in one region share height; compact density only in data/admin regions.
- Card only for an independent/selectable/reusable/elevated unit. No nesting/full-page card. Headers, toolbars, filters, forms, sidebars, tables, sections are not cards by default.
- Rows=homogeneous items; tables=comparison; grids/cards=exploration. Related metrics share a strip/grid.
- One depth cue/surface: border, background, or shadow. Shadow only overlays/sticky. Radius 4-8px UI, 12px dialogs; pills only tags/status/filters/avatars.
- Metadata is quiet text; badges mean status/category/filter. No generic gradients, glow, glass, blobs, icon tiles, huge icons, or decorative panels.
- Mobile removes frames/padding before stacking; actions move, never vanish. Targets ≥44×44px via hit area, not visual bloat.

## Interaction & Content

- Forms: visible labels; one column default; width matches input. Validate after interaction, error beside field, preserve input, warn before discard, one save model.
- Actions name verb/object. Use direct sentence-case copy and canonical terms; no functional marketing filler.
- No loader flash; skeleton matches result. Busy/error stays local; toast only background/cross-page. Optimistic UI only safe/reversible; undo when relevant.
- URL stores key search/filter/sort/tab/page state; Back restores context. Active location is not color-only; breadcrumbs require depth; no duplicate nav level.
- Dialogs are short and never nested; long work uses a page. Dismissal cannot silently lose input; focus is safe/restored.
- Product UI is not a cinematic HUD/game UI: no gratuitous hexagons, clipped corners, crosshairs, scanlines, fake readouts, decorative uppercase, wide tracking, or Cinzel in controls.

## Data, States & Accessibility

- Text left; numbers right/tabular. Table=exact comparison; chart=pattern. Prefer number/text over chart, ≤5 series, accessible alternative.
- Data handles skeleton/content/empty/partial/error/denied without flicker. Empty: sober icon, specific title/reason/action; never “No data,” blame, cute filler.
- Feedback uses icon+text, never color alone. Motion communicates state/flow only, uses transform/opacity, lasts ≤400ms, and respects `prefers-reduced-motion`.
- Nothing essential hover/tooltip-only. Keyboard order=visual; focus visible/restored. Task works at 200% zoom/320 CSS px; gestures have alternatives.
- Test 0/1/many, long text, missing media, slow/offline/error/permission data, 320/768/1280/1440px, keyboard/touch/200% zoom.

## Components & Code

- Sources: Tailark=marketing; Origin=controls; ReUI=data; shadcn=a11y; Custom=brand/domain. Restyle imports; never mix raw aesthetics/install a library for one control.
- Shared components define purpose, use/non-use, density, responsive/a11y/async contracts, content limits, and applicable interaction/data states.
- Same concept=same component/interaction. New token/variant needs semantic reuse, not one screenshot. Evaluate extraction after 3 stable uses; avoid premature abstraction.
- CSS-variable colors only; no hardcoded palettes. Inter UI; Cinzel logo/marketing hero/Casa names only. Lucide 16/20/24px.
- One component/file; named exports; `cn()` from `@/lib/cn`; approved component folders only.

## Before Done / Routing

Define goal, hierarchy, density/pattern, source, RSC/client boundary, feedback, reuse, stress cases. Try removing a card, border, badge, heading, padding level. Run the gate.

Routes: domain `.agent/CONTEXT.md`; features `docs/dev/MASTER_CHECKLIST.md`; DB/RLS `docs/dev/SUPABASE_PORTABILITY_AND_RECOVERY.md`; security/review `docs/dev/THREAT_MODEL_AND_ATTACK_CHECKLIST.md`.

Done = behavior + permissions/RLS + validation + privacy/moderation/audit + states + design + tests, verified.
