# React↔Angular Parity Matrix

**Last updated:** 2026-06-12 (reconciled against verified code state — see `.planning/codebase/CURRENT-STATE-2026-06-12.md`)
**Status:** React is the go-forward UI; Angular (`frontend/`) is frozen and slated for deletion. The React search surface is config-driven and covers all 13 categories; execution-order and TLM/QuickRec are ported.

> **Target vocabulary:**
> - `port` — built in React natively
> - `replace-content-with-recviz` — React owns the renderer/modal shell; content inside is a RecViz iframe
> - `drop` — not needed in React; deleted from inventory
> - `tbd` — decide during that capability's React phase planning

## Search Tabs (from search-config-v4.json)

All 13 categories are served by one **config-driven** React search surface (`frontend-react/src/search/`): tabs, columns, and renderers are produced from the `/api/v4/search/initial` config + `cellRenderer` string keys — none are hardcoded per category. Adding/removing a tab is a `search-config-v4.json` change.

| Angular Feature | search-config key | Renderers referenced | Target | Status |
|---|---|---|---|---|
| File Name | `fileName` | appID, supportEmail, executionOrder | `port` | **ported** (config-driven) |
| Recon Name | `reconName` | executionOrder | `port` | **ported** (config-driven) |
| Box Name | `boxName` | executionOrder | `port` | **ported** |
| Set ID | `setId` | executionOrder | `port` | **ported** |
| Sub Account | `subAcc` | executionOrder | `port` | **ported** |
| Load File Name | `loadFileName` | executionOrder | `port` | **ported** |
| Job Name | `jobName` | appID, supportEmail, executionOrder | `port` | **ported** |
| Machine Name | `machineName` | (none) | `port` | **ported** |
| Run Calendar | `runCalendar` | (none) | `port` | **ported** |
| Exclude Calendar | `excludeCalendar` | (none) | `port` | **ported** |
| TLM Instance | `tlmInstance` | tlmStats / quickRecStats (cell action) | `port` + `replace-content-with-recviz` | **ported**; TLM/QuickRec cells open a RecViz iframe modal |
| Recon ID | `reconId` | (config-driven) | `port` | **ported** |
| Recon Portal ID | `reconPortalId` | (config-driven) | `port` | **ported** |
| reconSummary (SQL example) | `sql-search-config-v4.json#reconSummary` | plain text | `port` | backend ready (`/api/v4/sql-search/...`); React consumption per `.planning/archive/phases/05-config-driven-select/ANGULAR-WIRING.md` |

> Note: the category-level `dashboard` config concept (the old `overview` synthetic tab + `jobName.dashboard` block) was **removed by A1a (2026-05-31)** — no category carries `dashboard` config now. The `DashboardConfig` DTO/types remain as an unused hook.

## Modals

| Angular Feature | Renderers / Components | Target | Status |
|---|---|---|---|
| Execution Order Modal | (Angular) `ExecutionOrderButtonComponent` + Cytoscape.js | `port` | **ported & redesigned** — native React Flow (`@xyflow/react` v12 + dagre) `ExecutionOrderModal` (Graph + JobInspector + StatusLegend + QuickFind + PipelineSummaryStrip). **Not Cytoscape, not a placeholder.** |
| TLM Stats Modal V2 | (Angular) `TlmInstanceV2RendererComponent` | `replace-content-with-recviz` | **ported** — `TlmStatsCellRenderer` → `RecvizDashboardModal` → `RecvizEmbed` iframe (`dash-tlm-stats`). RecViz-side dashboard seeding + filter-ID contract remaining. |
| QuickRec Stats Modal | (Angular) `QuickRecStatsService` + renderer | `replace-content-with-recviz` | **ported** — `QuickRecStatsCellRenderer` → `RecvizDashboardModal` (`dash-quickrec-stats`); clickable only when `data.tlm_instance === 'QuickRec'`. |
| TLM Stats Modal V1 | `SetIdCellRendererComponent` (v1, dead) | `drop` | dropped — not ported |

## Grid Features

| Angular Feature | Target | Status |
|---|---|---|
| AG-Grid SSRM + group expansion | `port` | **ported** — AG-Grid Enterprise 35 SSRM datasource against `POST /api/v4/search/ssrm/{category}` |
| AG-Grid column / filter sidebar | `port` | **ported** — ColumnsToolPanel + FiltersToolPanel + SideBar modules (16 modules registered in `main.tsx`) |
| Saved grid state / share view | — | added in React (`GridStateModule`) — no direct Angular analog |

## Toolbar and App Shell Features

| Angular Feature | Target | Status |
|---|---|---|
| Excel export | `port` | **ported — server-side**: `POST /api/v4/search/export/{category}` → blob download (Angular parity; full dataset, not SSRM-cached-rows). *(Supersedes the stale Phase-3 D-3.10 "client-side `gridApi.exportDataAsExcel()`" note.)* |
| Recent searches / typeahead | `port` | **ported** — `useRecentSearches` (localStorage LRU, 10-cap) + SearchBar Popover |
| Dark / light mode toggle | `port` | **ported** — custom `ThemeProvider` (`rectrace-theme` localStorage key) |

## Renderer Inventory (React — `frontend-react/src/search/renderers/registry.ts`)

The `cellRenderers` map registers exactly **5** keys (must match `cellRenderer` strings in `search-config-v4.json`):

| Renderer Key | Component | Behavior |
|---|---|---|
| `appIDCellRenderer` | `AppIDCellRenderer` | anchor link |
| `supportEmailCellRenderer` | `SupportEmailCellRenderer` | `mailto:` link |
| `executionOrderButtonRenderer` | `ExecutionOrderCellRenderer` | fetches `/api/execution-order/{job}`, opens React Flow `ExecutionOrderModal` |
| `tlmStatsButtonRenderer` | `TlmStatsCellRenderer` | opens RecViz `dash-tlm-stats` iframe modal |
| `quickRecStatsButtonRenderer` | `QuickRecStatsCellRenderer` | opens RecViz `dash-quickrec-stats` iframe modal |

The old Angular `setIdV2Renderer` / `reconV2Renderer` / `reconIdRenderer` / `recPortalIdRenderer` keys were not ported as distinct renderers — those categories render config-driven plain columns.

---

## Update log

- 2026-06-12 — Full reconciliation against verified code: all 13 tabs marked ported (config-driven); execution-order = React Flow redesign; TLM/QuickRec = RecViz embed; Excel export corrected to server-side; renderer inventory updated to the 5 actual React keys; A1a dashboard-config removal noted.
- 2026-05-17 — Phase 5: reconSummary SQL tab added; backend ready, frontend deferred.
- 2026-05-12 — Phase 0 day-0 snapshot created.
