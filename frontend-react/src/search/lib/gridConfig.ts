// src/search/lib/gridConfig.ts
import type { MultiRowSelectionOptions, StatusPanelDef } from 'ag-grid-community'

/** Row-height presets for the density toggle. */
export type GridDensity = 'normal' | 'compact'

export function rowHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 28 : 36
}

/** Status bar: total · filtered · selected (Angular-parity + the new Selected count). */
export const GRID_STATUS_BAR: { statusPanels: StatusPanelDef[] } = {
  statusPanels: [
    { statusPanel: 'agTotalRowCountComponent', align: 'left' },
    { statusPanel: 'agFilteredRowCountComponent', align: 'center' },
    { statusPanel: 'agSelectedRowCountComponent', align: 'right' },
  ],
}

/**
 * Multi-row selection via a leading checkbox column. Click-select is OFF so
 * single-click stays free for cell text-selection and double-click opens the
 * detail drawer; the header checkbox toggles the page.
 */
// Typed as the narrow MultiRowSelectionOptions (NOT the RowSelectionOptions
// union) so `headerCheckbox`/`checkboxes` are accessible to the unit test under
// tsc. SearchGrid's `rowSelection` prop accepts the union, so this is assignable.
export const GRID_ROW_SELECTION: MultiRowSelectionOptions = {
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
}
