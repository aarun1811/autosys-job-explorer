# SSRM Angular-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the React SSRM grid to functional + performance parity with Angular `search-v5`: real `visibleColumns` + filter-model conversion, a stable `getRowId` for native group-expansion preservation, column/regroup refetch listeners, expand/collapse module, ColDef + grid-option parity, density row+header height, and full-dataset backend export.

**Architecture:** Pure helpers in `lib/ssrm.ts` (request building, row id, visible columns, filter conversion) keep logic testable. `SearchGrid` gains the grid options + datasource wiring + column listeners; `SearchGridPanel` switches export to the backend endpoint. Two enterprise modules are registered. No backend changes.

**Tech Stack:** React 19, AG-Grid v35 (community + enterprise), TanStack, Vitest. Run all commands from `frontend-react/`: prefix with `cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react && …`. Commit on branch `milestone/modernization`. Every commit message ends with the trailer `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

**Spec:** `docs/superpowers/specs/2026-05-26-ssrm-angular-parity-design.md`

**Verified facts:** `ServerSideRowModelApiModule` + `ColumnMenuModule` are exported by `ag-grid-enterprise`. `filterParams.maxNumConditions: number` exists (use `1`). `ColumnVisibleEvent` has `source`, `column`, `visible`. `GetRowIdParams` has `data`, `level`, `parentKeys?`.

---

## File Structure

| File | New/Modify | Responsibility |
|---|---|---|
| `src/search/lib/ssrm.ts` | new | `FRONTEND_ONLY_COLUMNS`, `buildSsrmRowId`, `getVisibleColumnIds`, `convertFilterModel`, `searchColumnFor`, `buildInitialFilter` — pure, tested. |
| `src/search/lib/gridConfig.ts` | modify | `rowHeightForDensity` 24/32; add `headerHeightForDensity` 32/36. |
| `src/search/lib/configToColDefs.ts` | modify | add `enableRowGroup`, `menuTabs`, `filterParams` per ColDef. |
| `src/main.tsx` | modify | register `ServerSideRowModelApiModule` + `ColumnMenuModule`. |
| `src/search/SearchGrid.tsx` | modify | `getRowId`, `defaultColDef`, `autoGroupColumnDef`, grid options, `headerHeight`, datasource `visibleColumns`+`convertFilterModel`, `onColumnVisible`(debounced)/`onColumnRowGroupChanged`; remove `autoSizeStrategy`; use `ssrm.ts` helpers. |
| `src/search/types.ts` | modify | add `ExportRequestV4`. |
| `src/search/lib/exportSearch.ts` | new | `exportSearchToExcel(category, body)` — POST `/export/{category}`, download blob. |
| `src/search/SearchGridPanel.tsx` | modify | `onExportExcel` builds `ExportRequestV4` and calls the backend export; density passes `headerHeight` already via `SearchGrid`. |

---

### Task 1: `lib/ssrm.ts` — SSRM request helpers

**Files:** Create `src/search/lib/ssrm.ts`, `src/search/__tests__/ssrm.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/search/__tests__/ssrm.test.ts
import { describe, test, expect } from 'vitest'
import {
  FRONTEND_ONLY_COLUMNS,
  buildSsrmRowId,
  getVisibleColumnIds,
  convertFilterModel,
  searchColumnFor,
  buildInitialFilter,
} from '@/search/lib/ssrm'
import type { CategoryResultV4 } from '@/search/types'

const cat = (over: Partial<CategoryResultV4> = {}): CategoryResultV4 => ({
  key: 'jobName', label: 'Job Name', count: 4, hasMore: false,
  values: ['A', 'B'],
  columns: [{ field: 'job_name', headerName: 'Job Name', rowGroup: true }, { field: 'box_name', headerName: 'Box' }],
  ...over,
})

describe('ssrm helpers', () => {
  test('buildSsrmRowId: group id ignores leaf columns (stable across column changes)', () => {
    // group row: no parents, data is just the group value
    const groupId = buildSsrmRowId({ parentKeys: [], data: { job_name: 'RECON-1' } })
    // leaf row under that group: route prefix + its own values
    const leafId = buildSsrmRowId({ parentKeys: ['RECON-1'], data: { box_name: 'BOX-1', machine: 'm1' } })
    expect(groupId).toBe('RECON-1')
    expect(leafId.startsWith('RECON-1')).toBe(true)
    expect(leafId).not.toBe(groupId)
  })

  test('getVisibleColumnIds: drops hidden + frontend-only, always includes group cols', () => {
    const state = [
      { colId: 'job_name', hide: true },   // hidden but is a group col → kept
      { colId: 'box_name', hide: false },
      { colId: 'machine', hide: true },    // hidden, not group → dropped
      { colId: 'execution_order', hide: false }, // frontend-only → dropped
      { colId: 'ag-Grid-AutoColumn', hide: false }, // frontend-only → dropped
    ] as Array<{ colId: string; hide: boolean }>
    expect(getVisibleColumnIds(state as never, ['job_name'])).toEqual(['box_name', 'job_name'])
  })

  test('convertFilterModel: drops empty entries, defaults filterType/type', () => {
    const raw = {
      box_name: { filter: 'trade' },
      machine: { filter: '' },          // dropped
      recon: null,                       // dropped
      job_name: { filterType: 'text', type: 'equals', filter: 'X' },
    }
    expect(convertFilterModel(raw as never)).toEqual({
      box_name: { filterType: 'text', type: 'contains', filter: 'trade' },
      job_name: { filterType: 'text', type: 'equals', filter: 'X' },
    })
    expect(convertFilterModel(null)).toEqual({})
  })

  test('searchColumnFor / buildInitialFilter use the rowGroup column', () => {
    expect(searchColumnFor(cat())).toBe('job_name')
    expect(buildInitialFilter(cat())).toEqual({ column: 'job_name', values: ['A', 'B'] })
    expect(buildInitialFilter(cat({ values: [] }))).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm vitest run src/search/__tests__/ssrm.test.ts`) — module not found.

- [ ] **Step 3: Implement**

```ts
// src/search/lib/ssrm.ts
import type { ColumnState, GetRowIdParams } from 'ag-grid-community'
import type { CategoryResultV4, InitialFilter } from '@/search/types'

/** Columns that exist only in the grid UI — never sent to the backend SELECT. */
export const FRONTEND_ONLY_COLUMNS = new Set(['execution_order', 'actions', 'ag-Grid-AutoColumn'])

const SEP = '' // low-collision separator for composite row ids

/**
 * Stable SSRM row id: route (parent group keys) + this row's own values.
 * Group-level rows carry only the group value (independent of which columns are
 * visible) → group ids stay stable across column show/hide, so AG-Grid preserves
 * group expansion across refreshes. Leaf ids change with the visible set (fine).
 */
export function buildSsrmRowId(params: Pick<GetRowIdParams, 'parentKeys' | 'data'>): string {
  const parents = params.parentKeys ?? []
  const own = Object.values(params.data ?? {}).map((v) => String(v ?? '')).join(SEP)
  return [...parents, own].join(SEP)
}

/** Visible (non-hidden, non-frontend-only) column ids, always including row-group cols. */
export function getVisibleColumnIds(columnState: ColumnState[], rowGroupColIds: string[]): string[] {
  const ids: string[] = []
  for (const c of columnState) {
    if (c.hide) continue
    if (FRONTEND_ONLY_COLUMNS.has(c.colId)) continue
    ids.push(c.colId)
  }
  for (const id of rowGroupColIds) {
    if (!FRONTEND_ONLY_COLUMNS.has(id) && !ids.includes(id)) ids.push(id)
  }
  return ids
}

interface RawFilterEntry { filterType?: string; type?: string; filter?: unknown }

/** AG-Grid filter model → backend shape: keep entries with a real `.filter`; default filterType/type. */
export function convertFilterModel(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!raw) return out
  for (const [field, value] of Object.entries(raw)) {
    const e = value as RawFilterEntry | null
    if (e == null || e.filter == null || e.filter === '') continue
    out[field] = { filterType: e.filterType ?? 'text', type: e.type ?? 'contains', filter: e.filter }
  }
  return out
}

/** The ES search column = the column flagged rowGroup in the category config. */
export function searchColumnFor(category: CategoryResultV4): string {
  return category.columns.find((c) => c.rowGroup)?.field ?? ''
}

export function buildInitialFilter(category: CategoryResultV4): InitialFilter | null {
  const column = searchColumnFor(category)
  if (category.values.length === 0 || !column) return null
  return { column, values: category.values }
}
```

- [ ] **Step 4: Run — expect PASS** (4 tests). `pnpm typecheck` clean.
- [ ] **Step 5: Commit**

```bash
git add src/search/lib/ssrm.ts src/search/__tests__/ssrm.test.ts
git commit -m "feat(grid): SSRM request helpers (rowId, visibleColumns, filter conversion)"
```

---

### Task 2: density row + header height (`gridConfig.ts`)

**Files:** Modify `src/search/lib/gridConfig.ts`, `src/search/__tests__/gridConfig.test.ts`.

- [ ] **Step 1: Update the test** — replace the `rowHeightForDensity` test and add a header-height test:

```ts
  test('rowHeightForDensity + headerHeightForDensity match Angular (24/32, 32/36)', () => {
    expect(rowHeightForDensity('compact')).toBe(24)
    expect(rowHeightForDensity('normal')).toBe(32)
    expect(headerHeightForDensity('compact')).toBe(32)
    expect(headerHeightForDensity('normal')).toBe(36)
  })
```
Update the import line to `import { rowHeightForDensity, headerHeightForDensity, GRID_SIDEBAR } from '@/search/lib/gridConfig'` and delete the old `rowHeightForDensity: compact is shorter than normal` test.

- [ ] **Step 2: Run — expect FAIL** (`headerHeightForDensity` undefined; old values 28/36).

- [ ] **Step 3: Implement** — replace `rowHeightForDensity` and add `headerHeightForDensity`:

```ts
export function rowHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 24 : 32
}

export function headerHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 32 : 36
}
```

- [ ] **Step 4: Run — expect PASS.** `pnpm typecheck` clean.
- [ ] **Step 5: Commit**

```bash
git add src/search/lib/gridConfig.ts src/search/__tests__/gridConfig.test.ts
git commit -m "feat(grid): density row+header heights match Angular (24/32, 32/36)"
```

---

### Task 3: ColDef parity (`configToColDefs.ts`)

**Files:** Modify `src/search/lib/configToColDefs.ts`, `src/search/__tests__/configToColDefs.test.ts`.

- [ ] **Step 1: Write the failing test** (append to the existing describe):

```ts
  test('each ColDef enables row-group, column menu tabs, and apply/reset filter params', () => {
    const [col] = columnsToColDefs([{ field: 'box_name', headerName: 'Box' }])
    expect(col.enableRowGroup).toBe(true)
    expect(col.menuTabs).toEqual(['generalMenuTab', 'columnsMenuTab'])
    expect(col.filterParams).toMatchObject({ buttons: ['reset', 'apply'], closeOnApply: true, maxNumConditions: 1 })
  })

  test('a column with filter:false gets no filterParams', () => {
    const [col] = columnsToColDefs([{ field: 'x', headerName: 'X', filter: false }])
    expect(col.filter).toBe(false)
    expect(col.filterParams).toBeUndefined()
  })
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — in `columnsToColDefs`, add to the returned ColDef object (after `filter:` and `resizable:`):

```ts
    enableRowGroup: true,
    menuTabs: ['generalMenuTab', 'columnsMenuTab'],
    filterParams:
      c.filter === false
        ? undefined
        : { buttons: ['reset', 'apply'], closeOnApply: true, maxNumConditions: 1, debounceMs: 0 },
```

- [ ] **Step 4: Run — expect PASS.** `pnpm typecheck` clean.
- [ ] **Step 5: Commit**

```bash
git add src/search/lib/configToColDefs.ts src/search/__tests__/configToColDefs.test.ts
git commit -m "feat(grid): ColDef parity — enableRowGroup, menuTabs, apply/reset filterParams"
```

---

### Task 4: register expand/collapse + column-menu modules (`main.tsx`)

**Files:** Modify `src/main.tsx`.

- [ ] **Step 1: Add to the `ag-grid-enterprise` import block:**

```ts
  RowGroupingModule,
  RowGroupingPanelModule,
  ServerSideRowModelApiModule,
  ColumnMenuModule,
```
(keep the existing enterprise imports; add the two new names `ServerSideRowModelApiModule` and `ColumnMenuModule`.)

- [ ] **Step 2: Append both to `ModuleRegistry.registerModules([...])`** (after the existing enterprise entries):

```ts
  ServerSideRowModelApiModule,
  ColumnMenuModule,
```

- [ ] **Step 3: Verify build** — `pnpm build` MUST exit 0 (proves both module names resolve against `ag-grid-enterprise@35`).
- [ ] **Step 4: Commit**

```bash
git add src/main.tsx
git commit -m "feat(grid): register ServerSideRowModelApi (expand/collapse) + ColumnMenu modules"
```

---

### Task 5: `SearchGrid` — getRowId, datasource, grid options, column listeners

**Files:** Modify `src/search/SearchGrid.tsx`, `src/search/__tests__/SearchGrid.test.tsx`.

- [ ] **Step 1: Write the failing test** — extend the datasource test to assert the new request body fields. Add to `SearchGrid.test.tsx` (the file already calls `_test_buildDatasource` and invokes `getRows` with a mock `params`):

```ts
  test('getRows sends computed visibleColumns and a converted filterModel', async () => {
    const ds = _test_buildDatasource('recon', {
      key: 'jobName', label: 'Job Name', count: 1, hasMore: false, values: ['A'],
      columns: [{ field: 'job_name', headerName: 'Job', rowGroup: true }],
    } as never)
    const params = {
      request: {
        startRow: 0, endRow: 100, rowGroupCols: [{ field: 'job_name' }], groupKeys: [], sortModel: [],
        filterModel: { box_name: { filter: 'b' }, empty: { filter: '' } },
      },
      api: {
        getColumnState: () => [
          { colId: 'job_name', hide: true },        // hidden but is the group col → kept
          { colId: 'box_name', hide: false },
          { colId: 'execution_order', hide: false }, // frontend-only → dropped
        ],
        getRowGroupColumns: () => [{ getColId: () => 'job_name' }],
      },
      success: vi.fn(),
      fail: vi.fn(),
    }
    await ds.getRows(params as never)
    const lastCall = apiFetchMock.mock.calls.at(-1)!
    const body = JSON.parse(lastCall[1].body)
    expect(body.visibleColumns).toEqual(['box_name', 'job_name'])
    expect(body.filterModel).toEqual({ box_name: { filterType: 'text', type: 'contains', filter: 'b' } })
  })
```

> **Implementer note:** reuse the file's existing `@/lib/queryClient` mock (the `apiFetchMock` already declared at the top of `SearchGrid.test.tsx`) — adapt the variable name if it differs. No new fetch shim. The intent: call `getRows` with a `params` carrying `api.getColumnState()`/`getRowGroupColumns()` + `request.filterModel`, then assert the POST body's `visibleColumns` and `filterModel`.

- [ ] **Step 2: Run — expect FAIL** (current body has `visibleColumns: []` and raw filterModel).

- [ ] **Step 3: Implement.** Update `src/search/SearchGrid.tsx`:

(a) Imports — replace the local `searchColumnFor`/`buildInitialFilter` with the `ssrm.ts` versions and add helpers:
```ts
import { GRID_SIDEBAR, rowHeightForDensity, headerHeightForDensity, type GridDensity } from '@/search/lib/gridConfig'
import {
  buildSsrmRowId, getVisibleColumnIds, convertFilterModel, buildInitialFilter, FRONTEND_ONLY_COLUMNS,
} from '@/search/lib/ssrm'
import { useRef } from 'react'
import type { ColumnVisibleEvent } from 'ag-grid-community'
```
Delete the local `searchColumnFor` and `buildInitialFilter` function definitions in this file (now imported).

(b) In `_test_buildDatasource` `getRows`, build the body using `params.api`:
```ts
const body: SSRMRequestV4 = {
  category: category.key,
  initialFilter: buildInitialFilter(category),
  rowGroupCols: (params.request.rowGroupCols ?? []).map((c) => c.field ?? ''),
  groupKeys: params.request.groupKeys ?? [],
  sortModel: params.request.sortModel ?? [],
  filterModel: convertFilterModel(params.request.filterModel as Record<string, unknown>),
  startRow: params.request.startRow ?? 0,
  endRow: params.request.endRow ?? 100,
  visibleColumns: getVisibleColumnIds(
    params.api.getColumnState(),
    params.api.getRowGroupColumns().map((c) => c.getColId()),
  ),
}
```

(c) Component: add the debounce ref + handlers, density header height, and replace the `AgGridReact` props:
```ts
export function SearchGrid({ q, category, density, onGridReady, onFirstDataRendered, onRowDoubleClicked }: SearchGridProps): ReactElement {
  const columnDefs = useMemo<ColDef[]>(() => columnsToColDefs(category.columns), [category])
  const datasource = useMemo<IServerSideDatasource>(() => _test_buildDatasource(q, category), [q, category])
  const colVisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <div className="ag-theme-quartz h-full w-full">
      <AgGridReact
        key={`${q}-${category.key}`}
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={columnDefs}
        components={cellRenderers}
        getRowId={buildSsrmRowId}
        defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 100, flex: 1 }}
        autoGroupColumnDef={{
          headerName: category.columns[0]?.headerName,
          minWidth: 250,
          cellRendererParams: { suppressCount: false },
        }}
        sideBar={GRID_SIDEBAR}
        rowGroupPanelShow="always"
        groupDefaultExpanded={0}
        animateRows
        enableCellTextSelection
        suppressCellFocus
        suppressMakeColumnVisibleAfterUnGroup={false}
        tooltipShowDelay={0}
        tooltipHideDelay={2000}
        rowHeight={rowHeightForDensity(density)}
        headerHeight={headerHeightForDensity(density)}
        cacheBlockSize={100}
        maxBlocksInCache={10}
        onGridReady={onGridReady}
        onFirstDataRendered={onFirstDataRendered}
        onRowDoubleClicked={(e) => {
          if (!e.node.group && e.data) onRowDoubleClicked?.(e.data as Record<string, unknown>)
        }}
        onColumnRowGroupChanged={(e) => e.api.refreshServerSide({ purge: true })}
        onColumnVisible={(e: ColumnVisibleEvent) => {
          if (e.source === 'gridInitializing') return
          const id = e.column?.getColId()
          if (id && FRONTEND_ONLY_COLUMNS.has(id)) return
          if (colVisTimer.current) clearTimeout(colVisTimer.current)
          colVisTimer.current = setTimeout(() => e.api.refreshServerSide({ purge: true }), 500)
        }}
      />
    </div>
  )
}
```
(Remove the old `autoSizeStrategy` prop. Keep `RowDoubleClickedEvent`/`FirstDataRenderedEvent` type imports as-is.)

- [ ] **Step 4: Run — expect PASS** (`pnpm vitest run src/search/__tests__/SearchGrid.test.tsx`). `pnpm typecheck` + `pnpm exec eslint src/search/SearchGrid.tsx` clean.
- [ ] **Step 5: Commit**

```bash
git add src/search/SearchGrid.tsx src/search/__tests__/SearchGrid.test.tsx
git commit -m "feat(grid): SSRM parity — stable getRowId, visibleColumns, column listeners, grid options"
```

---

### Task 6: `ExportRequestV4` type + `exportSearch.ts` helper

**Files:** Modify `src/search/types.ts`; create `src/search/lib/exportSearch.ts`, `src/search/__tests__/exportSearch.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/search/__tests__/exportSearch.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'

const apiFetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queryClient', () => ({ apiFetch: apiFetchMock, reportRequestFailure: vi.fn() }))

import { exportSearchToExcel } from '@/search/lib/exportSearch'
import type { ExportRequestV4 } from '@/search/types'

describe('exportSearchToExcel', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue({ blob: async () => new Blob(['x'], { type: 'application/octet-stream' }) })
    // jsdom URL object-url shims
    ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:mock')
    ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn()
  })

  test('POSTs the export body to /export/{category} and downloads a blob', async () => {
    const body: ExportRequestV4 = {
      category: 'jobName', initialFilter: { column: 'job_name', values: ['A'] },
      columns: ['job_name', 'box_name'], rowGroupCols: ['job_name'], sortModel: [], filterModel: {},
    }
    const clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ click: clickSpy, setAttribute: vi.fn(), style: {}, href: '', download: '' } as never)

    await exportSearchToExcel('jobName', body)

    const [url, opts] = apiFetchMock.mock.calls[0]
    expect(url).toBe('/rectrace/api/v4/search/export/jobName')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual(body)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

Add to `src/search/types.ts` (near `SSRMRequestV4`/`InitialFilter`; reuse the existing `InitialFilter`/`SortModel` types):
```ts
export interface ExportRequestV4 {
  category: string
  initialFilter: InitialFilter | null
  columns: string[]
  rowGroupCols: string[]
  sortModel: SortModelItem[]
  filterModel: Record<string, unknown>
}
```
(`InitialFilter` and `SortModelItem` are already exported from `types.ts`.)

Create `src/search/lib/exportSearch.ts`:
```ts
import { apiFetch } from '@/lib/queryClient'
import type { ExportRequestV4 } from '@/search/types'

/** Full-dataset Excel export via the backend (Angular parity), not client-side. */
export async function exportSearchToExcel(category: string, body: ExportRequestV4): Promise<void> {
  const res = await apiFetch(`/rectrace/api/v4/search/export/${encodeURIComponent(category)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `${category}_export.xlsx`
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
```

- [ ] **Step 4: Run — expect PASS.** `pnpm typecheck` clean.
- [ ] **Step 5: Commit**

```bash
git add src/search/types.ts src/search/lib/exportSearch.ts src/search/__tests__/exportSearch.test.ts
git commit -m "feat(grid): backend full-dataset Excel export helper + ExportRequestV4 type"
```

---

### Task 7: `SearchGridPanel.onExportExcel` → backend export

**Files:** Modify `src/search/SearchGridPanel.tsx`, `src/search/__tests__/SearchGridPanel.test.tsx`.

- [ ] **Step 1: Update the test.** In `SearchGridPanel.test.tsx`, add `exportSearchToExcel` to mocks and assert the Export menu item calls it with a body built from the api. At top:
```ts
const exportMock = vi.hoisted(() => vi.fn())
vi.mock('@/search/lib/exportSearch', () => ({ exportSearchToExcel: exportMock }))
```
Add `getColumnState`, `getRowGroupColumns`, `getFilterModel` to the existing `mockApi` (some already present — ensure `getRowGroupColumns: vi.fn(() => [])` and `getColumnState: vi.fn(() => [{ colId: 'job_name', hide: false }])`). Then a test:
```ts
  test('Export downloads via the backend export endpoint', async () => {
    exportMock.mockReset().mockResolvedValue(undefined)
    renderPanel()
    const trigger = await screen.findByRole('button', { name: 'Export' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(screen.getByText('Download Excel (.xlsx)'))
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1))
    const [category, body] = exportMock.mock.calls[0]
    expect(category).toBe('jobName')
    expect(body.category).toBe('jobName')
    expect(Array.isArray(body.columns)).toBe(true)
  })
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** In `SearchGridPanel.tsx`:

Imports:
```ts
import { exportSearchToExcel } from '@/search/lib/exportSearch'
import { getVisibleColumnIds, convertFilterModel, buildInitialFilter } from '@/search/lib/ssrm'
import type { ExportRequestV4, SortModelItem } from '@/search/types'
```
Replace `onExportExcel`:
```ts
  const onExportExcel = useCallback(() => {
    const api = apiRef.current
    if (!api || isExporting) return
    setIsExporting(true)
    const colState = api.getColumnState()
    const body: ExportRequestV4 = {
      category: category.key,
      initialFilter: buildInitialFilter(category),
      columns: getVisibleColumnIds(colState, api.getRowGroupColumns().map((c) => c.getColId())),
      rowGroupCols: api.getRowGroupColumns().map((c) => c.getColId()),
      sortModel: colState
        .filter((c) => c.sort)
        .map((c): SortModelItem => ({ colId: c.colId, sort: c.sort as 'asc' | 'desc' })),
      filterModel: convertFilterModel(api.getFilterModel() as Record<string, unknown>),
    }
    exportSearchToExcel(category.key, body)
      .catch((err) => reportRequestFailure(err))
      .finally(() => setIsExporting(false))
  }, [category, isExporting])
```
Remove the old `buildExportFilename` import and any now-unused imports (`reportRequestFailure` stays).

- [ ] **Step 4: Run — expect PASS** (`pnpm vitest run src/search/__tests__/SearchGridPanel.test.tsx`). `pnpm typecheck` + `pnpm exec eslint src/search/SearchGridPanel.tsx` clean.
- [ ] **Step 5: Commit**

```bash
git add src/search/SearchGridPanel.tsx src/search/__tests__/SearchGridPanel.test.tsx
git commit -m "feat(grid): export full dataset via backend /export endpoint"
```

---

### Task 8: live verification + final gate

**Files:** none.

- [ ] **Step 1: Full gate** — `pnpm vitest run` (all green), `pnpm typecheck` (exit 0), `pnpm build` (exit 0), `pnpm exec eslint src/search` (clean).

- [ ] **Step 2: Live (Playwright, `http://localhost:5173/search?q=recon`)** — confirm:
  - **0 new console warnings/errors** (license watermark only); no #200.
  - **Expand All / Collapse All** work (groups expand/collapse + child fetches in Network).
  - **Hide a column** in the Columns panel → a `POST /ssrm/{cat}` fires ~500ms later whose body `visibleColumns` no longer contains that column.
  - **Group-expansion preserved:** expand a group, then hide a column → the group **stays expanded** (getRowId), and its rows reload with the new column set.
  - **Drag a column to the row-group panel** → a purge refetch fires.
  - **Export** → downloads an `.xlsx`; confirm a `POST /export/{cat}` in Network with `columns` populated.
  - **Filter** a column (type in a header filter) → a `POST /ssrm` fires with the converted `filterModel`.
  - Density toggle changes row AND header height. Screenshots (light + dark) for the user.

- [ ] **Step 3:** If a step reveals a v35 mismatch (module name, event prop), fix inline (one change), re-verify, commit:
```bash
git add -A && git commit -m "fix(grid): <specific live-verification fixup>"
```

- [ ] **Step 4:** Report screenshots + the green gate output. Do not claim done without fresh command output.

---

## Notes for the implementer
- **Deliberate divergences (do NOT add):** `rowSelection` (selection stays out), and Angular's `Date.now()+Math.random()` `getRowId` (we use the stable `buildSsrmRowId`).
- The dedup toggle stays Angular-faithful (state + refresh, no backend flag); with real `visibleColumns` the backend now does `SELECT DISTINCT <visible>` on every fetch.
- Use real seed terms for live checks (`recon`, `SUBACC`, `SETID`). Enterprise license watermark in dev is expected.
- Deep grid-body visual styling remains a separate follow-up.
