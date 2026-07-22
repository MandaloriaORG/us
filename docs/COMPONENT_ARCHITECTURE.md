# Component Architecture — Mandaloria

## Guiding principle

> shadcn/ui does not define the final visual style. It provides infrastructure for accessibility, interaction states, and robust behavior. Every imported component must be adapted to the project design system.

## Decision rules

| Need                                                       | Look here first | Notes                                                          |
| ---------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| Complete public-page block                                 | **Tailark**     | Hero, features, stats, testimonials, pricing, footer           |
| Small form or local UI control                             | **Origin UI**   | Inputs, selects, toggles, date pickers, avatars, badges        |
| Dense data or operations interface                         | **ReUI**        | Dashboards, tables, filters, kanban, calendars, charts         |
| Complex accessibility or behavior                          | **shadcn/ui**   | Dialogs, dropdowns, popovers, tabs, accordion, command palette |
| Identity or differentiating section                        | **Custom**      | Pipeline, graph, console, timeline, hero focal element         |
| Adaptation would take longer than building it (>15-20 min) | **Custom**      | Build from scratch with project tokens                         |

---

## Libraries and their domains

### 1. shadcn/ui — Accessible primitives

**Purpose**: behavioral infrastructure. Never use its default visual style.

**Use for**:

- Dialogs and modals: focus trap, backdrop, Escape handling.
- Dropdown menus: keyboard navigation and submenus.
- Popovers and tooltips: positioning and focus management.
- Selects and comboboxes: typeahead and keyboard selection.
- Command palette or command menu.
- Tabs: keyboard navigation between panels.
- Accordion: accessible expansion.
- Toasts: screen-reader announcements.
- Forms with accessible validation and error states.
- Mobile drawer or sheet: gestures and backdrop.
- Keyboard navigation and focus management.

**Required adaptation**:

- Rewrite all classes with project tokens.
- Replace hardcoded colors such as `zinc-*` and `slate-*` with `--color-*` tokens.
- Match radii, shadows, spacing, and typography to the design system.

**Do not use for**:

- The visual styling of a component.
- Components that do not require complex ARIA behavior.

### 2. Origin UI — Small controls and local UI

**Purpose**: a copy-paste toolkit of refined, reusable controls with solid mechanics.

**Operational source note (2026-07)**: Origin UI now resolves to coss UI. Its
registry is configured as `@coss` in `components.json`. The current upstream uses
Base UI and Tailwind CSS 4 patterns, while Mandaloria remains on React 18, Radix,
and Tailwind CSS 3. Inspect registry source with `shadcn view`, then port only the
needed mechanics into `src/components/origin/**`; do not install or paste the
upstream stack wholesale without an explicit architecture decision.

**Use for**:

- Text, search, and password inputs.
- Textareas and form controls.
- Checkboxes, radios, switches, and segmented controls.
- Buttons with loading state, icon buttons, and button groups.
- Avatars, badges, status indicators, and counters.
- Lightweight tooltips, copy-to-clipboard, and small utilities.
- Date pickers, sliders, range inputs, and compact controls.
- Small empty states, loaders, and skeletons.
- Local microinteractions, not complete sections.

**Required adaptation**:

- Apply the same token, color, typography, radius, and shadow requirements as shadcn/ui.
- If an equivalent shadcn control already exists, choose one implementation rather than keeping both.

**Do not use for**:

- Building entire pages.
- Layout or navigation components.

### 3. Tailark — Public pages and marketing

**Purpose**: responsive marketing blocks for the public website. It provides section structure, not the internal application UI.

**Use for**:

- Public navbar and navigation.
- Hero sections, adapted with a project-specific visualization rather than a generic mockup.
- Problem, solution, and value-proposition sections.
- Feature, integration, and capability sections.
- Logo clouds and social proof.
- Metrics and stats.
- Testimonials, case studies, and proof sections.
- Pricing, FAQs, CTAs, and contact forms.
- Footer.
- Public pages such as About, Docs, and Changelog.

**Required adaptation**:

- Use a block as a starting point, then simplify its layout.
- Replace generic content with Mandaloria-specific messaging.
- Add one or two custom components that differentiate the page.
- Do not paste ten unrelated blocks together; curate and connect them.

**Do not use for**:

- The project landing page without adding custom visual components.
- Authenticated areas, dashboards, or internal tools.

**Mandaloria hero**: the hero must not be a generic dashboard mockup. It should contain a custom visualization such as the knowledge flow (conversation → proposal → review → Codex), a Plazas/Casas graph, a knowledge-lifecycle timeline, or a product-system demonstration.

### 4. ReUI — Dense interfaces, dashboards, and data

**Purpose**: information-rich product surfaces with complex operations.

**Operational source note**: ReUI is configured as `@reui` in `components.json`.
Inspect every registry item before adoption. Prefer the smallest server-renderable
adaptation that satisfies the current product contract; only introduce its optional
TanStack, drag-and-drop, or Base UI dependencies when the required interaction
actually justifies them.

**Use for**:

- Admin and Council dashboards.
- User, post, and report lists.
- Tables with sorting, pagination, filters, and selection.
- Kanban views for managing knowledge proposals.
- Calendars and activity timelines.
- Advanced and saved filters.
- Trees and hierarchies such as Codex categories or Plaza structure.
- Analytics views and charts.
- Configuration, management, operations, and administration screens.
- Empty, loading, and error states for complex flows.

**Required adaptation**:

- Apply project tokens to every component.
- Charts must answer specific questions, not serve as decoration.
- Combine charts with real states: skeletons, labels, tooltips, and appropriate containment.
- Apply the density and containment rules from `docs/DESIGN_SYSTEM.md`; a data component is not automatically a card.

**Do not use for**:

- Marketing home pages, which Tailark addresses better.
- Small form controls, which Origin UI addresses better.

### 5. Custom components — Identity and differentiation

**Purpose**: the elements that make the product memorable, built specifically for Mandaloria.

**Planned custom components**:

| Component           | Description                                                       | Phase     |
| ------------------- | ----------------------------------------------------------------- | --------- |
| `KnowledgePipeline` | Visualizes the conversation → proposal → review → Codex lifecycle | Phase 0-1 |
| `PlazaMap`          | Visual map of Plazas and their relationships                      | Phase 2   |
| `HouseEmblem`       | Casa emblem generator and viewer                                  | Phase 5   |
| `ActivityConsole`   | Real-time system activity stream                                  | Phase 4   |
| `CodexTimeline`     | Version timeline for a Codex article                              | Phase 4   |
| `RoleHierarchy`     | Visualizes role and permission hierarchy                          | Phase 1   |
| `ModerationQueue`   | Moderation queue interface with quick actions                     | Phase 3   |
| `ProposalGraph`     | Graph of knowledge proposals and their sources                    | Phase 4   |

---

## Folder structure

```text
src/
  components/
    ui/                  → Restyled primitives
      button.tsx         → Buttons: primary, secondary, ghost, destructive
      input.tsx          → Base input
      dialog.tsx         → Accessible modal
      dropdown.tsx       → Dropdown menu
      popover.tsx        → Popover
      tooltip.tsx        → Tooltip
      select.tsx         → Select/combobox
      tabs.tsx           → Tabs
      accordion.tsx      → Accordion
      toast.tsx          → Toast notifications
      sheet.tsx          → Mobile drawer/sheet
      command.tsx        → Command palette
      badge.tsx          → Badge/tag
      avatar.tsx         → Avatar
      skeleton.tsx       → Skeleton loader
      empty-state.tsx    → Empty-state wrapper

    origin/              → Controls adapted from Origin UI
      checkbox.tsx       → Checkbox
      radio.tsx          → Radio group
      switch.tsx         → Toggle switch
      textarea.tsx       → Textarea
      search-input.tsx   → Search input with icon
      password-input.tsx → Password input with visibility toggle
      date-picker.tsx    → Date picker
      slider.tsx         → Range slider
      segmented.tsx      → Segmented control
      copy-button.tsx    → Copy to clipboard
      status-indicator.tsx → Status indicator: online, offline, warning
      counter.tsx        → Animated counter

    reui/                → Data components adapted from ReUI
      data-table.tsx     → Table with sorting, pagination, selection
      filter-bar.tsx     → Advanced filter bar
      kanban.tsx         → Kanban view
      calendar.tsx       → Calendar view
      stats-card.tsx     → Compact metric unit for a continuous strip/grid
      chart-container.tsx → Chart container with states
      tree-view.tsx      → Tree/hierarchy view
      timeline.tsx       → Event timeline

    marketing/           → Blocks adapted from Tailark
      navbar.tsx         → Public navigation
      hero.tsx           → Hero section
      features.tsx       → Feature section
      stats.tsx          → Stats/metrics section
      testimonials.tsx   → Testimonials/proof
      cta.tsx            → Call-to-action section
      faq.tsx            → FAQ accordion
      footer.tsx         → Footer

    system/              → Custom visual components
      knowledge-pipeline.tsx  → Knowledge-lifecycle visualization
      plaza-map.tsx           → Plazas map
      house-emblem.tsx        → Casa emblem
      activity-console.tsx    → Activity console
      codex-timeline.tsx      → Codex version timeline
      role-hierarchy.tsx      → Role hierarchy

    layout/              → Layout shells
      root-layout.tsx    → Root layout: html, body, providers
      public-layout.tsx  → Public-page layout: navbar + footer
      app-layout.tsx     → Authenticated layout: sidebar + header + content
      admin-layout.tsx   → Council/admin layout
      sidebar.tsx        → Navigation sidebar
      mobile-nav.tsx     → Mobile navigation: bottom nav + drawer
      page-header.tsx    → Page header with breadcrumbs
```

---

## Target proportion

| Type                                  | Share  | Examples                                     |
| ------------------------------------- | ------ | -------------------------------------------- |
| Custom components + design system     | 60-70% | KnowledgePipeline, tokens, layout, `system/` |
| Adapted from Tailark, Origin UI, ReUI | 20-30% | Hero, data table, search input               |
| shadcn/Radix primitives               | 10%    | Dialog, dropdown, tabs, command              |

---

## Page-level decision flow

Before implementing a page, answer:

1. **Goal**: what must the user accomplish here?
2. **Hierarchy**: what matters most, and what should they see first?
3. **Content pattern**: should the data use rows, a table, cards, or a custom visualization?
4. **Component source**: which parts come from Tailark, Origin UI, ReUI, shadcn, or custom code?
5. **Interactivity**: what requires React on the client, and what can remain static or server-rendered?
6. **Reuse**: which components from this page will be used elsewhere?
7. **Feedback model**: where do loading, success, partial, empty, error, and permission states live?
8. **Stress cases**: what happens with long content, many items, slow responses, narrow viewports, and changed permissions?

---

## Shared component contract

Every shared component defines and preserves:

- **Semantic responsibility**: the one concept or task the component represents.
- **Use and non-use guidance**: when the pattern is appropriate and when a simpler pattern is better.
- **Content pattern**: row, table, card, form control, navigation, overlay, or custom visualization.
- **Variants**: only semantically meaningful variants; cosmetic one-offs stay outside the shared API.
- **Density**: standard and, only when justified, compact behavior with consistent internal control heights.
- **States**: applicable default, hover, focus, active, selected, disabled, busy, skeleton, empty, partial, error, and permission states.
- **Responsive behavior**: priority, wrapping, reflow, overflow, and which secondary content may move or hide.
- **Accessibility contract**: element semantics, accessible name, keyboard model, focus behavior, announcements, and reduced-motion behavior.
- **Content limits**: intentional handling for long labels, missing media, many items, and unbroken values.
- **Async ownership**: whether the component owns loading/retry/optimistic behavior or receives resolved state from its parent.

Do not add a prop or variant solely to reproduce one screenshot. If a use case conflicts with the contract, reconsider the composition before expanding the shared component.

---

## Integration rules

- **Never mix** the raw styles of two libraries in one component; restyle both first.
- **Adapt before importing**: every copied component must use project tokens.
- **Do not duplicate**: when two libraries provide the same control, choose one implementation.
- **Protect the bundle**: do not add a complete library for one component; evaluate copy-paste adaptation.
- **TypeScript**: every component must define explicit prop types.
- **Required states**: every data component covers loading, empty, error, and relevant edge cases.
- **Containment**: imported examples do not override the project rules for cards, padding, shadows, radii, or responsive density.
- **Token discipline**: use existing semantic tokens when they are sufficiently close; do not create a token for one isolated component.
- **Variant discipline**: every shared variant has a semantic purpose and documented behavior across states and viewports.
- **Rule of three**: evaluate extraction when the same stable pattern appears three times; do not abstract while the cases are still materially different.
- **Consistent concepts**: the same domain concept uses the same component and interaction model across the product.
- **Evidence**: review shared components with mobile/desktop layouts, realistic content extremes, keyboard interaction, and 200% zoom.
