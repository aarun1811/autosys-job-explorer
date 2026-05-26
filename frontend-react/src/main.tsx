import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LicenseManager } from 'ag-grid-enterprise'
import {
  ModuleRegistry,
  TextFilterModule,
  CellStyleModule,
  ColumnAutoSizeModule,
  RowApiModule,
  ColumnApiModule,
} from 'ag-grid-community'
import {
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  SideBarModule,
  RowGroupingModule,
  RowGroupingPanelModule,
  ServerSideRowModelApiModule,
  ColumnMenuModule,
} from 'ag-grid-enterprise'
import './index.css'
import App from './App'

// License MUST be set before any ModuleRegistry.registerModules() call (AG-Grid requirement)
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')

// AG-Grid v35 is fully modular — every grid feature must be explicitly
// registered. License-set MUST precede registerModules (Pitfall 9).
//
// Server-side row model + Excel export + ToolPanels are the Phase 3 core.
// TextFilterModule / CellStyleModule / ColumnAutoSizeModule / RowApiModule
// are required by features the columns already use (default text filter,
// kebab-converted cellStyle on Execution Order, autoSizeStrategy on the grid,
// and RowApiModule backs forEachNode (used by the toolbar Copy action)). SideBarModule
// is what makes `sideBar={{ toolPanels: ['columns','filters'] }}` work in
// v35 — previous versions bundled it with the tool-panel modules.
ModuleRegistry.registerModules([
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  SideBarModule,
  TextFilterModule,
  CellStyleModule,
  ColumnAutoSizeModule,
  RowApiModule,
  ColumnApiModule,
  RowGroupingModule,
  RowGroupingPanelModule,
  ServerSideRowModelApiModule,
  ColumnMenuModule,
])

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in DOM. Check index.html.')
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
