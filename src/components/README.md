# Shared component inventory

This directory is the implementation boundary for Mandaloria's shared UI. Registry
components are source material, not drop-in dependencies: inspect them first, retain
their useful interaction and accessibility mechanics, and restyle them with the
project tokens before committing them here.

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

| Component                                                                              | Provenance                                  | Local adaptation                                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `origin/text-input`, `password-input`, `search-input`, `native-select`, `status-badge` | coss Field, Input, and Input Group patterns | React 18/Radix/Tailwind 3 controls with visible labels, local states, and project tokens.   |
| `reui/data-table`                                                                      | ReUI Data Grid table structure              | Server-rendered comparison table; URL filtering, sorting, and pagination stay in the route. |
| `marketing/public-hero`                                                                | Tailark `veil-hero-section-3` structure     | Static copy/CTA/visual hierarchy without its header, image, motion, or raw theme.           |
| `marketing/capability-list`                                                            | Tailark divided feature-section patterns    | Four canonical domain links in a continuous semantic list rather than decorative cards.     |
| `system/knowledge-pipeline`                                                            | Mandaloria knowledge lifecycle              | Custom ordered conversation → proposal → review → Codex Libre identity visual.              |
| `layout/mobile-nav`                                                                    | shadcn Dropdown Menu behavior on Radix      | Keyboard-safe compact navigation when global links move out of a narrow header.             |

## Compatibility policy

Mandaloria currently targets React 18, Tailwind CSS 3, and Radix. Current coss and
some ReUI registry items target Base UI and/or Tailwind CSS 4, so they must not be
copied wholesale. Port only the relevant structure, states, keyboard semantics, and
accessibility behavior. Adding Base UI or changing the styling runtime requires an
explicit architecture decision.

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
