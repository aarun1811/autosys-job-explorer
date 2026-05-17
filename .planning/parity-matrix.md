# React↔Angular Parity Matrix

**Last updated:** 2026-05-17
**Status:** Phase 3 closeout — File Name tab + 3 renderers + Excel export + Recent searches flipped to `port`

> **Gate:** The React Foundation phase (Phase 2) can begin once every row in this table
> has a non-`tbd` value in the **Target** column. Priority and Notes may remain `tbd`
> at that point — they are filled during each React phase's planning.

> **Phase 2 Foundation Gate Note (D-2.18):** The strict FOUND-04 gate ("Phase 2 can begin once every row has a non-`tbd` value in Target") is relaxed for Phase 2 Foundation. Phase 2 ships only scaffolding (empty SSRM smoke grid) — no cell renderers, modals, or search tabs are ported. Target values are locked **per-port-phase**: Phase 3 locks Targets for search tab + renderers it ports; Phase 4 locks Targets for the modals it owns.

> **Target vocabulary:**
> - `port` — build the capability in React natively
> - `replace-content-with-recviz` — React owns the renderer/modal shell; content inside is a recviz iframe
> - `replace-fully-with-recviz` — capability removed from rectrace entirely; lives in recviz
> - `drop` — not needed in React; delete from inventory
> - `tbd` — decide during that capability's React phase planning

## Search Tabs (from search-config-v4.json)

| Angular Feature | Type | Current Location | Renderers / Components | Target | Priority | Notes |
|---|---|---|---|---|---|---|
| File Name search tab | search-tab | search-config-v4.json#fileName | `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer` | port | tbd | Phase 3 — fileName tab ported in `frontend-react/src/search/SearchPage.tsx` (config-driven via `/api/v4/search/config`); see `.planning/phases/03-react-search-vertical-slice/` plan summaries |
| Recon Name search tab | search-tab | search-config-v4.json#reconName | `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Box Name search tab | search-tab | search-config-v4.json#boxName | `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Set ID search tab | search-tab | search-config-v4.json#setId | `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Sub Account search tab | search-tab | search-config-v4.json#subAcc | `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Load File Name search tab | search-tab | search-config-v4.json#loadFileName | `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Job Name search tab | search-tab | search-config-v4.json#jobName | `appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer` | tbd | tbd | tbd |
| Machine Name search tab | search-tab | search-config-v4.json#machineName | (none) | tbd | tbd | tbd |
| Run Calendar search tab | search-tab | search-config-v4.json#runCalendar | (none) | tbd | tbd | tbd |
| Exclude Calendar search tab | search-tab | search-config-v4.json#excludeCalendar | (none) | tbd | tbd | tbd |
| TLM Instance search tab | search-tab | search-config-v4.json#tlmInstance | `tlmInstanceV2Renderer` (registered in grid, not referenced by config) | tbd | tbd | tbd |
| Recon ID search tab | search-tab | search-config-v4.json#reconId | `reconIdRenderer` (registered in grid, not referenced by config) | tbd | tbd | tbd |
| Recon Portal ID search tab | search-tab | search-config-v4.json#reconPortalId | `recPortalIdRenderer` (registered in grid, not referenced by config) | tbd | tbd | tbd |

## Modals

| Angular Feature | Type | Current Location | Renderers / Components | Target | Priority | Notes |
|---|---|---|---|---|---|---|
| Execution Order Modal | modal | custom-interactions/components/modals/execution-order-graph/, execution-order-modal/ | `ExecutionOrderButtonComponent`, Cytoscape.js | tbd | tbd | tbd |
| TLM Stats Modal V2 | modal | custom-interactions/components/modals/tlm-stats-modal-v2/ | `TlmInstanceV2RendererComponent` | replace-content-with-recviz | tbd | Canonical example of replace-content-with-recviz: the modal shell and renderer stay in rectrace; the dashboard content inside the modal is a recviz iframe. The React cell renderer that opens the modal stays in rectrace. |
| TLM Stats Modal V1 | modal | custom-interactions/components/modals/tlm-stats-modal/ | `SetIdCellRendererComponent` (v1, dead code) | drop | tbd | Dead code per CONCERNS.md MEDIUM — V1 renderer and modal are unused by the V5 grid. Do not port to React. |
| QuickRec Stats Modal | modal | custom-interactions/components/modals/quickrec-stats-modal/ | `QuickRecStatsService`, dedicated renderer | tbd | tbd | tbd |

## Grid Features

| Angular Feature | Type | Current Location | Renderers / Components | Target | Priority | Notes |
|---|---|---|---|---|---|---|
| AG-Grid SSRM + group expansion | grid-feature | search-v5-grid.component.ts | `SearchV5GridComponent`, AG-Grid Enterprise SSRM | port | tbd | Core grid functionality — must be ported to AG-Grid React with identical SSRM datasource |
| AG-Grid column / filter sidebar | grid-feature | search-v5-grid.component.ts | AG-Grid side bar config | port | tbd | tbd |

## Toolbar and App Shell Features

| Angular Feature | Type | Current Location | Renderers / Components | Target | Priority | Notes |
|---|---|---|---|---|---|---|
| Excel export | toolbar-feature | search-v5-grid.component.ts | AG-Grid export API | port | tbd | Phase 3 — client-side `gridApi.exportDataAsExcel()` in `frontend-react/src/search/SearchToolbar.tsx` (D-3.10 — diverges from Angular backend export; SSRM cached-rows-only acknowledged) |
| Recent searches / typeahead | toolbar-feature | search-v5.component.ts | `SearchV5Component` | port | tbd | Phase 3 — built natively in React: `frontend-react/src/search/hooks/useRecentSearches.ts` + `SearchBar` Popover (no Angular analog) |
| Dark / light mode toggle | app-shell | services/theme.service.ts | `ThemeService` | port | tbd | tbd |

## Renderer Inventory (Registered, Not All Wired to V4 Config)

The following renderers are registered in `SearchV5GridComponent.gridOptions.components` but are not currently
referenced in `search-config-v4.json`. They may be active via legacy V3 config or dynamic category config.
Assign `port` or `drop` during the React phase that covers their parent tab.

| Renderer Key | Angular Component | Used By | Target |
|---|---|---|---|
| `appIDCellRenderer` | `AppIDCellRendererComponent` | fileName, jobName tabs (V4) | port — Phase 3: fileName tab ported in `frontend-react/src/search/renderers/AppIDCellRenderer.tsx`; jobName remains tbd for Phase 4+ |
| `supportEmailCellRenderer` | `AppSupportCellRendererComponent` | fileName, jobName tabs (V4) | port — Phase 3: fileName tab ported in `frontend-react/src/search/renderers/SupportEmailCellRenderer.tsx`; jobName remains tbd for Phase 4+ |
| `executionOrderButtonRenderer` | `ExecutionOrderButtonComponent` | 7 V4 search tabs | port — Phase 3: fileName tab ported in `frontend-react/src/search/renderers/ExecutionOrderCellRenderer.tsx` with placeholder Dialog; other 6 tabs + full Cytoscape modal remain tbd for Phase 4+ |
| `setIdV2Renderer` | `SetIdV2RendererComponent` | Not in V4 config | tbd — verify against V3 config; candidate for `drop` |
| `reconV2Renderer` | `ReconV2RendererComponent` | Not in V4 config | tbd — verify against V3 config; candidate for `drop` |
| `tlmInstanceV2Renderer` | `TlmInstanceV2RendererComponent` | TLM Instance tab (grid-registered, config-implicit) | tbd |
| `reconIdRenderer` | `ReconIdRendererComponent` | Not in V4 config | tbd — verify against V3 config; candidate for `drop` |
| `recPortalIdRenderer` | `RecPortalIdRendererComponent` | Not in V4 config | tbd — verify against V3 config; candidate for `drop` |

---

*Phase 0 — Day-0 snapshot created: 2026-05-12*
*Matrix is a living document — updated as React phases land.*
