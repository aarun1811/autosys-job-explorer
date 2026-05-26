// src/search/lib/gridConfig.ts
import type { SideBarDef } from 'ag-grid-community'

/** Row-height presets for the density toggle. */
export type GridDensity = 'normal' | 'compact'

export function rowHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 24 : 32
}

export function headerHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 32 : 36
}

/**
 * Right-hand Columns + Filters sidebar (Angular search-v5 parity). The Columns
 * panel suppresses Pivot Mode / Values / Pivots so it opens to a clean
 * "Columns + Row Groups" view; nothing is open by default (`defaultToolPanel: ''`).
 * The toolbar's panel button opens the Columns panel explicitly.
 */
export const GRID_SIDEBAR: SideBarDef = {
  toolPanels: [
    {
      id: 'columns',
      labelDefault: 'Columns',
      labelKey: 'columns',
      iconKey: 'columns',
      toolPanel: 'agColumnsToolPanel',
      minWidth: 225,
      width: 225,
      maxWidth: 400,
      toolPanelParams: {
        suppressRowGroups: false,
        suppressValues: true,
        suppressPivots: true,
        suppressPivotMode: true,
        suppressColumnFilter: false,
        suppressColumnSelectAll: false,
        suppressColumnExpandAll: false,
      },
    },
    {
      id: 'filters',
      labelDefault: 'Filters',
      labelKey: 'filters',
      iconKey: 'filter',
      toolPanel: 'agFiltersToolPanel',
      minWidth: 200,
      width: 250,
      maxWidth: 400,
      toolPanelParams: {
        suppressFilterSearch: false,
        suppressExpandAll: false,
      },
    },
  ],
  position: 'right',
  defaultToolPanel: '',
}
