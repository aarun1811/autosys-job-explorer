import { createPart, themeQuartz } from 'ag-grid-community'

/**
 * AG-Grid v33+ Theming API theme for the search grid.
 *
 * Replaces the legacy `.ag-theme-quartz { --ag-* }` overrides (removed from
 * index.css in task 1.2). Params reference the shadcn oklch CSS variables
 * directly — `var()` is supported by the Theming API — so the grid follows
 * light/dark automatically via the `.dark` class cascade (no per-scheme literal
 * values needed). The grid container will carry `data-ag-theme-mode` (wired in
 * Task 1.2) so AG-Grid's own popups/scrollbars pick the right color scheme.
 *
 * Refined & airy: generous spacing, medium-weight headers, a subtle row hover
 * that is DISTINCT from the accent-tinted selected row, visible-but-quiet
 * borders, no zebra striping, tabular numerals.
 *
 * Note: `withCSS` does not exist in ag-grid-community@35. Custom CSS is
 * injected via `createPart({ css: '...' })` + `.withPart(...)` instead.
 */

const gridBodyPart = createPart({
  css: `.ag-cell { font-variant-numeric: tabular-nums; }
/* selected row: accent left-edge (distinct from hover) */
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
/* group rows read as a subtle tier */
.ag-row-group { background: color-mix(in oklab, var(--color-muted) 50%, transparent); }
/* column resize handle: reveal on header-cell hover only */
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }`,
})

export const gridTheme = themeQuartz
  .withParams({
    accentColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-background)',
    foregroundColor: 'var(--color-foreground)',
    chromeBackgroundColor: 'var(--color-muted)',
    headerTextColor: 'var(--color-foreground)',
    borderColor: 'var(--color-border)',
    columnBorder: false,
    rowBorder: { color: 'color-mix(in oklab, var(--color-foreground) 10%, transparent)' },
    rowHoverColor: 'color-mix(in oklab, var(--color-accent) 55%, transparent)',
    selectedRowBackgroundColor: 'color-mix(in oklab, var(--color-primary) 12%, transparent)',
    oddRowBackgroundColor: 'transparent',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerFontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    headerFontSize: 12,
    headerFontWeight: 500,
    spacing: 8,
    wrapperBorderRadius: 0,
  })
  .withPart(gridBodyPart)
