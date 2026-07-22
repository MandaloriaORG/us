# Design Verification Checklist

Purpose: verify that every implemented feature follows the design system, UX principles, and component architecture before it is marked complete.

Rule: a feature is not complete until it passes its applicable phase checklist and every relevant global check.

---

## Verification by phase

### Phase 0 — Foundation

- [ ] Tailwind configuration uses CSS variables and no hardcoded palette colors.
- [ ] `tokens.css` defines every design-system variable.
- [ ] `globals.css` imports Tailwind directives and tokens.
- [ ] Dark mode works through tokens rather than Tailwind `dark:` variants.
- [ ] Base shadcn/ui components are restyled with project tokens.
- [ ] The base layout follows the elevation hierarchy: background → structural surface → overlay.
- [ ] Page gutters are 16px on mobile, 24px on tablet, and 32px on desktop.
- [ ] Routine surfaces use 12-16px padding; there is no automatic `p-8` or `p-10`.
- [ ] The layout shell does not wrap the complete page in a rounded card.
- [ ] Primary navigation contains no more than seven items.
- [ ] Navigation and button touch targets are at least 44×44px.
- [ ] Mobile navigation uses the approved bottom-navigation/menu pattern; desktop uses its approved navigation pattern.
- [ ] Placeholder pages use contextual empty states rather than generic “Coming soon” copy.
- [ ] The 404 page has a clear title and a route back to a safe location.
- [ ] Access-denied pages explain the boundary and offer a permitted alternative.
- [ ] Cinzel appears only in identity moments; Inter is used for functional UI.
- [ ] Body text line height is at least 1.6.
- [ ] Long-form content stays within 60-75 characters per line.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] Animations last no more than 400ms and do not block interaction beyond 500ms.
- [ ] There are no exaggerated scroll animations or decorative particles.
- [ ] Components contain no hardcoded palette colors such as `zinc-*`, `slate-*`, or `emerald-*`.

### Phase 1 — Authentication, Profiles, Permissions

- [ ] Registration and login fields are grouped by proximity.
- [ ] Validation errors appear beside the field that caused them, not only in a generic toast.
- [ ] Password fields use the adapted Origin UI `password-input`.
- [ ] `ui/button.tsx` defines primary, secondary, ghost, and destructive variants.
- [ ] Submit buttons show a loading indicator and become disabled while submitting.
- [ ] Unverified email state has clear explanatory copy and a resend action.
- [ ] Public profiles establish clear hierarchy among avatar, name, biography, roles, and badges.
- [ ] Profile editing uses logical sections rather than a wall of fields.
- [ ] Roles and badges remain visible without saturating the profile.
- [ ] The custom `RoleHierarchy` component communicates role and permission hierarchy.
- [ ] The admin user list uses an adapted ReUI data table with sorting and filters.
- [ ] Admin user detail uses a task-oriented management layout rather than a generic form.
- [ ] Suspend and ban actions require confirmation and a reason.
- [ ] Role changes produce semantic confirmation feedback.
- [ ] Filtered admin lists show a specific no-results state with a clear-filters action.
- [ ] Admin loading failures show a human-readable inline error with retry.
- [ ] The admin sidebar becomes an appropriate mobile sheet or drawer.

### Phase 2 — Plazas, Posts, Comments

- [ ] Plazas use cards only when each Plaza acts as an independent navigable unit; otherwise they use compact rows.
- [ ] The post feed is a continuous, density-controlled list without an ornamented card around every post.
- [ ] Post detail has a clear title, readable 60-75-character body width, and quiet metadata.
- [ ] Comments communicate thread relationships through indentation, connectors, or proximity.
- [ ] The post editor provides a sufficiently large writing area, optional preview, and actions at the end of the flow.
- [ ] Tags use small, muted badges and do not compete with content.
- [ ] Reaction controls meet target-size requirements and expose their meaning.
- [ ] Post states use consistent semantic badges: draft, published, hidden, and so on.
- [ ] Bookmark/save state is visually and programmatically clear.
- [ ] An empty Plaza feed explains the state and offers **Create post** only when permitted.
- [ ] Search with no results names the query, suggests alternatives, and offers **Clear search**.
- [ ] A feed error appears inline and does not collapse the complete page.
- [ ] Deleted posts preserve thread structure and show an appropriate deleted-content state.
- [ ] Mobile feeds use one column and provide an appropriate way to manage long comment threads.

### Phase 3 — Moderation and Administration

- [ ] The custom `ModerationQueue` supports fast, clear moderation actions.
- [ ] Reports use an adapted ReUI table and indicate priority with text/icon plus color.
- [ ] Moderation actions require proportional confirmation.
- [ ] Audit logs can be filtered by actor, action, and date.
- [ ] Warning and ban forms require reason, duration, and evidence when applicable.
- [ ] Restore-content feedback makes reversibility clear.
- [ ] Permanent deletion requires double confirmation and a reason.
- [ ] Key dashboard metrics use a compact strip/grid; adapted `reui/stats-card` does not create an ornamented box per number.
- [ ] Settings are grouped by domain and consequential changes require confirmation.
- [ ] Settings history uses an adapted timeline with a readable diff.
- [ ] Dashboard color follows 60-30-10: about 60% base, up to 30% structural surfaces, no more than 10% accent; it does not force cards.
- [ ] The dashboard groups information into manageable chunks without overload.

### Phase 4 — Codex Libre

- [ ] Article collections use rows with category, title, status, and date; cards appear only in a non-linear exploration mode.
- [ ] Published articles have readable typography and clearly separated metadata.
- [ ] The Markdown editor provides optional preview and a task-relevant toolbar.
- [ ] The custom `CodexTimeline` makes article versions understandable.
- [ ] The custom `ProposalGraph` shows knowledge proposals and their sources.
- [ ] Draft, review, published, and archived states use consistent semantic indicators.
- [ ] Empty categories offer a create action only when the current role is allowed to create.
- [ ] Editor save failures preserve content and offer retry.
- [ ] Restoring a version produces clear confirmation of the change.

### Phase 5 — Clanes and Identity

- [ ] Clanes/Casas are independent units with emblem, name, member count, and description; metadata is not split into nested cards.
- [ ] Casa pages use the custom `HouseEmblem` with restrained supporting information.
- [ ] Member views make Casa roles visible without turning every attribute into a badge.
- [ ] Badge detail shows issuer, date, reason, and evidence for transparency.
- [ ] Rank is visible in the profile and alongside identity where context requires it.
- [ ] Contextual empty states cover no Clanes, no Casa members, and no earned badges.
- [ ] Casa hierarchy is visually understandable from leader through roles to members.

### Phase 6 — Holochat and Notifications

- [ ] Channels are grouped by public/private context in the sidebar.
- [ ] Chat messages show avatar, name, timestamp, and controlled density.
- [ ] The custom `ActivityConsole` communicates real-time system events.
- [ ] Notifications use an accessible trigger with a count and a structured list.
- [ ] Notification preferences group toggles by category.
- [ ] The no-notifications state is calm, specific, and not alarming.
- [ ] Deleted messages preserve conversation structure with an appropriate placeholder.

### Phase 7 — Customization, Search, Hardening

- [ ] Search results are paginated, filterable, and permission-aware.
- [ ] No-results search states include the query and useful suggestions.
- [ ] Theme settings show a live preview of changes.
- [ ] Configurable navigation uses an understandable sortable interaction.
- [ ] Administrators can add and remove supported reaction types safely.
- [ ] Custom fields integrate into existing form hierarchy rather than forming unrelated panels.
- [ ] Limits are visible before failure, for example “3 of 10 attachments used.”
- [ ] Rate-limit feedback explains when the user can try again.

---

## Global verification — Apply in every phase

### UX principles

- [ ] Hick's Law: no more than seven visible options in a flat decision set.
- [ ] Fitts's Law: primary actions are easy to reach and touch targets are at least 44×44px.
- [ ] Proximity: related elements stay together and distinct sections are clearly separated.
- [ ] Miller's Law: information is chunked and views are not saturated.
- [ ] Occam's Razor: every visible element has a purpose.
- [ ] Jakob's Law: standard patterns handle login, search, forms, tables, and pagination; innovation serves domain or brand.
- [ ] The view has one clear H1 and normally one visible primary action.

### Density and containment

- [ ] The page has a deliberate primary alignment spine; related content aligns across sections.
- [ ] There are no arbitrary offsets, widths, or negative margins added only to balance one screenshot.
- [ ] Reading, form, and data regions use widths appropriate to their tasks.
- [ ] Functional content is centered only when the task benefits from it.
- [ ] Controls in the same toolbar/form region share a visual height.
- [ ] Compact density appears only in an explicit data/admin context and preserves readability and target size.
- [ ] Hierarchy uses typography, spacing, and alignment/dividers before differentiated surfaces.
- [ ] Every card is an independent, selectable, reusable, or genuinely elevated unit.
- [ ] There are no nested cards or rounded cards wrapping complete pages.
- [ ] Headers, toolbars, filters, forms, sidebars, tables, and ordinary sections are not cards by default.
- [ ] Homogeneous collections use rows, comparisons use tables, and grids/cards are reserved for non-linear exploration.
- [ ] Every surface uses one primary depth cue: border, background shift, or shadow—not all three.
- [ ] Shadows are reserved for overlays, dialogs, menus, and active sticky elevation.
- [ ] Routine padding is 12-16px, dialogs/featured regions use 20-24px, and product sections use 24-40px separation.
- [ ] Product UI uses 4-8px radii and dialogs/sheets use 12px; pills have explicit semantics.
- [ ] Normal metadata uses quiet text; badges are limited to status, category, and actionable filters.
- [ ] There are no generic gradients, glow, glassmorphism, blobs, icon tiles, or decorative panels.
- [ ] Sections do not repeat eyebrow + heading + description or obvious helper copy automatically.
- [ ] Mobile removes unnecessary frames and padding before stacking containers.
- [ ] A subtraction pass attempted to remove one card, border, badge, heading, and padding level.

### Color

- [ ] 60-30-10 is preserved; differentiated surfaces are a ceiling, not a card quota.
- [ ] Brand color covers no more than 10% of the visual surface.
- [ ] Success, warning, error, and information colors keep consistent meanings.
- [ ] Color is never the only state indicator; icon and text accompany it.
- [ ] There are no hardcoded colors outside the token definitions.

### Empty states

- [ ] Every empty state has a sober icon, specific title, explanation, and relevant next step.
- [ ] First use provides clear onboarding and a permitted creation action.
- [ ] No results suggests alternatives instead of saying only “No data.”
- [ ] Cleared state confirms completion and offers undo, history, or create when relevant.
- [ ] Error state explains the failure in human language and offers recovery.
- [ ] Permission-denied state explains the boundary and offers a permitted alternative.
- [ ] Copy never blames the user.
- [ ] There are no generic cute illustrations.
- [ ] Skeleton transitions to content or empty state without flicker.
- [ ] Empty/error UI inherits its parent container instead of adding a nested card.

### Forms and validation

- [ ] Every field has a persistent visible label; placeholders are examples, not labels.
- [ ] Forms use one column unless short, closely related fields clearly benefit from sharing a row.
- [ ] Field width reflects expected input length.
- [ ] Validation waits until blur, submit, or meaningful input rather than showing premature errors.
- [ ] Field errors appear beside their source; long forms also provide a focusable error summary.
- [ ] Failed submission preserves entered data and context.
- [ ] Navigation warns before discarding real unsaved changes and stays silent when nothing changed.
- [ ] The flow uses one understandable save model; autosave and explicit save are not mixed ambiguously.
- [ ] Primary actions name the verb and object; disabled actions explain a non-obvious reason.

### Loading, feedback, and recovery

- [ ] Fast operations do not flash loading UI; longer work shows feedback in the smallest affected region.
- [ ] Skeletons match the final geometry and hierarchy.
- [ ] A local mutation does not disable or block the complete page.
- [ ] Local problems use inline feedback; toasts are reserved for background/cross-page events or events with no inline home.
- [ ] Optimistic updates are safe and reversible; meaningful reversible actions provide undo.
- [ ] Long-running operations communicate determinate progress or a clear current status.
- [ ] Errors preserve context, explain recovery, and offer retry only when retry is meaningful.
- [ ] Destructive confirmation names the action and object; success feedback is proportional and not duplicated.

### Navigation and wayfinding

- [ ] Important search, filter, sort, tab, and pagination state is represented in the URL.
- [ ] Back navigation restores useful filters, scroll position, and collection context.
- [ ] Active location is recognizable without relying only on color.
- [ ] Breadcrumbs represent real hierarchy rather than decorating shallow pages.
- [ ] Sidebar, tabs, and page header do not duplicate the same navigation level.
- [ ] Tabs switch peer views; route links navigate to distinct tasks or resources.
- [ ] No action disappears on mobile; secondary actions move to a clear labeled menu when needed.

### Dialogs, sheets, and overlays

- [ ] Dialogs contain short focused decisions or tasks; long/multi-step work uses a page.
- [ ] There are no nested dialogs.
- [ ] Sheets serve contextual secondary work or intentional mobile adaptation.
- [ ] Escape/backdrop dismissal cannot silently lose entered data.
- [ ] Initial focus is safe, destructive actions are not focused by default, and focus returns to the trigger on close.
- [ ] Tooltips/popovers do not contain the only copy required to complete a task.
- [ ] Overlay layering follows the documented z-index scale and does not trap content behind stale backdrops.

### Content and microcopy

- [ ] Functional UI uses direct product language rather than marketing filler.
- [ ] Action labels use a specific verb and object where useful.
- [ ] Generic labels such as “Continue,” “Confirm,” and “Submit” are replaced when the actual action can be named.
- [ ] Destructive copy identifies the exact object and consequence.
- [ ] Sentence case is the default; uppercase is limited to defined abbreviations or overline/status styles.
- [ ] Each domain concept uses one canonical term consistently.
- [ ] Helper text adds a constraint, consequence, format, or next step instead of restating the label.
- [ ] Dates, times, counts, and numbers use consistent locale-aware formatting and semantic values.

### Tables and data visualization

- [ ] Text aligns left; numeric values align right and use tabular numerals when scanning benefits.
- [ ] Tables serve exact comparison; charts serve trend, distribution, relationship, or composition.
- [ ] A number, sentence, or small table is used instead of a chart when it answers the question directly.
- [ ] Charts normally encode no more than five simultaneous series; larger sets use filtering, grouping, or small multiples.
- [ ] Charts identify their question, units, time range, and provide an accessible summary/data alternative.
- [ ] Color is not the only way to distinguish chart series, thresholds, or states.
- [ ] Table cells are not automatically badges; truncation keeps the full value accessible without pointer-only interaction.
- [ ] Column priority determines responsive hiding/reflow while primary values and actions remain available.
- [ ] Sorting, filters, selection, pagination, loading, empty, partial, and error states preserve context and geometry.

### Motion

- [ ] `prefers-reduced-motion` is respected.
- [ ] Every animation lasts no more than 400ms.
- [ ] There are no mass scroll animations.
- [ ] There are no infinite animations except active loading indicators.
- [ ] Every transition communicates feedback, hierarchy, state, or progress.

### Components

- [ ] Every imported component is restyled with project tokens.
- [ ] Raw styles from multiple libraries are not mixed.
- [ ] Every component has explicit TypeScript props.
- [ ] Default, hover, focus, active, disabled, loading, and error states are covered when applicable.
- [ ] Data components include stable loading, empty, content, and error states.
- [ ] Dependencies remain controlled and nonredundant.

### Mandaloria brand restraint

- [ ] Brand identity comes from precise copy, rare Cinzel moments, the Beskar accent, domain concepts, and custom visualizations.
- [ ] Functional UI does not imitate a cinematic HUD or game interface.
- [ ] There are no gratuitous hexagons, clipped corners, crosshairs, scanlines, targeting grids, or fake technical readouts.
- [ ] Buttons, forms, tables, navigation, and routine labels avoid Cinzel, decorative uppercase, and wide tracking.
- [ ] Rich brand effects remain inside one purposeful focal region and do not leak into routine controls/data surfaces.
- [ ] Brand expression preserves contrast, scanning speed, target clarity, and content density.

### Responsive behavior

- [ ] The complete task works mobile-first.
- [ ] Navigation adapts to the viewport with the approved mobile and desktop patterns.
- [ ] Tables hide secondary columns or provide intentional horizontal scrolling.
- [ ] Dialogs become appropriate mobile sheets when the task requires the space.
- [ ] Touch targets remain at least 44×44px in every viewport.
- [ ] Compact controls preserve accessible hit areas without oversized visual padding.

### Accessibility

- [ ] Text meets WCAG AA contrast: 4.5:1 for body text and 3:1 for large text.
- [ ] Every interactive element has a visible focus indicator.
- [ ] Inputs have labels and icon-only buttons have accessible names.
- [ ] Complete keyboard navigation is available.
- [ ] Landmarks, roles, and announcements support screen readers and dynamic changes.
- [ ] No essential information or action exists only on hover or in a tooltip.
- [ ] Keyboard order follows visual/semantic order; positive `tabindex` is not used as a layout repair.
- [ ] Sticky UI and overlays never obscure the focused element.
- [ ] The complete task works at 200% zoom and a 320 CSS-pixel viewport without loss of content or action.
- [ ] Icon-only controls are universally familiar or receive a visible label when ambiguity remains.
- [ ] Dynamic success, error, progress, and result-count changes use a deliberate live-region strategy.
- [ ] Focus traps exist only in modal contexts and focus is restored on close.
- [ ] Pointer gestures and drag-and-drop have keyboard/non-gesture alternatives.

### Performance

- [ ] Images use lazy loading where appropriate and declare dimensions.
- [ ] Fonts use `font-display: swap`.
- [ ] Asynchronous content reserves space and avoids layout shift.
- [ ] Motion uses `transform` and `opacity` where possible.

### Content and viewport stress testing

- [ ] The page/component has been checked with zero, one, typical, and many items.
- [ ] Very long names, titles, URLs, and unbroken values wrap, truncate, or scroll intentionally.
- [ ] Missing, delayed, and broken images/attachments have stable fallbacks.
- [ ] Partial, stale, and permission-filtered data remains understandable.
- [ ] Slow loading, recoverable failure, offline/reconnect, and repeated submission are handled.
- [ ] Permission denied and mid-session permission changes do not expose or strand content.
- [ ] The primary task works at approximately 320px, 768px, 1280px, and 1440px widths.
- [ ] The primary task works keyboard-only, touch-only, at 200% zoom, and with increased text size.
- [ ] No content overlaps, escapes its container, hides a required action, or causes uncontrolled layout shift.

### Design-system governance

- [ ] No new token exists only to solve one isolated component.
- [ ] No arbitrary value replaces an existing sufficiently close token.
- [ ] Tokens are named by semantic purpose rather than current visual value.
- [ ] The same concept uses the same component and interaction model across the product.
- [ ] Every new variant has a semantic reason rather than a cosmetic preference.
- [ ] Patterns repeated three times are evaluated for extraction; premature abstractions are avoided.
- [ ] Shared components document use, non-use, density, responsive behavior, accessibility, and supported states.
- [ ] Imported examples yield to project tokens and containment rules.
- [ ] Design review includes mobile/desktop evidence and realistic content states.
- [ ] Durable pattern changes update the design system, component architecture, and verification checklist together.
