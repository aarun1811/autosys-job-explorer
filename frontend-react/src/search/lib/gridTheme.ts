import { createPart, themeQuartz } from 'ag-grid-community'

/**
 * AG-Grid v33+ Theming API theme for the search grid.
 *
 * Replaces the legacy `.ag-theme-quartz { --ag-* }` overrides (removed from
 * index.css in task 1.2). Params reference the shadcn oklch CSS variables
 * directly — `var()` is supported by the Theming API — so the grid follows
 * light/dark automatically via the `.dark` class cascade (no per-scheme literal
 * values needed). The container also carries `data-ag-theme-mode` (set in
 * SearchGrid) so AG-Grid's own popups/scrollbars pick the right color scheme.
 *
 * Refined & airy: generous spacing, medium-weight headers, a subtle row hover
 * that is DISTINCT from the accent-tinted selected row, visible-but-quiet
 * borders, no zebra striping, tabular numerals.
 *
 * Note: `withCSS` does not exist in ag-grid-community@35. Custom CSS is
 * injected via `createPart({ css: '...' })` + `.withPart(...)` instead.
 */

const tabularsNumeralsPart = createPart({
  css: '.ag-cell { font-variant-numeric: tabular-nums; }',
})

export const gridTheme = themeQuartz
  .withParams({
    accentColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-background)',
    foregroundColor: 'var(--color-foreground)',
    chromeBackgroundColor: 'var(--color-muted)',
    headerTextColor: 'var(--color-foreground)',
    borderColor: 'var(--color-border)',
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
  .withParams({}, 'dark')
  .withPart(tabularsNumeralsPart)
