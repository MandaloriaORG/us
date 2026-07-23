---
status: accepted
---

# Phosphor as the single icon set

Mandaloria replaces Lucide with Phosphor Icons (`@phosphor-icons/react`) as its single icon set. Icons are imported from the `@phosphor-icons/react/dist/ssr` subpath so they render inside React Server Components, and only the non-deprecated `NameIcon` exports are used.

## Context

The registries Mandaloria draws from do not ship an icon set: Tailark blocks import `lucide-react` directly, and coss/ReUI items are Base UI components that carry no icons of their own. Their visual character comes from composition and styling, not from iconography. Choosing a distinct icon set is therefore an independent decision, not something inherited from a registry.

Lucide is the default of the shadcn ecosystem and reads as generic. Phosphor offers six weights over one consistent 256-unit grid, which lets product UI stay quiet at `regular` while identity surfaces can use `duotone` or `fill` without mixing families.

## Decision

- One icon set across the product: Phosphor, `regular` weight in controls and routine UI.
- Import path is `@phosphor-icons/react/dist/ssr`. The default entry point is client-only and breaks Server Components.
- `lucide-react` is removed from the dependency manifest so the old set cannot reappear silently.
- `components.json` keeps `"iconLibrary": "lucide"` because the shadcn CLI only accepts its own known values; any component generated through the CLI must have its icon imports remapped to Phosphor before it is committed.

## Consequences

Registry source pulled from Tailark, coss, or ReUI arrives with Lucide imports and needs one extra adaptation step, which is consistent with the existing rule that registry components are source material rather than dependencies. Phosphor's default size is `1em` instead of `24`, so every icon must carry explicit `h-*`/`w-*` classes. Weight replaces stroke width as the density control.
