# AG-Grid Styling Consistency — Rectrace + RecViz

**Date:** 2026-05-30
**Author:** A Arun (with Claude)
**Status:** DRAFT — awaiting user review before plan
**Related repos:** `autosys-job-explorer` (rectrace, frontend-react), `RecViz` (frontend)

## Purpose

Today the rectrace search grid and the RecViz embedded-dashboard grids feel like two different products. Rectrace uses a hand-tuned AG-Grid v35 Theming-API theme with shadcn CSS variables. RecViz uses default `themeQuartz` plus a legacy `.ag-theme-quartz { --ag-* }` bridge block in `index.css` left over from pre-v33.

The user clicks a cell in rectrace → modal opens → an embedded RecViz dashboard with grids that look like stock AG-Grid lands inside a hand-tuned surface. The contrast is jarring.

Goal: one shared visual language across both grids so the embedded dashboard reads as a continuation of rectrace, not a foreign object. Plus a small enhancement to rectrace's grid that lands first and then propagates: a Gmail-inspired row hover with subtle bright top/bottom hairlines.

## Scope decisions (locked via brainstorm)

1. **Theme location** — copy `gridTheme.ts` from rectrace into RecViz (`frontend-react/src/search/lib/gridTheme.ts` → `RecViz/frontend/src/lib/grid-theme.ts`). Manual sync; we document the rule. No shared package.
2. **Token alignment** — verified: both repos define identical shadcn CSS-variable names (`--color-primary`, `--color-foreground`, `--color-background`, `--color-border`, `--color-muted`, `--color-muted-foreground`, `--color-primary-foreground`). Same Geist font referenced. Port theme params unchanged.
3. **Density** — keep current RecViz density (do NOT port rectrace's spacing/padding/font-size overrides). Only port the visual params (colors, font family, borders, hover/selected behaviour). Low visual-only change.
4. **CSS scope** — scoped port: include only rules that match RecViz dashboard grids (flat tables, no row grouping, no sidebar). Skip rectrace-specific rules for row-group panel chips, group-row chevron hover, sidebar tab active states, auto-group cell, and "Group by" decorator.
5. **Hover style (NEW, lands in rectrace first)** — Approach A: inset top + bottom bright hairlines via `box-shadow` on `.ag-row-hover`. Keep existing 6% primary tint as the background lift. Composes cleanly with the selected-row left-edge inset shadow.

## v35 official approach (research-grounded)

Per AG-Grid v35 docs (queried via context7 against `/websites/ag-grid_archive_35_0_0_javascript-data-grid`):

- **Theming API is the default** since v33. Pass a JS theme object to the `theme` grid option.
- **No CSS imports** (`ag-grid-community/styles/*.css`) — those are only for `theme: "legacy"` migration mode.
- **Customise via `.withParams({...})`** — params accept CSS variables (`'var(--color-primary)'`), literal values, or `color-mix()` expressions.
- **Custom CSS** → `createPart({ css })` + `.withPart(part)`.
- **Light/dark** preferred via CSS variable cascade — the same theme params re-resolve when the parent flips dark via shadcn's `.dark` class. No JS-level theme switching needed.

Rectrace already follows this pattern. RecViz currently doesn't. The work below brings RecViz to canonical v35.

## Affected surfaces

### Rectrace (`autosys-job-explorer`)

- `frontend-react/src/search/lib/gridTheme.ts` — augment the existing `gridBodyPart` CSS with the hover hairline rule. No param changes.

### RecViz (`RecViz`)

- `frontend/src/lib/grid-theme.ts` — NEW file. Port of rectrace's `gridTheme.ts`, scoped to dashboard-grid-applicable rules.
- `frontend/src/components/dashboard/config-data-grid.tsx` — replace the per-render `themeQuartz.withPart(colorSchemeDark)` ternary (two sites: `SingleSourceGrid` ~line 80, `MergeGrid` ~line 222) with a static `import { gridTheme } from '@/lib/grid-theme'`. Drop the `themeQuartz` + `colorSchemeDark` imports from `ag-grid-community`. Drop the `useTheme` import and both `const { resolvedTheme } = useTheme()` calls if they're only used for the theme calculation in this file (grep to confirm before deleting; per current read they are).
- `frontend/src/index.css` — remove the legacy `.ag-theme-quartz { --ag-* ... }` block (lines ~157-176). Dead code under v35 Theming API; the grid no longer carries the `ag-theme-quartz` className.

### Out of scope (this spec)

- RecViz internal-admin grids (`query-results.tsx`, `dataset-editor.tsx`, `column-metadata-grid.tsx`). Different audience. If needed later, easy follow-up — just import the same `gridTheme` and pass via `theme` prop.
- Rectrace grid density/typography changes. User confirmed colors only.
- Multi-density variants (compact for embed). Tabled — revisit if the modal feels tight after this lands.

## The hover hairline rule (rectrace, then ported to RecViz)

Add to the existing `gridBodyPart` CSS in `gridTheme.ts`:

```css
/* premium row-hover: a Gmail-inspired bright hairline on top + bottom edges,
   layered on top of the existing 6% primary background tint. The bright stroke
   uses var(--color-foreground) at ~20% so it switches automatically across
   light + dark. The selected-row left-edge inset shadow is on a different
   axis, so a hovered-and-selected row composes both via multi-stop box-shadow
   (CSS handles overlap naturally; later inset rules paint on top of earlier
   ones at the same edge — these don't overlap). */
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
```

**Concrete behavior:**
- Unhovered row: existing styles, no change.
- Hovered row (unselected): 6% primary BG tint + two bright hairlines top/bottom.
- Selected row (not hovered): existing 13% primary BG tint + primary left-edge inset shadow.
- Hovered + selected: 13% primary BG tint + primary left-edge + top/bottom hairlines (multi-stop composition).

**Why not also the BG fill change**: kept 6% primary tint. The hairlines now do the heavy lifting for "this row is active" recognition.

**Why not outer drop-shadow**: AG-Grid rows are siblings stacked tight; outer shadow gets clipped by the next row — looks uneven. Inset-only avoids that class of bug.

## The RecViz port (`frontend/src/lib/grid-theme.ts`)

New file. Copy of rectrace's pattern, scoped:

### Params (port these — visual only, density unchanged)

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

### Params SKIPPED (preserves current RecViz density)

`fontSize`, `headerFontSize`, `cellHorizontalPadding`, `spacing`, `iconSize`. Default Quartz values stand.

### CSS (port these — universal rules that apply to flat tabular grids)

```css
.ag-cell { font-variant-numeric: tabular-nums; }
.ag-row { transition: background-color 120ms ease; }
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-header-cell-text { letter-spacing: 0.005em; }
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }
/* filter popup polish (RecViz dashboards use column filters via defaultColDef.filter) */
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

### CSS SKIPPED (not applicable to RecViz dashboard grids)

`.ag-group-value`, `.ag-row-group-expanded`, `.ag-row-group-contracted`, `.ag-row-group .ag-group-value`, `.ag-group-child-count`, `.ag-column-drop-horizontal-*` (row-group panel chips + "Group by" decorator), `.ag-row-group .ag-group-expanded:hover`, `.ag-side-button-*` (sidebar tabs). RecViz dashboards are flat tables without row grouping, group rows, drop zones, or sidebars.

### Wiring in `config-data-grid.tsx`

Two grid-render sites (one for `SingleSourceGrid`, one for `MergeGrid`). Both currently do:

```ts
const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz
// ...
<AgGridReact theme={gridTheme} ... />
```

Replace with module-level import:

```ts
import { gridTheme } from '@/lib/grid-theme'
// drop the resolvedTheme + themeQuartz + colorSchemeDark imports if unused elsewhere
// ...
<AgGridReact theme={gridTheme} ... />
```

The CSS variables in the theme params re-resolve through the shadcn `.dark` cascade — no JS-level dark switching needed.

### Legacy CSS removal in `index.css`

Delete the entire `.ag-theme-quartz { ... }` block (~20 lines starting at line 157). Dead code under v35 — the grid no longer carries that className. The "AG Grid token bridge" comment can go.

## Verification plan

**Static (per repo)**:
- `pnpm tsc -b --noEmit` — clean
- `pnpm lint` — no new errors against existing baseline (rectrace has 6 pre-existing; RecViz has 53)
- `pnpm build` — succeeds

**Runtime (live stack)**:
1. **Rectrace hover** — search any term, hover any row → top/bottom bright hairlines appear, BG tint stays subtle. Hover a selected row → primary left-edge + hairlines compose. Toggle dark/light — both look right.
2. **RecViz standalone** — `/dashboards/dash-tlm-stats?filter.tlm_instance=TLMP_CONSUMER` → both grids (Reconciliation, Breaks) read as rectrace-family: same font, same row hover with hairlines, same selected primary left-edge, same border tones, same header chrome tint. Toggle dark mode via `?theme=dark` or system pref — both modes look right.
3. **RecViz embedded** — rectrace cell-click flow → modal opens → grids inside the modal visually continuous with the surrounding rectrace surface. The "two products" feel goes away.
4. **Regression** — pagination, sorting, column resize, filter popup, quick filter, row selection all still functional. Density unchanged from current RecViz.

## Sync rule

Whenever rectrace's `gridTheme.ts` changes:
- Visual params (colors, font, hover/selected, header chrome) → port to RecViz `grid-theme.ts`.
- CSS rules in `gridBodyPart` → port the universal rules; skip rectrace-specific (row group, sidebar, drop zones, auto-group).
- Density params (`fontSize`, `headerFontSize`, `cellHorizontalPadding`, `spacing`, `iconSize`) → DO NOT port unless user explicitly opts in.

Document this rule at the top of the RecViz `grid-theme.ts` file via a leading comment block.

## Out of scope (parked)

- **A1** — Empty-state no-results + Contextual dashboards inline (separate UX redesign).
- **A2 (deeper)** — Density variants (compact for embed). Revisit only if the modal feels cramped post this work.
- **RecViz admin grids** — query-results, dataset-editor, column-metadata-grid. Different audience. Easy follow-up later.
- **Rectrace typography/density changes**. User confirmed colors only.

## References

- Rectrace theme: `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/src/search/lib/gridTheme.ts`
- RecViz current dashboard grid: `/Users/aarun/Workspace/Projects/RecViz/frontend/src/components/dashboard/config-data-grid.tsx:78-80, 220-222`
- RecViz legacy CSS bridge: `/Users/aarun/Workspace/Projects/RecViz/frontend/src/index.css:157-176`
- AG-Grid v35 Theming API: `https://www.ag-grid.com/archive/35.0.0/javascript-data-grid/theming-migration`
- AG-Grid v35 Colors & Dark Mode: `https://www.ag-grid.com/archive/35.0.0/javascript-data-grid/theming-colors`
