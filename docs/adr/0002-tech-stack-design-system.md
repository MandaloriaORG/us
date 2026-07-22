---
status: accepted
---

# Tech Stack and Design System

Mandaloria uses the Next.js 14+ App Router with TypeScript, Supabase as its backend, Tailwind CSS as its styling layer, and a component system built on shadcn/ui accessible primitives. ReUI, Origin UI, and Tailark complement those primitives in their specific domains. The visual system follows a dark, cold, precise, and premium aesthetic with project-owned semantic tokens.

## Stack

| Layer           | Technology                                  | Rationale                                                 |
| --------------- | ------------------------------------------- | --------------------------------------------------------- |
| Framework       | Next.js 14+ App Router                      | SSR, RSC, streaming, protected routes, API routes         |
| Language        | TypeScript in strict mode                   | Type safety and maintainability                           |
| Styling         | Tailwind CSS v3 + CSS variables             | Semantic tokens, dark mode, no hardcoded component colors |
| UI primitives   | shadcn/ui with Radix                        | Accessibility, focus management, keyboard navigation      |
| Data components | ReUI                                        | Dashboards, tables, filters, kanban, calendars, charts    |
| Form components | Origin UI                                   | Inputs, selects, toggles, date pickers, small controls    |
| Public blocks   | Tailark                                     | Hero, features, stats, testimonials, pricing, footer      |
| Animation       | Motion / Framer Motion                      | Modal, tab, and purposeful interaction transitions        |
| Validation      | Zod + react-hook-form                       | Shared client/server schemas                              |
| Authentication  | Supabase Auth: email/password, future OAuth | Native RLS integration                                    |
| Database        | Supabase Postgres                           | RLS, versioned migrations, backups                        |
| Storage         | Supabase Storage                            | Avatars, attachments, public/private buckets              |
| Testing         | Vitest + Playwright                         | Unit and end-to-end tests                                 |
| Linting         | ESLint + Prettier                           | Code consistency                                          |
| Package manager | pnpm                                        | Efficiency and strict resolution                          |

## Design principles

- **Hick's Law**: minimize visible choices, group related actions, and disclose decisions progressively.
- **Fitts's Law**: keep touch targets at least 44×44px and place primary actions near the natural task flow. Hit-area size does not require oversized visual padding.
- **Law of Proximity**: keep related elements together and separate distinct sections with clear, proportional space.
- **Miller's Law**: group information into manageable chunks and avoid saturated views.
- **Occam's Razor**: use the simplest solution that works and avoid visual overengineering.
- **Jakob's Law**: use familiar patterns for login, navigation, and search; innovate where domain or brand identity benefits.

## Density and containment

- Product UI is compact and content-first. Use typography, spacing, alignment, and dividers before introducing another surface.
- Cards are reserved for independent, selectable, reusable, or truly elevated units. Cards must never be nested or used as a rounded wrapper for a complete page.
- Routine application surfaces use 12-16px padding; 20-24px is reserved for dialogs, sheets, or a deliberately featured region.
- Each surface uses one primary depth cue: border, background change, or shadow. Shadows are reserved for overlays and active elevation.
- Homogeneous collections use rows, comparisons use tables, and grids/cards support non-linear exploration.
- A view has one clear H1 and normally one visible primary action.

## Interaction and content quality

- Forms keep visible labels, preserve input on failure, use one clear save model, and name actions with a specific verb and object.
- Loading and error feedback stays in the smallest affected region. Optimistic updates are limited to safe, reversible actions.
- Important search, filter, sort, tab, and pagination state is URL-addressable and recoverable through navigation.
- Dialogs are limited to short focused work, never nest, preserve focus, and cannot silently discard input.
- Tables support exact comparison; charts support pattern recognition and always include accessible context or an alternative.
- Product copy is direct, uses canonical domain terms, and avoids promotional filler in functional UI.
- The complete primary task works with keyboard, touch, 200% zoom, and a 320 CSS-pixel viewport.
- Reusable components are verified against realistic content extremes and define their state, responsive, and accessibility contracts.

## Brand restraint

- Mandaloria identity comes from precise language, rare Cinzel moments, the Beskar accent, domain concepts, and custom knowledge visualizations.
- Routine UI does not imitate a cinematic HUD or game interface.
- Gratuitous hexagons, clipped corners, crosshairs, scanlines, fake readouts, decorative uppercase, and wide tracking are excluded from functional surfaces.
- Rich effects remain inside one purposeful focal region and never reduce contrast, scanning speed, or target clarity.

## 60-30-10 color rule

- 60% base/background.
- Up to 30% structural and independent surfaces. This is a ceiling, not a card quota.
- No more than 10% brand or feedback accent for CTAs, active states, and indicators.

Brand color signals meaning; it does not dominate the interface.

## UI color hierarchy

1. **Brand** → primary actions, active states, progress.
2. **Foreground** → primary text, active icons.
3. **Muted** → secondary text, inactive icons.
4. **Border** → separators and interactive boundaries.
5. **Background** → primary page background.
6. **Surface** → structural or independent regions.
7. **Feedback** → success, warning, error, and information states.

Feedback color is never the only state indicator; pair it with an icon and text.

## Empty-state anatomy

Every empty state includes:

1. A relevant, restrained icon or illustration, never generic cute filler.
2. A specific title that identifies the view or condition.
3. A description of why it is empty and what can happen next.
4. A relevant, actionable next step.
5. Neutral language that never blames the user or falls back to “No data.”

Types:

- **First use**: onboarding and an initial creation action.
- **No results**: search/filter context, alternatives, and a clear-filters action.
- **Cleared state**: confirmation plus an undo, history, or create action.
- **Error state**: what failed in human language and how to recover.
- **Permission denied**: why access is restricted and a permitted alternative.

## Folder architecture

```text
src/
  components/
    ui/             → Restyled shadcn/Radix primitives
    origin/         → Adapted form controls and local UI from Origin UI
    reui/           → Adapted dashboards, tables, and data components from ReUI
    marketing/      → Adapted public blocks from Tailark
    system/         → Custom visual components: pipeline, graph, console
    layout/         → Header, footer, navigation, page shell
  lib/
    utils.ts
    cn.ts
  styles/
    tokens.css      → Semantic CSS variables
    globals.css     → Tailwind directives and resets
```

## Target component proportion

- 60-70% custom components and project design system.
- 20-30% components adapted from Tailark, Origin UI, and ReUI.
- 10% shadcn/Radix behavioral primitives.

## Consequences

- Every imported component must be adapted to project tokens: color, typography, borders, spacing, and motion.
- Raw visual styles from different libraries must never be mixed.
- When adapting a component would take more than 15-20 minutes longer than building a clean project-native version, build the custom version.
- Do not introduce redundant dependencies; keep bundle size and complexity under control.
- Prefer React Server Components for static public pages; use `'use client'` only for interactivity.
- Always respect `prefers-reduced-motion`.
- Dark mode is the default; light mode may be added later through semantic tokens.
- New tokens and shared variants require semantic justification; one-off screenshot matching does not expand the system API.
- Stable patterns are evaluated for extraction after three real uses, while premature abstractions are avoided.
- Design review includes realistic content states plus mobile, desktop, keyboard, touch, and zoom evidence.
- `docs/DESIGN_SYSTEM.md` is the detailed source of truth, and `docs/dev/DESIGN_VERIFICATION.md` is the completion gate.
