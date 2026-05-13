import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LicenseManager } from 'ag-grid-enterprise'
import { ModuleRegistry } from 'ag-grid-community'
import { ServerSideRowModelModule } from 'ag-grid-enterprise'
import './index.css'
import App from './App'

// License MUST be set before any ModuleRegistry.registerModules() call (AG-Grid requirement)
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')

// Register only the modules Phase 2 uses — no chart modules
ModuleRegistry.registerModules([ServerSideRowModelModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
