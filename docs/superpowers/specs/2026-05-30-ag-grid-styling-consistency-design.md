# AG-Grid Styling Consistency — Rectrace + RecViz

**Date:** 2026-05-30
**Author:** A Arun (with Claude)
**Status:** DRAFT v2 — incorporates adversarial review findings; awaiting user re-review before plan
**Related repos:** `autosys-job-explorer` (rectrace, frontend-react), `RecViz` (frontend)

## Purpose

Today the rectrace search grid and the RecViz embedded-dashboard grids feel like two different products. Rectrace uses a hand-tuned AG-Grid v35 Theming-API theme with shadcn CSS variables and Geist font. RecViz uses default `themeQuartz` plus a legacy `.ag-theme-quartz { --ag-* }` bridge block in `index.css` left over from pre-v33, and runs the rest of the app on Inter.

The user clicks a cell in rectrace → modal opens → an embedded RecViz dashboard with grids that look like stock AG-Grid lands inside a hand-tuned surface. The contrast is jarring.

Goal: one shared visual language across both grids — and across both apps' typography — so the embedded dashboard reads as a continuation of rectrace, not a foreign object. Plus a small Gmail-inspired hover-ring enhancement that lands in rectrace first and then propagates to RecViz.

## Two parts (sequential)

This spec contains two cohesive but independently verifiable parts. **Part A lands first**; its rectrace hover hairline becomes the visual reference for Part B's port.

- **Part A — Rectrace hover hairline** (small): adds the Gmail-inspired top + bottom hairline to `.ag-row-hover` in rectrace's `gridTheme.ts`, with the corrected combined-selector for the hovered-and-selected case.
- **Part B — RecViz modernization** (larger): migrates RecViz from Inter to Geist app-wide, ports rectrace's v35 theme pattern into a new `RecViz/frontend/src/lib/grid-theme.ts`, wires it into three dashboard grid components, and removes the legacy `.ag-theme-quartz` CSS bridge.

## Scope decisions (locked via brainstorm + adversarial review)

1. **Theme location** — copy `gridTheme.ts` from rectrace into RecViz (`frontend-react/src/search/lib/gridTheme.ts` → `RecViz/frontend/src/lib/grid-theme.ts`). Manual sync; we document the rule with mirror-comments in both files. No shared package.
2. **Token alignment** — verified: both repos define identical shadcn CSS-variable names (`--color-primary`, `--color-foreground`, `--color-background`, `--color-border`, `--color-muted`, `--color-muted-foreground`, `--color-primary-foreground`). Port theme params unchanged.
3. **Density** — keep current RecViz density (do NOT port rectrace's spacing/padding/font-size overrides: `fontSize: 13`, `headerFontSize: 12`, `cellHorizontalPadding: 14`, `spacing: 8`, `iconSize: 15`). Quartz defaults stand. **Accepted tradeoff**: the embedded RecViz dashboard grids will be slightly LESS dense than the surrounding rectrace search grid. The two will share color/border/font-family/hover behaviour but differ marginally in vertical rhythm.
4. **CSS scope** — scoped port: include only rules that match RecViz dashboard grids (flat tables, no row grouping, no sidebar). Skip rectrace-specific rules for row-group panel chips, group-row chevron hover, sidebar tab active states, auto-group cell, and "Group by" decorator.
5. **Hover style** — Approach A: inset top + bottom bright hairlines via `box-shadow` on `.ag-row-hover`. Keep existing 6% primary tint as the background lift. **Combined `.ag-row-hover.ag-row-selected` selector required** (CSS does not compose two separate `box-shadow` declarations — see Part A below).
6. **Font scope** — Geist app-wide in RecViz. Mirrors rectrace's typography. Add `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` to RecViz's `package.json`, import in `main.tsx`, replace `Inter` with `Geist Variable` in `--font-sans` and `--font-mono` CSS variables. Smoke-test surface: every visual surface in RecViz (KPIs, charts, dialogs, dashboards, admin).
7. **Out-of-scope, explicit transient acceptance** — RecViz internal-admin grids (`query-results.tsx`, `dataset-editor.tsx`, `column-metadata-grid.tsx`) will visually be inconsistent with the freshly-themed dashboard grids until a follow-up port. We accept this as a transient.

## v35 official approach (research-grounded)

Per AG-Grid v35 docs (queried via context7 against `/websites/ag-grid_archive_35_0_0_javascript-data-grid`):

- **Theming API is the default** since v33. Pass a JS theme object to the `theme` grid option.
- **No CSS imports** (`ag-grid-community/styles/*.css`) — those are only for `theme: "legacy"` migration mode.
- **Customise via `.withParams({...})`** — params accept CSS variables (`'var(--color-primary)'`), literal values, or `color-mix()` expressions. Rectrace already uses this pattern in production at `gridTheme.ts:92-119` — confirms the API.
- **Custom CSS** → `createPart({ css })` + `.withPart(part)`.
- **Light/dark** preferred via CSS variable cascade — the same theme params re-resolve when the parent flips dark via shadcn's `.dark` class. No JS-level theme switching needed.
- **`data-ag-theme-mode`** attribute on the grid container (or body) lets AG-Grid's own popups and scrollbars pick the right scheme. Rectrace already sets this — `gridTheme.ts:8-9` mentions it. RecViz currently does not. **Part B adds it.**

## Part A — Rectrace hover hairline

### Files

- `frontend-react/src/search/lib/gridTheme.ts` — augment `gridBodyPart` CSS with the hover hairline rule + the combined-selector composition rule.

### CSS rule to add

```css
/* premium row-hover: a Gmail-inspired bright hairline on top + bottom edges,
   layered on top of the existing 6% primary background tint. The bright stroke
   uses var(--color-foreground) at ~20% so it switches automatically across
   light + dark. */
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}

/* Hovered + selected: CSS does NOT compose two separate box-shadow declarations
   (later cascade winner replaces, not adds). Declare the combined effect
   explicitly so the user sees the primary left-edge AND the hover hairlines
   together. The combined selector has higher specificity than each single-class
   rule and wins the cascade. */
.ag-row-hover.ag-row-selected {
  box-shadow:
    inset 2px 0 0 0 var(--color-primary),
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
```

### Behavior matrix

| State | Background | Box-shadow effects |
|---|---|---|
| Idle | transparent | none |
| Hovered (unselected) | 6% primary tint | top hairline + bottom hairline |
| Selected (unhovered) | 13% primary tint | primary left-edge |
| Hovered + selected | 13% primary tint | primary left-edge + top hairline + bottom hairline |

### Why not an outer drop-shadow

AG-Grid rows are siblings stacked tight; outer shadow gets clipped by the next row → looks uneven. Inset-only avoids that class of bug.

### Part A verification

- Static: `pnpm tsc -b --noEmit`, `pnpm lint`, `pnpm build` all clean.
- Existing test `frontend-react/src/search/__tests__/gridTheme.test.ts` continues to pass (no param changes, only CSS addition).
- Runtime (Playwright + visual):
  - Light mode: hover an unselected row → top/bottom hairlines + faint BG tint, both visible.
  - Light mode: hover a selected row → primary left-edge + top/bottom hairlines + 13% BG tint all visible together (this is the case the review-fix addresses).
  - Dark mode: same checks. Hairline color `color-mix(var(--color-foreground) 20%)` produces light-tinted hairlines on dark rows — confirm they read.
  - Existing row-group chevron hover (`.ag-row-group .ag-group-expanded:hover`) — confirm still works (no interaction risk; different selector axis).
- Screenshot evidence committed to `docs/superpowers/handoff/` (light + dark, hover + hover-and-selected).

## Part B — RecViz modernization

### B.1 — Geist app-wide

#### Files

- `RecViz/frontend/package.json` — add `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` dependencies.
- `RecViz/frontend/src/main.tsx` — add `import '@fontsource-variable/geist'` and `import '@fontsource-variable/geist-mono'`.
- `RecViz/frontend/index.html` — remove the Inter Google-Fonts `<link>` tags (lines around 9).
- `RecViz/frontend/src/index.css` — replace every `"Inter", system-ui, sans-serif` reference with `"Geist Variable", system-ui, sans-serif`; replace any `Inter` reference in `--font-sans` / `--font-mono` / `--ag-font-family` (the latter will be deleted in B.3 anyway).

#### Smoke-test surface (B.1 verification)

Every visible surface in RecViz needs a once-over. Per the user's "yes I want this" approval, this is in scope:
- Dashboard list (`/dashboards`).
- Standalone dashboard (`/dashboards/dash-tlm-stats`, `/dashboards/dash-quickrec-stats`).
- Embedded dashboard via rectrace cell-click modal.
- KPI tiles (font-variant-numeric: tabular-nums — Geist supports it).
- Charts (donut, bar, line — chart axis labels render via canvas; AG Charts inherits CSS font).
- Filter dropdowns and combobox triggers.
- Dashboard toolbar (refresh / auto-refresh / share / edit).
- Dialogs and popovers (filter popups, share-link, edit dashboard).
- Admin surfaces: connection settings, dataset editor, query-results.
- Light + dark modes for each surface.

Each surface gets a quick visual check that nothing reflows weirdly (Geist has slightly different letterforms than Inter; some buttons might wrap to 2 lines or icons may shift a hair). Where reflow happens, decide case-by-case: tighten copy, widen container, or accept.

### B.2 — Port rectrace's gridTheme pattern

#### Files

- `RecViz/frontend/src/lib/grid-theme.ts` — NEW file. Port of rectrace's `gridTheme.ts`, scoped per decisions 3 & 4.

#### Header banner comment (sync rule)

```ts
/**
 * AG-Grid v35 Theming-API theme for RecViz dashboard grids.
 *
 * MIRROR FILE: `autosys-job-explorer/frontend-react/src/search/lib/gridTheme.ts`
 *
 * Sync rule (best-effort, no CI enforcement):
 *  - Visual params (colors, borders, hover/selected, header chrome) are kept
 *    in lockstep with rectrace's gridTheme.ts. Any change here SHOULD also
 *    be applied there, and vice-versa.
 *  - Density params (fontSize, headerFontSize, cellHorizontalPadding,
 *    spacing, iconSize) are deliberately SKIPPED here — RecViz uses Quartz
 *    defaults to preserve current row density.
 *  - CSS rules in the gridBodyPart are SCOPED to rules that apply to flat
 *    dashboard grids: rectrace-only rules for row-group panel, sidebar
 *    tabs, group rows, and auto-group cells are NOT mirrored.
 *
 * When rectrace's gridTheme.ts changes, audit this file. Drift is reviewed
 * during quarterly design audits if not earlier.
 */
```

(A matching mirror-comment is added to rectrace's `gridTheme.ts` pointing back at this file.)

#### Params (port these — visual only, density unchanged)

```ts
themeQuartz.withParams({
  accentColor: 'var(--color-primary)',
  backgroundColor: 'var(--color-background)',
  foregroundColor: 'var(--color-foreground)',
  chromeBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
  headerBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
  headerTextColor: 'color-mix(in oklab, var(--color-foreground) 70%, transparent)',
  borderColor: 'var(--color-border)',
  wrapperBorder: false,
  columnBorder: false,
  headerColumnBorder: { color: 'color-mix(in oklab, var(--color-border) 75%, transparent)' },
  headerColumnBorderHeight: '58%',
  rowBorder: { color: 'color-mix(in oklab, var(--color-foreground) 7%, transparent)' },
  rowHoverColor: 'color-mix(in oklab, var(--color-primary) 6%, transparent)',
  selectedRowBackgroundColor: 'color-mix(in oklab, var(--color-primary) 13%, transparent)',
  oddRowBackgroundColor: 'transparent',
  fontFamily: 'Geist Variable, system-ui, sans-serif',
  headerFontFamily: 'Geist Variable, system-ui, sans-serif',
  headerFontWeight: 550,
  wrapperBorderRadius: 0,
})
```

#### Params SKIPPED (preserves current RecViz density)

`fontSize`, `headerFontSize`, `cellHorizontalPadding`, `spacing`, `iconSize`. Default Quartz values stand.

#### CSS (port these — universal rules + the new hover hairline composition)

```css
.ag-cell { font-variant-numeric: tabular-nums; }
.ag-row { transition: background-color 120ms ease; }
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-row-hover.ag-row-selected {
  box-shadow:
    inset 2px 0 0 0 var(--color-primary),
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-header-cell-text { letter-spacing: 0.005em; }
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }
/* filter popup polish — RecViz dashboards use column filters via DEFAULT_COL_DEF.filter: true */
.ag-filter-apply-panel-button { border-radius: 7px; font-weight: 550; transition: filter 120ms ease, background-color 120ms ease; }
.ag-filter-apply-panel-button:last-child {
  background: var(--color-primary); color: var(--color-primary-foreground);
  border-color: transparent;
}
.ag-filter-apply-panel-button:last-child:hover { filter: brightness(1.06); }
.ag-filter-apply-panel-button:not(:last-child) {
  background: transparent; color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.ag-filter-apply-panel-button:not(:last-child):hover { background: color-mix(in oklab, var(--color-foreground) 7%, transparent); }
.ag-filter .ag-input-field-input:focus,
.ag-filter .ag-picker-field-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 22%, transparent);
}
```

#### CSS SKIPPED (not applicable to RecViz dashboard grids)

`.ag-group-value`, `.ag-row-group-expanded`, `.ag-row-group-contracted`, `.ag-row-group .ag-group-value`, `.ag-group-child-count`, `.ag-column-drop-horizontal-*` (row-group panel chips + "Group by" decorator), `.ag-row-group .ag-group-expanded:hover`, `.ag-side-button-*` (sidebar tabs). Verified RecViz dashboards do not use `rowGroup`, `sideBar`, or `rowGroupPanelShow` in any config.

### B.3 — Wire the theme into all dashboard grids

#### Files

- `RecViz/frontend/src/components/dashboard/config-data-grid.tsx` — TWO sites:
  - `SingleSourceGrid` function (declared line 56). Theme calc at ~line 80.
  - `MergedSourceGrid` function (declared line 188 — **note: NOT `MergeGrid`** — review caught this typo in v1). Theme calc at ~line 222.
- `RecViz/frontend/src/components/dashboard/drill-detail-grid.tsx` — SAME per-render ternary pattern (theme calc line 66). **Review v2 added this file — missed in v1.** This is the grid shown when a user drills into a chart in the dashboard surface; user-facing, not admin.

#### Replacement pattern (applies to all three sites)

Current:
```ts
const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz
// ...
<AgGridReact theme={gridTheme} ... />
```

Replace with:
```ts
import { gridTheme } from '@/lib/grid-theme'
// ... no theme calc ...
<AgGridReact theme={gridTheme} ... />
```

After all three sites:
- Drop the `themeQuartz, colorSchemeDark` imports from `ag-grid-community` (verify with grep — they're only used for the theme calc).
- Drop `useTheme` imports and `const { resolvedTheme } = useTheme()` calls (verify with grep — they're only used for the theme calc).

#### Container attribute (B.3 addition)

To match rectrace, the AG-Grid container `<div>` should carry `data-ag-theme-mode={resolvedTheme}` so AG-Grid popups and scrollbars pick the right colour scheme. Rectrace handles this at `frontend-react/src/search/...` — port the same pattern to each of the three RecViz grid components.

```tsx
const { resolvedTheme } = useTheme()  // re-introduce for the data-attribute
// ...
<div data-ag-theme-mode={resolvedTheme} className="...">
  <AgGridReact theme={gridTheme} ... />
</div>
```

(Note: this re-introduces `useTheme` for a different purpose — the data-attribute, not the theme calculation. Per-render theme object recreation is avoided; container re-render is a cheap React update.)

### B.4 — Remove legacy CSS bridge

#### Files

- `RecViz/frontend/src/index.css` — delete the entire `.ag-theme-quartz { ... }` block (lines ~157-176 in current file). Dead code under v35 — the grid no longer carries that className with the Theming API.
- Delete the "AG Grid token bridge — reads shadcn CSS variables" comment above the block.

### Part B verification

**Static (per repo)**:
- `pnpm tsc -b --noEmit` — clean
- `pnpm lint` — no new errors against existing baseline (RecViz has 53 pre-existing)
- `pnpm build` — succeeds; bundle bump from Geist install ~80KB woff2 (acceptable)

**Runtime (live stack, screenshot-evidenced)**:
1. **B.1 Geist app-wide** — visit each surface listed in B.1's smoke-test surface. Light + dark. Screenshot any surface where Geist swap causes unexpected reflow.
2. **B.2 + B.3 dashboard grid theme** — `/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER` → both grids (Reconciliation, Breaks). `/dashboards/dash-quickrec-stats` → its grids. Verify: font matches rectrace (Geist), header chrome tinted, vertical separators on headers (`headerColumnBorderHeight: '58%'`), row hover hairlines visible, selected row primary left-edge, hover+selected composes correctly. Toggle dark mode.
3. **B.3 drill-down grid** — open any chart in a dashboard, click a slice/bar that drills → the drill-detail grid uses the new theme.
4. **B.3 container attribute** — open a column filter popup or use the page-size combobox; confirm popup adopts the correct light/dark scheme (the `data-ag-theme-mode` change).
5. **B.4 legacy CSS removal** — confirm no visual regression after `.ag-theme-quartz {...}` deletion (the rules were dead under v35; deletion should be visually no-op).
6. **Embedded mode** — rectrace cell-click → modal → grids visually continuous with rectrace's surface. The "two products" feel goes away.
7. **Light-mode hover screenshot** — explicit per review point 10. The hairline color `color-mix(var(--color-foreground) 20%)` is darker on light backgrounds; verify it reads.
8. **Filter popup screenshot** in RecViz, light + dark, to confirm the polish CSS landed correctly.
9. **Regression** — pagination, sorting, column resize, filter popup, quick filter, row selection all still functional in both repos.

## Sync rule (enforced via mirror-comments)

Both `gridTheme.ts` (rectrace) and `grid-theme.ts` (RecViz) carry a header banner pointing at each other and stating the sync expectation. No CI check — this is best-effort. Drift is reviewed during quarterly design audits if not caught earlier in normal PR review.

## Risk surface (review-grounded)

| Risk | Mitigation |
|---|---|
| Geist letterforms slightly differ from Inter → button text wraps / grid cells truncate differently | B.1 smoke-test catches; case-by-case fix or accept |
| Container `data-ag-theme-mode` missing → filter popups stay light in dark mode | B.3 adds the attribute on every grid container |
| CSS box-shadow non-composition (hovered + selected loses primary left-edge) | Combined `.ag-row-hover.ag-row-selected` selector in both Part A and B.2 |
| Existing rectrace `gridTheme.test.ts` snapshot mismatch | Add new CSS rules don't change the `withParams` output; tests pass. Verify post-edit. |
| Light-mode hairline contrast too subtle | Explicit screenshot in verification |
| Bundle bump from Geist (~80KB) | Accepted; aligns with rectrace's bundle |
| RecViz admin grids visually inconsistent with dashboard grids until follow-up | Explicitly accepted as transient (scope decision 7) |

## Out of scope (explicit)

- **A1** — Empty-state no-results + Contextual dashboards inline (separate UX redesign).
- **A2 deeper** — Density variants (compact for embed). Revisit only if the modal feels cramped after this work.
- **RecViz admin grids** — `query-results.tsx`, `dataset-editor.tsx`, `column-metadata-grid.tsx`. Will look different from dashboard grids until a follow-up port. Easy follow-up later — just import the same `gridTheme` and pass via `theme` prop. **Tradeoff accepted.**
- **Rectrace typography/density changes**. User confirmed colors only (plus the hover hairline). No `fontSize`/`spacing` changes in rectrace.

## References

- Rectrace theme: `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/lib/gridTheme.ts`
- Rectrace theme tests: `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/__tests__/gridTheme.test.ts`
- Rectrace Geist load: `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/main.tsx:27-28` + `index.css:11`
- RecViz current dashboard grid wiring: `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-data-grid.tsx:78-80, 220-222`
- RecViz drill-detail grid wiring (review-caught): `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/drill-detail-grid.tsx:3, 44, 66`
- RecViz legacy CSS bridge: `/Users/aarun/Workspace/Projects/RecViz/frontend/src/index.css:157-176`
- RecViz Inter load (target of replacement): `/Users/aarun/Workspace/Projects/RecViz/frontend/index.html:9`
- AG-Grid v35 Theming API: `https://www.ag-grid.com/archive/35.0.0/javascript-data-grid/theming-migration`
- AG-Grid v35 Colors & Dark Mode: `https://www.ag-grid.com/archive/35.0.0/javascript-data-grid/theming-colors`

## Changelog from v1

- **Geist scope (review point 3)** — corrected the false "Same Geist font referenced" claim. Added Part B.1 to install Geist app-wide in RecViz per user decision.
- **Hover composition (review point 5)** — added explicit combined `.ag-row-hover.ag-row-selected` selector to BOTH rectrace addition (Part A) and RecViz port (Part B.2). Removed the misleading "CSS handles overlap naturally" reasoning.
- **drill-detail-grid (review point 4)** — added to scope in Part B.3.
- **MergedSourceGrid typo (review point 4)** — corrected from `MergeGrid` to `MergedSourceGrid`.
- **`data-ag-theme-mode` attribute (review point 10)** — added to B.3 wiring for every grid container.
- **Verification plan (review point 11)** — added light-mode hover screenshot, filter popup screenshot, drill-down grid check, container-attribute popup check.
- **Sync rule enforcement (review point 8)** — explicit mirror-comments in both files, quarterly audit acceptance.
- **Density tradeoff (review point 7)** — made explicit: RecViz will be slightly less dense than rectrace.
- **Admin-grid transient inconsistency (review point 9)** — explicit acceptance in scope decision 7 and out-of-scope.
- **Structure as two parts (review point 12)** — Part A lands first as visual reference; Part B builds on it.
