# Design System — Mandaloria

## Visual philosophy

Mandaloria is dark, cold, precise, and premium. Product UI is compact and content-first: deep backgrounds, tightly controlled surfaces, discreet borders, and limited accents. Brand color signals actions and state without taking over the interface. Identity moments may be cinematic; routine UI remains quiet. Every element has a purpose, and nothing is decorative without a reason.

## Applied UX laws

### Hick's Law — Minimize decisions

- Keep primary navigation to five to seven items; move the rest into submenus or “More.”
- Group related actions in contextual menus instead of flat action trays.
- Use progressive forms that reveal fields only when they become relevant.
- Keep common filters visible and collapse advanced filters.

### Fitts's Law — Accessible targets

- Touch targets are at least 44×44px.
- Compact controls may expand their hit area without inflating visible padding or overlapping neighboring targets.
- Place primary actions near the natural task flow: at the end of a form or beside the object they affect.
- Keep destructive actions physically separated from constructive actions and require proportional confirmation.
- Make the complete navigation item interactive; do not rely only on the text or use decorative padding to simulate accessibility.

### Law of Proximity — Visual grouping

- Related elements use an 8-16px gap.
- Functional groups use 24px. Distinct product sections use 24-40px.
- Reserve 48-64px for marketing or an intentional editorial pause, not automatic section spacing.
- Keep label, input, help, and error together; separate that group from the next field.
- Reserve card grids for genuinely independent units; homogeneous collections use rows and dividers.

### Miller's Law — Chunking

- Paginate or chunk long lists; do not present more than 20 items without navigational or visual structure.
- Group navigation into categories of roughly five to seven items.
- Divide long forms into logical steps.
- Group dashboard information by domain: content, moderation, system, and so on.

### Occam's Razor — Simplicity

- If the design requires an explanation, simplify it.
- Avoid “cool” motion that does not communicate state, feedback, hierarchy, or progress.
- Prefer one column unless the content is dense enough to benefit from another.
- Do not invent patterns where standard login, search, form, table, and pagination patterns work.

### Jakob's Law — Familiarity

- Use standard patterns for login, registration, search, pagination, and notifications.
- Innovate in brand identity, knowledge visualization, and the Casas/Clanes system.
- Keep one icon set and one visual treatment throughout the product.

---

## Density, containment, and hierarchy

These rules are mandatory in the authenticated application. Marketing pages may use more space or a more expressive composition when there is a clear brand purpose.

### Layout scale

| Relationship     | Space   | Use                                               |
| ---------------- | ------- | ------------------------------------------------- |
| Inline           | 4-8px   | Icon + text, metadata, tightly related controls   |
| Related          | 8-16px  | Content within a group or compound control        |
| Functional group | 24px    | Form blocks, toolbar + content                    |
| Product section  | 24-40px | A real change in topic or task                    |
| Editorial pause  | 48-64px | Marketing or long-form content; never the default |

- Page gutters are 16px on mobile, 24px on tablet, and 32px on desktop.
- Routine application surfaces use 12-16px padding. Dialogs, sheets, and a deliberately featured region may use 20-24px. Avoid default `p-8` and `p-10`.
- Long-form text stays within 60-75 characters per line.
- Forms normally use one column and a task-appropriate width, usually no more than 640px. Data interfaces may use the available width.
- Minimum hit-area size and visible padding are separate decisions: accessible targets do not require every control to look large.

### When to create a container

Build hierarchy in this order: **typography → spacing → alignment/divider → surface**. Create a card only when the block is independent and satisfies at least one condition:

- It is selected, opened, reordered, or acted on as one unit.
- It has its own state or actions that need a semantic boundary.
- It can be reused or moved without depending on its surrounding visual context.
- It is genuinely elevated out of the flow, such as a popover or dialog.

If none apply, keep the content in the normal flow. In addition:

- Never nest cards or wrap a complete page in a rounded card.
- Headers, toolbars, filters, forms, sidebars, tables, and ordinary sections are not cards by default.
- Use compact rows for homogeneous collections, tables for comparison, and grids/cards for non-linear exploration.
- Empty and error states inherit the container of their list; they do not need another internal card.
- Related metrics share a continuous strip or grid; do not create an ornamented card around every number.

### Depth and shape

- Every surface uses **one** primary depth cue: a border, background shift, or shadow. Do not stack all three.
- Reserve shadows for overlays, menus, dialogs, and active sticky elevation. An in-flow card normally uses a background shift or border, not a shadow.
- Use a 4-8px radius for product controls and surfaces, and 12px for dialogs and sheets.
- Use a full pill only for avatars, tags, status, filters, or an intentionally pill-shaped control.
- Borders communicate structure or interaction; do not draw a rectangle around every available block.
- Metadata uses quiet text. Badges are reserved for status, category, and actionable filters.

### Generated-UI anti-patterns

- A view has one clear H1 and normally one visible primary action.
- Do not repeat eyebrow + oversized heading + description in every section or add obvious helper copy.
- Do not use large icons inside rounded squares as visual filler.
- Do not use generic gradients, glow, glassmorphism, blobs, or decorative panels. Allow at most one purposeful brand focal region per page.
- On mobile, remove nonessential frames and padding before stacking containers; do not turn the desktop layout into vertical “card soup.”
- Before approving a screen, try removing one card, border, badge, heading, and padding level. Keep each only if removing it loses meaning.

### Alignment and density consistency

- Every screen has a primary alignment spine. Titles, section content, filters, and primary actions align to deliberate shared edges.
- Do not introduce arbitrary offsets, widths, or one-off negative margins to make a single screenshot look balanced.
- Related elements align across sections when they represent the same hierarchy, even when their content lengths differ.
- Choose width by task: reading uses a narrow measure, forms use a task-appropriate column, and data views use the available canvas.
- Do not center functional content by habit. Centering is appropriate for short focused tasks, intentional marketing compositions, and some empty states.
- Controls in the same toolbar or form region share a visual height. Do not mix 32px, 40px, and 48px controls without a semantic reason.
- Compact density is an explicit mode for admin and data-heavy regions, not a global excuse to reduce accessibility or readability.
- Do not use oversized headings or empty whitespace to compensate for weak information hierarchy.

---

## Design tokens

### Color palette — Dark mode by default

```css
:root {
  /* Background hierarchy */
  --color-bg: 210 15% 6%; /* Main background — deep space */
  --color-bg-raised: 210 15% 9%; /* Independent units, modals */
  --color-bg-overlay: 210 15% 12%; /* Dropdowns, popovers, sheets */

  /* Surfaces */
  --color-surface: 210 12% 13%; /* Structural regions */
  --color-surface-raised: 210 12% 17%; /* Active elevation, hover */

  /* Foreground */
  --color-fg: 210 10% 94%; /* Primary text */
  --color-fg-muted: 210 8% 65%; /* Secondary text, placeholders */
  --color-fg-subtle: 210 8% 45%; /* Tertiary text, captions */

  /* Borders */
  --color-border: 210 10% 18%; /* Standard borders */
  --color-border-raised: 210 10% 24%; /* Elevated/interactive borders */
  --color-border-focus: 210 30% 50%; /* Focus rings */

  /* Brand — Beskar, muted amber/silver */
  --color-brand: 42 40% 55%; /* Beskar gold */
  --color-brand-muted: 42 20% 30%; /* Brand backgrounds */
  --color-brand-fg: 42 50% 20%; /* Text on brand */

  /* Feedback */
  --color-success: 150 45% 45%;
  --color-warning: 36 70% 50%;
  --color-error: 0 65% 55%;
  --color-info: 200 55% 55%;

  /* Typography */
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
  --font-display: "Cinzel", "Inter", serif;

  /* Type scale — 1.25 modular scale */
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.125rem; /* 18px */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 1.875rem; /* 30px */
  --text-4xl: 2.25rem; /* 36px */
  --text-5xl: 3rem; /* 48px */

  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line heights */
  --leading-tight: 1.25; /* Headings */
  --leading-snug: 1.375; /* Subheadings */
  --leading-normal: 1.6; /* Body */
  --leading-relaxed: 1.75; /* Long form */

  /* Spacing — 4px base unit */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-10: 2.5rem; /* 40px */
  --space-12: 3rem; /* 48px */
  --space-16: 4rem; /* 64px */
  --space-20: 5rem; /* 80px */
  --space-24: 6rem; /* 96px */

  /* Radii */
  --radius-sm: 0.25rem; /* 4px — badges, tags */
  --radius-md: 0.5rem; /* 8px — buttons, inputs, units */
  --radius-lg: 0.75rem; /* 12px — dialogs, sheets */
  --radius-xl: 1rem; /* 16px — exceptional brand region */
  --radius-full: 9999px; /* Pills, avatars */

  /* Shadows — restrained in dark mode */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.18);
  --shadow-md: 0 6px 16px rgb(0 0 0 / 0.22);
  --shadow-lg: 0 12px 32px rgb(0 0 0 / 0.28);
  --shadow-xl: 0 24px 64px rgb(0 0 0 / 0.34);

  /* Elevation / z-index */
  --z-base: 0;
  --z-raised: 10; /* Sticky headers, active elevation */
  --z-dropdown: 100; /* Dropdowns, popovers */
  --z-overlay: 200; /* Modals, sheets */
  --z-toast: 300; /* Toasts, notifications */
  --z-tooltip: 400; /* Tooltips */

  /* Motion */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

### Applied 60-30-10 rule

| Layer                   | Share            | Tokens                                         | Use                                             |
| ----------------------- | ---------------- | ---------------------------------------------- | ----------------------------------------------- |
| Base                    | About 60%        | `--color-bg` + `--color-surface`               | Main background, sidebars, page shell           |
| Differentiated surfaces | Up to 30%        | `--color-bg-raised` + `--color-surface-raised` | Structural regions, independent units, overlays |
| Accent                  | No more than 10% | `--color-brand` + feedback colors              | CTAs, links, badges, indicators, focus          |

The 30% is a ceiling for differentiated surfaces, not a card quota. A page may remain almost entirely on the base background when typography and spacing provide enough hierarchy.

---

## Color for feedback and state

### UI states

| State    | Token                    | Use                                             |
| -------- | ------------------------ | ----------------------------------------------- |
| Default  | `--color-border`         | Inactive interactive boundary                   |
| Hover    | `--color-surface-raised` | Hover background for rows and interactive units |
| Focus    | `--color-border-focus`   | 2px focus ring with 2px offset                  |
| Active   | `--color-brand`          | Selected item, active navigation, toggle on     |
| Disabled | `--color-fg-subtle`      | Muted text/border, approximately 0.5 opacity    |
| Loading  | Skeleton pulse           | Placeholder while data loads                    |

### Feedback colors

| Feedback    | Token             | Use                                                  |
| ----------- | ----------------- | ---------------------------------------------------- |
| Success     | `--color-success` | Completed operation, verification, publication       |
| Warning     | `--color-warning` | Attention needed, pending content, approaching limit |
| Error       | `--color-error`   | Operation failure, validation, forbidden action      |
| Information | `--color-info`    | Contextual information and neutral status            |

- Color is never the only state indicator; add an icon and text.
- Toasts use a feedback icon, semantic color, and a clear message.
- Status badges follow the same semantic mapping.

---

## Forms and validation

- Labels remain visible. A placeholder may demonstrate format or provide an example, but it never replaces the label.
- Use one column by default. Multiple columns are allowed only for short, closely related fields that remain understandable and usable on mobile.
- Field width reflects expected input: short codes, dates, and counts should not look like long-form text fields.
- Do not show an error before the user has had a reasonable opportunity to complete the field. Validate on blur, submit, or after meaningful input according to the task.
- Place field errors beside the source. Long or multi-step forms also provide an error summary that moves focus to the first invalid field.
- Preserve entered data when submission or saving fails.
- Warn before navigation discards unsaved changes. Do not block navigation when nothing changed.
- Use one save model per flow. Do not mix autosave and an explicit **Save** action without clearly distinguishing what each persists.
- Primary form actions use a specific verb and object, such as **Create Plaza** or **Publish article**, rather than generic **Submit** or **Confirm**.
- Disabled controls must not hide why an action is unavailable; provide adjacent explanation when the reason is not obvious.

## Loading, feedback, and recovery

- Avoid flashing a loading indicator for operations that complete in under roughly 200ms. If work continues, show feedback in the smallest affected region.
- Skeletons mirror the final geometry and information hierarchy; do not use generic rectangles unrelated to the result.
- Disable or mark busy only the controls and regions affected by the operation. Do not freeze the complete page for a local mutation.
- Use inline feedback for field, row, panel, or page-local problems. Reserve toasts for cross-page confirmation, background completion, or information with no natural inline location.
- Use optimistic updates only for safe, reversible actions. Provide undo when the consequence matters; otherwise wait for server confirmation.
- Operations lasting more than a few seconds communicate determinate progress when available, or a clear current status when it is not.
- Errors preserve context and user input, explain what can happen next, and expose retry only when retry is meaningful.
- Destructive confirmation names the action and object. Prefer recoverable deletion or undo when the domain permits it.
- Success feedback is proportional: do not show a modal for routine success or stack inline confirmation and a toast for the same event.

## Navigation and wayfinding

- Important search, filter, sort, tab, and pagination state belongs in the URL so views can be shared, refreshed, and restored.
- Back navigation preserves useful filters, scroll position, and list context whenever the platform allows it.
- Active location uses more than color alone and remains clear at a glance.
- Breadcrumbs appear only when the information architecture has meaningful depth; they are not decoration for shallow pages.
- Do not duplicate the same hierarchy across sidebar, tabs, and page header. Each navigation layer must represent a distinct level.
- Tabs switch peer views of the same context. Use navigation links when the destination has its own route or task identity.
- No action disappears on mobile. Reposition it, shorten nonessential copy, or move secondary actions into a labeled menu.
- Returning from a detail view should restore the originating collection state rather than reset the user’s work.

## Dialogs, sheets, and overlays

- Use a dialog for a short, focused decision or task that must interrupt the current context.
- Never nest dialogs. Close or replace the current overlay, or move the flow to a dedicated page.
- Long, multi-step, or reference-heavy tasks belong on a page rather than in an oversized modal.
- Use sheets for contextual secondary work or mobile adaptation, not as an automatic replacement for every page.
- Escape and backdrop dismissal must not discard entered data silently. Warn, preserve, or disable that dismissal when loss is possible.
- Return focus to the triggering control after close and choose a safe initial focus target on open.
- Destructive actions are never the default focused action.
- Tooltips and popovers do not contain information required to complete the primary task unless the same information is accessible elsewhere.

---

## Empty states — Anatomy and types

### Anatomy

```text
┌─────────────────────────────────────────┐
│                                         │
│             [Relevant icon]             │  1. Restrained, not cute filler
│                                         │
│              Specific title             │  2. What is this view or state?
│                                         │
│   Why it is empty and what can happen   │  3. Useful context
│   next, in direct human language.       │
│                                         │
│              [Primary action]           │  4. Relevant next step
│                                         │
│          [Optional secondary link]      │  5. Permitted alternative
│                                         │
└─────────────────────────────────────────┘
```

### 1. First use

Use when someone enters a feature for the first time.

- **Title**: “Start your first [X].”
- **Description**: explain the feature's value in one sentence.
- **Action**: create the first item.
- **Example**: “Start your first post” → “Share an idea with this Plaza.” → **Create post**.

### 2. No results

Use when a search or filter returns nothing.

- **Title**: “No results for ‘[term]’.”
- **Description**: suggest checking spelling, broadening the query, or removing filters.
- **Action**: clear filters or try another search.
- Never show “No data” or “Nothing found” without context.

### 3. Cleared state

Use when someone completes or clears everything.

- **Title**: “All done” or a domain-specific confirmation.
- **Description**: confirm the successful state.
- **Action**: offer history, undo, or create new when relevant.
- **Example**: “You have reviewed every report.” → **View history**.

### 4. Error state

Use when data or an operation fails.

- **Title**: describe the failed task rather than using a vague error.
- **Description**: explain the problem in human language.
- **Action**: retry, plus a safe escape route when appropriate.
- Never expose stack traces or HTTP codes to end users.

### 5. Permission denied

Use when the current user cannot access a resource.

- **Title**: “Access restricted.”
- **Description**: explain the applicable permission boundary without exposing sensitive policy details.
- **Action**: return to a permitted area or request access when the workflow supports it.

### Empty-state mistakes to avoid

| Mistake                             | Correction                                                          |
| ----------------------------------- | ------------------------------------------------------------------- |
| “No data”                           | “There are no posts in this Plaza yet.” + a permitted create action |
| No next step                        | Offer an action or permitted alternative when one exists            |
| Generic cute illustration           | Use a restrained, context-relevant icon                             |
| User-blaming language               | Describe the state neutrally                                        |
| One generic message everywhere      | Make the copy specific to the content and condition                 |
| Empty state before loading resolves | Transition skeleton → content/empty without flicker                 |
| Empty state in another card         | Inherit the list or page container                                  |

---

## Typography

### Type hierarchy

| Level      | Class                              | Use                                |
| ---------- | ---------------------------------- | ---------------------------------- |
| Display    | `font-display text-5xl`            | Marketing hero or identity moment  |
| H1         | `font-sans text-3xl font-semibold` | The unique title of a product view |
| H2         | `font-sans text-2xl font-semibold` | Primary section                    |
| H3         | `font-sans text-xl font-semibold`  | Subsection                         |
| H4         | `font-sans text-lg font-medium`    | Independent unit or widget         |
| Body       | `font-sans text-base`              | Primary text                       |
| Body small | `font-sans text-sm`                | Secondary text and descriptions    |
| Caption    | `font-sans text-xs text-fg-muted`  | Metadata and timestamps            |
| Code       | `font-mono text-sm`                | Code, slugs, technical data        |

### Typography rules

- Keep long-form content to 60-75 characters per line.
- Use generous line height for body text; `leading-relaxed` is appropriate for articles.
- Use Cinzel only for identity moments: logo, marketing hero titles, and Casa names.
- Never use the display font for functional UI, buttons, or long text.
- A product view has one H1. Do not scale headings up to compensate for weak layout hierarchy.
- Avoid chains of redundant subtitles and descriptions; secondary text must add context or support a decision.

---

## Content and microcopy

- Functional UI uses direct product language, not marketing language. Avoid “unlock,” “elevate,” “seamless,” and similar filler inside the application.
- Button labels use a specific verb and, when useful, its object: **Create Plaza**, **Publish article**, **Remove member**.
- Avoid ambiguous labels such as **Continue**, **Confirm**, and **Submit** when the actual action can be named.
- Destructive copy identifies the exact object and consequence; never rely on a generic “Are you sure?”
- Use sentence case by default. Reserve uppercase for short technical abbreviations or a deliberately defined overline/status style.
- One concept has one canonical domain term. Do not alternate between synonyms for visual variety.
- Helper text explains a constraint, consequence, format, or next step. Remove it when it merely restates the label.
- Format dates, times, counts, and numbers consistently through locale-aware utilities. Use semantic `<time>` values where applicable.
- Relative time is useful for scanning, but an exact accessible value must remain available when precision matters.
- Keep instructions positive and actionable. Do not blame the user or expose implementation language.

---

## Elevation and depth

In dark mode, communicate elevation through background clarity and use shadows only when an element leaves the normal flow.

| Layer       | Background           | Typical depth cue              | Use                        |
| ----------- | -------------------- | ------------------------------ | -------------------------- |
| Base        | `--color-bg`         | None                           | Page background            |
| Structural  | `--color-surface`    | Divider or background shift    | Sidebar, persistent region |
| Independent | `--color-bg-raised`  | Border **or** background shift | Selectable/reusable unit   |
| Overlay     | `--color-bg-overlay` | `shadow-md` or `shadow-lg`     | Dropdown, popover, menu    |
| Modal       | `--color-bg-raised`  | `shadow-lg` or `shadow-xl`     | Dialog, sheet              |

Do not assign a shadow automatically because a component uses `bg-raised`. Choose one primary depth signal based on its relationship to neighboring content.

---

## Tables and data visualization

- Align text to the left and numeric values to the right. Use tabular numerals where changing digit widths would harm scanning.
- Use a table when users compare exact values across items. Use a chart when they need to perceive trend, distribution, relationship, or composition.
- Do not create a chart when a number, sentence, progress value, or small table answers the question more directly.
- Prefer no more than five simultaneously encoded series. For more, use filtering, direct selection, grouping, or small multiples.
- Label data directly when practical. Legends must remain close, readable, and keyboard/screen-reader compatible.
- Every chart has a clear question, units, time range, and an accessible text summary or data-table alternative.
- Do not turn every table cell into a badge. Reserve badges for semantic states or categories.
- Truncate only when the full value remains available without pointer-only interaction and the hidden portion is not required for comparison.
- Define column priority. On narrow screens, hide or move low-priority columns before compromising primary values and actions.
- Sorting, filtering, selection, pagination, loading, empty, partial, and error states must preserve table geometry and context.
- Do not use color alone to distinguish series, thresholds, or status; combine color with labels, shape, line style, or iconography.

---

## Motion

### Principles

- **Purpose**: motion communicates flow, feedback, hierarchy, or progress. It is never decorative.
- **Duration**: use 150-250ms for microinteractions and 300-400ms for page transitions.
- **Easing**: use `ease-out` for entry and `ease-in-out` for state changes.
- **Reduced motion**: always respect `prefers-reduced-motion`; remove nonessential animation when reduction is requested.

### Appropriate motion

| Context            | Treatment                   | Duration          |
| ------------------ | --------------------------- | ----------------- |
| Dialog open/close  | Scale + fade                | 200ms ease-out    |
| Dropdown/popover   | Fade + 4px slide            | 150ms ease-out    |
| Tab change         | Fade or horizontal slide    | 200ms ease-in-out |
| Toast entry        | Slide from edge + fade      | 250ms ease-out    |
| Toast exit         | Fade                        | 150ms ease-out    |
| Hover state        | Background/color transition | 150ms ease-out    |
| Skeleton → content | Crossfade                   | 300ms ease-out    |
| Page transition    | Fade                        | 300ms ease-in-out |

### Motion to avoid

- Mass scroll-entry animation.
- Infinite animation, except a loading indicator while work is active.
- Particles or decorative background effects.
- Any animation longer than 500ms that blocks interaction.

---

## Dark mode

- Dark mode is the default and the only mode in the MVP.
- If light mode is added later, define each token under `[data-theme="light"]`.
- Do not use Tailwind `dark:` variants; use semantic CSS tokens so theme changes are centralized.
- Keep dark-mode shadows restrained and reserve them for genuine elevation.

---

## Iconography

- Use Lucide Icons consistently.
- Standard sizes: 16px inline, 20px in UI controls, and 24px standalone.
- Use a 1.5-2 stroke width depending on size.
- Icons inherit their parent's color; interactive icons move from `--color-fg-muted` to `--color-fg` on hover.
- Do not place every icon in a rounded tile. Add a container only when it communicates selection, status, or a hit area.

---

## Mandaloria brand restraint

- Express Mandaloria through precise language, rare Cinzel moments, the Beskar accent, domain concepts, and custom knowledge visualizations.
- Functional UI must not imitate a cinematic HUD or game interface.
- Avoid gratuitous hexagons, clipped corners, crosshairs, scanlines, targeting grids, ornamental brackets, and fake technical readouts.
- Do not use uppercase, wide letter spacing, or Cinzel in buttons, forms, tables, navigation, or routine labels.
- A rich brand visualization remains inside its focal region; its effects do not leak into surrounding controls or data surfaces.
- Brand expression never reduces contrast, scanning speed, target clarity, or content density.

---

## Accessibility beyond baseline compliance

- No essential information or action exists only on hover or inside a tooltip.
- Keyboard order follows the visual and semantic reading order; do not use positive `tabindex` to repair a broken layout.
- Sticky headers, banners, and overlays never obscure the focused element.
- The complete task works at 200% browser zoom and at a 320 CSS-pixel viewport without loss of content or action.
- Icon-only controls are limited to universally familiar actions, have an accessible name, and expose a visible label when ambiguity remains.
- Dynamic success, error, progress, and result-count changes use an appropriate live-region strategy without excessive announcements.
- Long forms provide an accessible error summary and move focus deliberately after failed submission.
- Focus is trapped only in modal contexts and always restored after the modal closes.
- Touch and pointer gestures have a non-gesture alternative. Drag-and-drop is never the only way to reorder or move content.
- Respect user preferences for reduced motion, contrast, and text size wherever the platform exposes them.

---

## Responsive behavior

### Breakpoints

| Name  | Width  | Use                             |
| ----- | ------ | ------------------------------- |
| `sm`  | 640px  | Landscape mobile, small tablets |
| `md`  | 768px  | Tablets                         |
| `lg`  | 1024px | Small desktop                   |
| `xl`  | 1280px | Desktop                         |
| `2xl` | 1536px | Large desktop                   |

### Rules

- Design mobile-first and add complexity at larger breakpoints.
- Use 16px gutters on mobile, 24px from `md`, and 32px from `lg`.
- Collapse the sidebar into a drawer or bottom sheet on mobile.
- Use bottom navigation plus a menu on mobile and the appropriate desktop navigation pattern at larger widths.
- Make tables responsive by hiding secondary columns or using intentional horizontal scrolling.
- Present dialogs as full-screen sheets on mobile when the task benefits from the space.
- Remove wrappers, borders, and padding that no longer express a useful relationship on the smaller viewport.
- Preserve action priority: keep one primary action visible and move secondary actions into a menu when space is limited.

---

## Content and viewport stress testing

Every page and reusable data component is reviewed with realistic extremes, not only the ideal fixture:

- Zero, one, a typical amount, and many items.
- Very long names, titles, URLs, and unbroken values.
- Missing, delayed, and broken images or attachments.
- Partial, stale, or permission-filtered data.
- Slow loading, recoverable failure, offline/reconnect, and repeated submission.
- Permission denied and permissions changing while the view is open.
- 200% zoom and increased text size.
- Representative widths around 320px, 768px, 1280px, and 1440px.
- Keyboard-only and touch-only completion of the primary task.

The layout must wrap, truncate, scroll, or reflow intentionally. Content may not overlap, escape its container, hide required actions, or cause uncontrolled layout shift.

## Design-system governance

- Do not create a new color, spacing, radius, shadow, or typography token to solve one isolated component.
- Do not introduce arbitrary values when an existing token is close enough and preserves system rhythm.
- Name tokens by semantic purpose rather than their current visual value.
- The same concept uses the same component and interaction model across the product.
- A new component variant needs a semantic reason, not merely a visual preference.
- When a pattern appears three times, evaluate extraction into a shared component; do not abstract earlier when the use cases are still unclear.
- Every shared component documents when to use it, when not to use it, its density, responsive behavior, accessibility contract, and supported states.
- Library examples are references, not authority. Project tokens and Mandaloria containment rules always win.
- Design review includes mobile and desktop evidence plus realistic content states, not only a polished empty fixture.
- Update `docs/DESIGN_SYSTEM.md`, `docs/COMPONENT_ARCHITECTURE.md`, and `docs/dev/DESIGN_VERIFICATION.md` when a durable pattern or exception changes.
