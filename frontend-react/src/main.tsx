import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LicenseManager } from 'ag-grid-enterprise'
import { ModuleRegistry } from 'ag-grid-community'
import {
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
} from 'ag-grid-enterprise'
import './index.css'
import App from './App'

// License MUST be set before any ModuleRegistry.registerModules() call (AG-Grid requirement)
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')

// Register only the modules Phase 2 uses — no chart modules
// Phase 3 adds ExcelExport (Plan 06 toolbar export), ColumnsToolPanel + FiltersToolPanel
// (Plan 05 SearchGrid sideBar). License-set MUST precede registerModules (Pitfall 9).
ModuleRegistry.registerModules([
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
])

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in DOM. Check index.html.')
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
