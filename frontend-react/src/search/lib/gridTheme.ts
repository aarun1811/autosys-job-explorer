import { createPart, themeQuartz } from 'ag-grid-community'

/**
 * AG-Grid v33+ Theming API theme for the search grid.
 *
 * Params reference the shadcn oklch CSS variables directly (`var()` is supported
 * by the Theming API) so the grid follows light/dark automatically via the
 * `.dark` cascade — no per-scheme literal values. The container carries
 * `data-ag-theme-mode` so AG-Grid's own popups/scrollbars pick the right scheme.
 *
 * Refined & airy: Geist body text with airy cell padding, quiet medium-weight
 * headers on a faintly tinted chrome, a subtle azure row-hover that stays
 * DISTINCT from the accent-tinted selected row (which also gets a primary
 * left-edge), hairline row borders, no zebra striping. The grouped identifier
 * column (job names, set IDs, recons) renders in Geist Mono — a deliberate
 * technical texture exactly where the data is an identifier.
 *
 * Note: `withCSS` does not exist in ag-grid-community@35. Custom CSS is injected
 * via `createPart({ css })` + `.withPart(...)`.
 */

const gridBodyPart = createPart({
  css: `.ag-cell { font-variant-numeric: tabular-nums; }
/* grouped identifier values get the technical mono treatment */
.ag-group-value { font-family: var(--font-mono); letter-spacing: -0.01em; font-size: 12.5px; }
/* headers: quiet, slightly tracked, with a touch more breathing room */
.ag-header-cell-text { letter-spacing: 0.005em; }
/* smooth, premium row hover */
.ag-row { transition: background-color 120ms ease; }
/* selected row: accent left-edge (distinct from hover) */
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
/* group rows: NO background band (it read as an out-of-place block). Distinguish
   them purely by the indented, heavier group value + chevron, so every row shares
   the same clean canvas. The expanded/contracted cell classes carry no fill. */
.ag-row-group-expanded, .ag-row-group-contracted { background: transparent; }
.ag-row-group .ag-group-value { font-weight: 650; color: var(--color-foreground); }
.ag-group-child-count { color: var(--color-muted-foreground); font-variant-numeric: tabular-nums; font-weight: 500; }
/* row-group panel: spell out what it does ("Group by") so the strip is legible,
   not just an icon + bare chips. The title bar is aria-hidden, so the label is
   purely decorative. */
.ag-column-drop-horizontal-title-bar { display: inline-flex; align-items: center; }
.ag-column-drop-horizontal-icon { color: var(--color-muted-foreground); }
.ag-column-drop-horizontal-title-bar::after {
  content: "Group by";
  margin-left: 7px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--color-muted-foreground);
}
/* row-group panel pills: interactive rounded chips that pick up the accent on hover */
.ag-column-drop-horizontal-cell { border-radius: 9999px; cursor: pointer; transition: border-color 120ms ease, background-color 120ms ease; }
.ag-column-drop-horizontal-cell:hover { border-color: color-mix(in oklab, var(--color-primary) 45%, var(--color-border)); background: color-mix(in oklab, var(--color-primary) 7%, transparent); }
/* nested grouping reads as one connected block: an EXPANDED group row drops its
   bottom separator so it joins its children/leaves; collapsed sibling groups keep
   theirs, staying visually distinct. */
.ag-row-group[aria-expanded="true"] { border-bottom-color: transparent !important; }
/* expand/collapse chevron picks up the accent on hover */
.ag-row-group .ag-group-expanded:hover, .ag-row-group .ag-group-contracted:hover { color: var(--color-primary); }
/* column resize handle: reveal on header-cell hover only */
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }
/* ---- filter popup: lift it out of monochrome ---- */
/* the action panel buttons are [Reset, Apply]; color Apply (last) as primary */
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
/* filter text input + condition picker: azure focus */
.ag-filter .ag-input-field-input:focus,
.ag-filter .ag-picker-field-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 22%, transparent);
}
/* ---- side bar tabs (Columns / Filters): clear active state ---- */
.ag-side-button-button { color: var(--color-muted-foreground); transition: color 120ms ease, background-color 120ms ease; }
.ag-side-button-button:hover { color: var(--color-foreground); }
.ag-side-button.ag-selected .ag-side-button-button {
  color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  box-shadow: inset 2px 0 0 0 var(--color-primary);
}
.ag-side-button-icon-wrapper { opacity: 1; }`,
})

export const gridTheme = themeQuartz
  .withParams({
    accentColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-background)',
    foregroundColor: 'var(--color-foreground)',
    chromeBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
    headerBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
    headerTextColor: 'color-mix(in oklab, var(--color-foreground) 70%, transparent)',
    borderColor: 'var(--color-border)',
    wrapperBorder: false,
    columnBorder: false,
    // Subtle vertical header separators (Angular search-v5 inspiration) — helps
    // scan across many columns without adding noise to the body cells.
    headerColumnBorder: { color: 'color-mix(in oklab, var(--color-border) 75%, transparent)' },
    headerColumnBorderHeight: '58%',
    rowBorder: { color: 'color-mix(in oklab, var(--color-foreground) 7%, transparent)' },
    rowHoverColor: 'color-mix(in oklab, var(--color-primary) 6%, transparent)',
    selectedRowBackgroundColor: 'color-mix(in oklab, var(--color-primary) 13%, transparent)',
    oddRowBackgroundColor: 'transparent',
    fontFamily: 'Geist Variable, system-ui, sans-serif',
    headerFontFamily: 'Geist Variable, system-ui, sans-serif',
    fontSize: 13,
    headerFontSize: 12,
    headerFontWeight: 550,
    cellHorizontalPadding: 14,
    spacing: 8,
    iconSize: 15,
    wrapperBorderRadius: 0,
  })
  .withPart(gridBodyPart)
