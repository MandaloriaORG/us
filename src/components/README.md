# Shared component inventory

This directory is the implementation boundary for Mandaloria's shared UI. Registry
components are installed real — never hand-cloned — and restyled via tokens and
`className`. Inspect the source before adding, then let `shadcn add` write the file
and only edit for token/wiring adjustments.

## No clones policy

Never reimplement a registry component from scratch to "match the style". Install it
with `pnpm dlx shadcn add @coss/<name>` (or `@reui/`, `@tailark/`, plain shadcn),
then compose or restyle in place. The registry install _is_ the style enforcement.

Allowed local files:

- Thin composition wrappers (labelled Field + Input + Error, etc.).
- Mandaloria-only components (brand identity, domain visuals — `system/`, `layout/`).
- Server-safe adapters when the registry primitive is client-only (e.g. `native-select`).

## Provenance

| Local layer  | Upstream source                                                    | Local responsibility                          |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------- |
| `ui/`        | [shadcn/ui](https://ui.shadcn.com/) and Radix primitives           | Accessible behavior and low-level primitives. |
| `origin/`    | [coss UI](https://coss.com/ui/docs), the current Origin UI lineage | Refined, small controls and form mechanics.   |
| `reui/`      | [ReUI](https://reui.io/docs)                                       | Dense data and operations surfaces.           |
| `marketing/` | [Tailark](https://tailark.com/docs)                                | Public marketing sections only.               |
| `system/`    | Mandaloria                                                         | Product identity and domain-specific visuals. |
| `layout/`    | Mandaloria                                                         | Shared public, product, and Council shells.   |

The configured shadcn-compatible namespaces live in `/components.json`. Before
using one, run `pnpm dlx shadcn@latest view @namespace/component` and review its
dependencies and generated source. Do not run `add` until the adaptation boundary
and destination are known.

## Implemented adaptations

| Component                                                                       | Provenance                               | Local adaptation                                                                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `origin/field`, `input`, `input-group`, `select`, `badge`, `textarea`           | coss registry (`@coss/*`) on Base UI     | Installed real via `shadcn add`; only class/token wiring locally.                                 |
| `origin/text-input`, `password-input`, `search-input`                           | Composition on coss `Field` + `Input`    | Thin wrappers adding label + description + inline error + optional Phosphor icon; not clones.     |
| `origin/native-select`                                                          | Mandaloria server adapter                | Native `<select>` for URL-filter forms in RSC where coss `Select` (client) is not usable.         |
| `ui/data-table`                                                                 | Mandaloria server-rendered `<table>`     | Comparison table driven by URL state; not a ReUI DataGrid wrapper. Columns + rows + a11y caption. |
| `ui/*` (button, checkbox, dropdown-menu, input, popover, select, skeleton, ...) | shadcn (`shadcn add`) on Radix           | Base primitives; Mandaloria variants where noted (button primary/secondary/ghost/destructive).    |
| `marketing/public-hero`                                                         | Tailark `veil-hero-section-3` structure  | Static copy/CTA/visual hierarchy without its header, image, motion, or raw theme.                 |
| `marketing/capability-list`                                                     | Tailark divided feature-section patterns | Four canonical domain links in a continuous semantic list rather than decorative cards.           |
| `system/knowledge-pipeline`                                                     | Mandaloria knowledge lifecycle           | Custom ordered conversation → proposal → review → Codex Libre identity visual.                    |
| `layout/mobile-nav`                                                             | shadcn Dropdown Menu behavior on Radix   | Keyboard-safe compact navigation when global links move out of a narrow header.                   |

## Iconography

Registry source arrives with `lucide-react` imports. Mandaloria uses Phosphor
(`@phosphor-icons/react/dist/ssr`, non-deprecated `NameIcon` exports, `regular`
weight) as its single icon set — see `docs/adr/0003-phosphor-icon-set.md`. Remap
icon imports as part of the adaptation, before committing a component here.

## Compatibility policy

Mandaloria runs on React 18, Tailwind CSS 4 (`@theme` block, no `tailwind.config.ts`),
Radix (for shadcn primitives), and Base UI (`@base-ui/react`, used by coss and some
ReUI items). New tokens go in `src/styles/globals.css` under `@theme`. Do not
hand-clone registry items — install real, then restyle via `className`/tokens.

**Validity is server-owned.** Base UI's `Field.Error` renders only while Base UI
itself tracks the field's validity, and renders nothing otherwise — which silently
drops the message and strips the control's accessible description. Mandaloria
decides validity on the server, from a Server Action result or a database
rejection, so `origin/field` exports its own `FieldError`. Do not swap it back for
the primitive; the auth and profile tests fail closed on this.

## Shared component contract

Every exported shared component must make these points clear in its source-level
documentation or tests:

1. Upstream source and what was adapted.
2. Its semantic responsibility and when not to use it.
3. Supported density, validation, loading, empty, disabled, and error states.
4. Responsive and accessibility behavior, including labels and keyboard access.
5. Content limits and ownership of asynchronous behavior.

Pages compose these components; they must not silently fork their styling or
authorization behavior. Product authority remains on the server and never belongs
to a visual component.
