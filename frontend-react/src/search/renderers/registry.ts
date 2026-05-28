import type { ComponentType } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'

import { AppIDCellRenderer } from './AppIDCellRenderer'
import { SupportEmailCellRenderer } from './SupportEmailCellRenderer'
import { ExecutionOrderCellRenderer } from './ExecutionOrderCellRenderer'
import { QuickRecStatsCellRenderer } from './QuickRecStatsCellRenderer'

/**
 * String-key → component map consumed by the AG-Grid `components` prop in
 * Plan 05 (SearchGrid). The keys here MUST match the `cellRenderer` string
 * values in `search-config-v4.json` so the JSON config drives column behavior
 * without touching React code (D-3.3 — single editing surface).
 *
 * Adding a new renderer:
 *   1. Create `frontend-react/src/search/renderers/<Name>CellRenderer.tsx`
 *   2. Add `<keyFromJson>: <Component>` to this map
 *   3. Reference `cellRenderer: "<keyFromJson>"` in `search-config-v4.json`
 *
 * Unknown keys resolve to `undefined`; the Plan 04 adapter falls back to
 * AG-Grid's default text renderer (03-PATTERNS.md Pitfall 6).
 */
export const cellRenderers: Record<string, ComponentType<ICellRendererParams>> = {
  appIDCellRenderer: AppIDCellRenderer,
  supportEmailCellRenderer: SupportEmailCellRenderer,
  executionOrderButtonRenderer: ExecutionOrderCellRenderer,
  quickRecStatsButtonRenderer: QuickRecStatsCellRenderer,
}
