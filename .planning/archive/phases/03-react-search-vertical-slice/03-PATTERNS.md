# Phase 3: React Search Vertical Slice — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 22 new + 4 modified + 2 deleted
**Analogs found:** 22 / 22 (one with mixed React-Phase-2 + Angular sources)

> **North-star principle (memory-locked):** every grid behavior is driven by `search-config-v4.json` → `/api/v4/search/config`. The renderer registry is the only React-side surface that grows when a new `cellRenderer` string key appears in config. **No hardcoded `columnDefs`. No hardcoded category metadata. No hardcoded renderer maps.** If a planned file would hardcode any of this, it is a regression — flag it.

> **Pattern-port discipline:** Phase 2's React shell already solved `apiFetch` + `reportRequestFailure` + Sonner-mount race + AG-Grid Enterprise license + Vite base/proxy + Tailwind tokens. Phase 3 reuses these *verbatim*. Do not re-invent. The Angular `frontend/rectrace/src/app/` tree is the **behavioral** source of truth — translate idioms, not patterns.

---

## File Classification

### New files in `frontend-react/src/`

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `routes/search.tsx` | route | request-response (URL params → component) | `frontend-react/src/routes/index.tsx` | exact (TanStack Router file-based route — Phase 2 idiom) |
| `search/SearchPage.tsx` | component (orchestrator) | URL → state → fetch → child props | `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` | behavioral-port (Angular `performSearch` + `initializeQueryParamsSubscription` → React `useCallback` + `useEffect`) |
| `search/SearchBar.tsx` | component (input) | keystrokes → debounced state + submit event | `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.html` + lines 125-138 (`initializeSuggestions`) | behavioral-port (300ms debounce; recent-searches Popover replaces Angular MatAutocomplete) |
| `search/SearchToolbar.tsx` | component | grid api → export trigger; row count → badge | (no direct analog) `SearchV5GridComponent.exportToExcel()` lines 471-535 for export shape | partial — toolbar UI is new shadcn composition (Badge + DropdownMenu); export *call* mirrors Angular |
| `search/CategoryTabBar.tsx` | component | active `cat` → tab UI | Angular `mat-tab-group` in `search-v5.component.html` (read structurally) | partial (single tab in Phase 3; pattern only) |
| `search/SearchGrid.tsx` | component (AG-Grid SSRM) | `(q, cat, initialFilter, colDefs)` → SSRM rows | `frontend-react/src/grid/SmokeGrid.tsx` + `search-v5-grid.component.ts` (lines 81-223 setup, 324-394 datasource) | clone-and-react-ify (SmokeGrid SSRM shape verbatim) + behavioral-port (Angular config-driven `ColDef[]` build) |
| `search/renderers/ExecutionOrderCellRenderer.tsx` | component (AG-Grid cell) | row data → button → fetch → Dialog | `frontend/rectrace/src/app/custom-interactions/components/renderers/execution-order-button.component.ts` | behavioral-port (button visibility rule + loading state + error toast all 1:1) |
| `search/renderers/AppIDCellRenderer.tsx` | component (AG-Grid cell) | `params.value` → anchor or span | `frontend/rectrace/src/app/custom-interactions/components/renderers/app-id-cell-renderer.component.ts` | behavioral-port (external link + tooltip + falsy fallback) |
| `search/renderers/SupportEmailCellRenderer.tsx` | component (AG-Grid cell) | `params.value` → mailto or span | `frontend/rectrace/src/app/custom-interactions/components/renderers/app-support-cell-renderer.component.ts` | behavioral-port (mailto link + tooltip + falsy fallback) |
| `search/renderers/registry.ts` | lib (string→component map) | string key → React component type | `search-v5-grid.component.ts` lines 181-190 (`gridOptions.components`) | interface-port (Angular `components` map → React `Record<string, ComponentType<ICellRendererParams>>`) |
| `search/hooks/useSearchConfig.ts` | hook | TanStack Query → Zod-parsed config | `SearchServiceV5.getConfiguration()` `search-v5.service.ts:118` | interface-port (Angular Observable → TanStack Query `staleTime: Infinity`) |
| `search/hooks/useSearchState.ts` | hook | URL ↔ `{q, cat}` | `initializeQueryParamsSubscription` `search-v5.component.ts:140-150` + `updateUrlWithState` lines 240-256 | behavioral-port (Angular `router.navigate({queryParams})` → TanStack Router `useSearch` + `useNavigate`) |
| `search/hooks/useRecentSearches.ts` | hook | localStorage ↔ string[] | (no existing analog — Angular search-v5 has NO recent-searches; it uses rotating placeholder + suggest API) | research-derived (RESEARCH.md §6, lines 594-636); new pattern |
| `search/lib/configToColDefs.ts` | lib (adapter) | `CategoryConfigV4` → `ColDef[]` | `search-v5-grid.component.ts` lines 83-106 (`this.columns.map(col => ({...}))`) | interface-port (1:1 mapping table with renderer-registry resolution + kebab→camel `cellStyle` adapter) |
| `search/types.ts` | type (Zod schemas) | runtime parse + TS inference | `frontend/rectrace/src/app/services/search-v5.service.ts` lines 6-92 (DTO interfaces) | interface-port (TypeScript `interface` → Zod schema + `z.infer`) |
| `search/__tests__/configToColDefs.test.ts` | test | adapter unit | `frontend-react/src/lib/queryClient.test.ts` | exact (Vitest idiom from Phase 2) |
| `search/__tests__/useRecentSearches.test.ts` | test | hook unit | `frontend-react/src/components/layout/theme-provider.test.tsx` | role-match (localStorage-backed hook test idiom) |
| `search/__tests__/useSearchState.test.ts` | test | hook unit | `frontend-react/src/components/layout/theme-provider.test.tsx` | role-match |
| `search/__tests__/ExecutionOrderCellRenderer.test.tsx` | test | renderer unit + mocked `apiFetch` | `frontend-react/src/lib/queryClient.test.ts` (mock fetch pattern) + `SmokeGrid.test.tsx` (RTL render idiom) | partial (combines both Phase 2 test patterns) |
| `search/__tests__/AppIDCellRenderer.test.tsx` | test | renderer unit | same as above | partial |
| `search/__tests__/SupportEmailCellRenderer.test.tsx` | test | renderer unit | same as above | partial |
| `components/ui/{input,badge,separator,command,popover,tooltip,dropdown-menu,skeleton}.tsx` | component (vendored shadcn) | shadcn registry → file | `frontend-react/src/components/ui/{button,card,sonner}.tsx` (Phase 2 vendored) | exact (same `pnpm dlx shadcn@3.8.5 add` flow) |

### Modified files

| File | Role | Change | Closest Analog | Notes |
|------|------|--------|----------------|-------|
| `frontend-react/src/routes/index.tsx` | route | replace IndexPage body with `redirect({ to: '/search' })` | RESEARCH.md §8 sketch (lines 671-679) | Strip the SmokeGrid header layout (now lives inside `SearchPage`); use TanStack Router `beforeLoad` redirect idiom |
| `frontend-react/src/main.tsx` | bootstrap | register `ExcelExportModule`, `ColumnsToolPanelModule`, `FiltersToolPanelModule` alongside existing `ServerSideRowModelModule` | `frontend-react/src/main.tsx` lines 4-13 (current registration) | Add modules to the existing `ModuleRegistry.registerModules([...])` call — keep `LicenseManager.setLicenseKey` first (load-bearing order per comment) |
| `frontend-react/src/routeTree.gen.ts` | generated | auto-regenerated by TanStack Router Vite plugin after adding `routes/search.tsx` | (generated file) | Do not hand-edit; rely on `pnpm dev`/`pnpm build` regen |
| `scripts/smoke-ssrm.sh` | script | extend with `/api/v4/search/config` shape assertion + GET `/search` route + two-step `/initial` → SSRM body verification | RESEARCH.md "Wave 0 Gaps" line 142 | Additive (single ops surface per Phase 2 D-2.16) |
| `.planning/parity-matrix.md` | doc | flip File Name tab, AppID/SupportEmail/ExecutionOrder renderers, Excel export, Recent searches to `port` | (parity matrix update pattern from Phase 2 close) | UI-SPEC §"Parity Matrix Updates" lines 588-595 |

### Deleted files

| File | Reason |
|------|--------|
| `frontend-react/src/grid/SmokeGrid.tsx` | Subsumed by `search/SearchGrid.tsx` (config-driven, real datasource); D-3.x explicit |
| `frontend-react/src/grid/SmokeGrid.test.tsx` | Companion test for deleted component |

---

## Pattern Assignments

### `routes/search.tsx` (route, request-response)

**Analog:** `frontend-react/src/routes/index.tsx` (Phase 2 TanStack Router file-based route)

**Imports pattern** (lines 1-4):
```ts
import { createFileRoute } from '@tanstack/react-router'
// Plus, for Phase 3:
import { z } from 'zod'
import { SearchPage } from '@/search/SearchPage'
```

**Route definition pattern** (lines 6-8):
```ts
export const Route = createFileRoute('/')({
  component: IndexPage,
})
```

**Phase 3 extends with `validateSearch` (RESEARCH.md §4, lines 491-505):**
```ts
const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional().default('fileName'),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchSchema,  // Zod validates incoming URL params
  component: SearchPage,
})
```

---

### `routes/index.tsx` (modified — redirect)

**Analog:** `frontend-react/src/routes/index.tsx` (current state) + RESEARCH.md §8 sketch.

**Replacement pattern** (RESEARCH.md lines 674-679):
```ts
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({ to: '/search' }) },
})
```

The current `IndexPage` (header + SmokeGrid + Footer) is **deleted entirely** — the header/footer layout migrates into `SearchPage.tsx` (or a wrapping `__search.tsx` pathless route if planner prefers; both acceptable).

---

### `search/SearchPage.tsx` (component, orchestrator)

**Analog:** `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` lines 100-330.

**Angular ngOnInit → React mount + effect** (Angular lines 104-112):
```ts
ngOnInit(): void {
  this.initializeUser();
  this.initializeQueryParamsSubscription();
  this.initializeSuggestions();
  this.initializeTheme();
}
```

In React: `useSearchConfig()` runs on mount via TanStack Query; `useEffect([q, cat])` handles URL-restore (RESEARCH.md §4, lines 516-522).

**Angular `performSearch` → React `handleSubmit`** (Angular lines 258-330):
```ts
performSearch(isDeepLink: boolean = false): void {
  if (!this.searchTerm || !this.searchTerm.trim()) { /* validate */ return; }
  this.errorMessage = '';
  this.isLoading = true;
  // ...
  this.updateUrlWithState(this.searchTerm.trim(), tabToPreserve);  // URL FIRST
  this.searchService.performInitialSearch(this.searchTerm.trim())
    .pipe(takeUntil(this.destroy$))
    .subscribe({ next: (response) => { /* setInitialFilter */ } });
}
```

**React port pattern (RESEARCH.md §2, lines 302-318):**
```ts
const handleSubmit = useCallback(async (term: string) => {
  if (!term.trim()) return
  await navigate({ search: { q: term, cat: 'fileName' } })   // URL first (D-3.2)
  setIsInitialLoading(true)
  try {
    const res = await apiFetch(`/rectrace/api/v4/search/initial?keyword=${encodeURIComponent(term)}`)
    const data = await res.json() as InitialSearchResponseV4
    setInitialFilter(data)
    pushRecent(term)
  } catch (err) {
    reportRequestFailure(err)
  } finally {
    setIsInitialLoading(false)
  }
}, [navigate, pushRecent])
```

**URL update pattern — Angular `updateUrlWithState` (lines 240-256):**
```ts
this.router.navigate([], {
  relativeTo: this.route,
  queryParams: params,
  replaceUrl: true
});
```

→ React: `navigate({ search: { q, cat }, replace: true })` via TanStack Router `useNavigate()` from the route.

**URL-restore pattern — Angular `initializeQueryParamsSubscription` (lines 140-150):**
```ts
this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
  const queryFromUrl = params['q'];
  if (queryFromUrl && !this.hasSearched) {
    this.searchTerm = queryFromUrl;
    this.performSearch(true);
  }
});
```

→ React `useEffect` keyed on `[q, cat]` (D-3.2; Claude's-discretion-allowed to refine to debounced or guarded variant).

**Layout shell pattern** — borrow from current `routes/index.tsx` lines 11-27 (sticky header + ThemeSwitch + Footer); fill the `flex-1` slot with `<SearchBar />`; insert `<CategoryTabBar />` + `<SearchToolbar />` + `<SearchGrid />` in `<main>` per UI-SPEC App Shell layout.

---

### `search/SearchBar.tsx` (component, input)

**Analog (behavioral):** `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` lines 125-138 (`initializeSuggestions`) + lines 206-218 (`onSearchFocus`/`onSearchIconClick`).

**Debounce pattern** (Angular lines 125-138):
```ts
private initializeSuggestions(): void {
  this.suggestions$ = this.searchInput$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => { /* ... */ })
  );
}
```

→ React: a local `useEffect` or `useDeferredValue` with a 300ms timer; **Phase 3 does NOT call `/suggest`** (deferred). The 300ms gate exists only so the Popover open state doesn't thrash on every keystroke.

**Recent-searches Popover pattern (UI-SPEC §"Recent Searches Popover", lines 357-385):**

shadcn composition (no Angular analog — see `useRecentSearches` below for the hook backing it):
```tsx
<Popover open={isOpen}>
  <PopoverTrigger asChild>
    <Input value={value} onChange={...} onFocus={...} placeholder="Search by file name..." />
  </PopoverTrigger>
  <PopoverContent className="w-[--radix-popover-trigger-width]">
    <Command>
      {/* Recent label + items via useRecentSearches().recents.map(...) */}
    </Command>
  </PopoverContent>
</Popover>
```

**Clear button pattern (UI-SPEC):** inline `Button size="icon-sm" variant="ghost"` with `XIcon` from lucide.

**Submit pattern:** Enter key on input OR click on the search button → calls `props.onSubmit(term)`. SearchPage owns `handleSubmit`.

---

### `search/SearchGrid.tsx` (component, AG-Grid SSRM — THE LOAD-BEARING FILE)

**Primary analog:** `frontend-react/src/grid/SmokeGrid.tsx` (Phase 2 — SSRM shape verbatim).

**SSRM datasource pattern from SmokeGrid (lines 19-62):**
```tsx
const datasource = useMemo<IServerSideDatasource>(() => {
  const controller = new AbortController()
  return {
    getRows: async (params) => {
      try {
        const body = {
          category: 'fileName',
          initialFilter: null,
          rowGroupCols: [],
          groupKeys: [],
          sortModel: params.request.sortModel ?? [],
          filterModel: params.request.filterModel ?? {},
          startRow: params.request.startRow,
          endRow: params.request.endRow,
          visibleColumns: [],
        }
        const res = await apiFetch('/rectrace/api/v4/search/ssrm/fileName', {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const data = await res.json() as { rows: Record<string, unknown>[]; lastRow: number }
        params.success({ rowData: data.rows, rowCount: data.lastRow })
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          // The deferral via setTimeout(0) prevents a Sonner 2.x race: AG-Grid's
          // initial getRows fires inside the same commit/effect cascade as the
          // Toaster's own mount, and Sonner silently drops toasts dispatched
          // before its subscriber attaches. Pushing this to the next macrotask
          // guarantees the Toaster is live when toast.error() runs.
          setTimeout(() => reportRequestFailure(err), 0)  // D-3.6 — DO NOT REMOVE
          params.fail()
        }
      }
    },
    destroy: () => controller.abort(),
  }
}, [])
```

**Phase 3 deltas (RESEARCH.md §2, lines 326-360):**
1. `useMemo` dep array becomes `[q, cat, initialFilter]` (not `[]`) so the datasource rebuilds on new search.
2. POST body includes real `category: cat`, real `initialFilter: { column, values }` from `initialFilter.categoryResults[cat]`, real `visibleColumns` from grid state, real `rowGroupCols: params.request.rowGroupCols.map(c => c.field)`.
3. `<AgGridReact key={`${q}-${cat}`} ... />` — D-3.5 remount-on-new-search.
4. `columnDefs` comes from `configCategoryToColDefs(useSearchConfig().data.categories.find(c => c.key === cat))` — never hardcoded (D-3.3).
5. `components={cellRenderers}` from the renderer registry (D-3.3 example).
6. `sideBar={{ toolPanels: ['columns', 'filters'] }}` (UI-SPEC).
7. `setTimeout(0)` workaround **carries over verbatim** (D-3.6).

**Angular grid setup pattern (for `gridOptions` shape parity)** — `search-v5-grid.component.ts` lines 81-223:

```ts
setupGridOptions(): void {
  const columnDefs: ColDef[] = this.columns.map(col => ({
    field: col.field,
    headerName: col.headerName,
    rowGroup: col.rowGroup || false,
    hide: col.hide || false,
    sortable: col.sortable !== false,
    filter: col.filter !== false ? 'agTextColumnFilter' : false,
    resizable: col.resizable !== false,
    width: col.width,
    cellRenderer: col.cellRenderer,
    cellRendererParams: col.cellRendererParams,
    cellStyle: col.cellStyle,
    pinned: col.pinned as any,
  }));

  this.gridOptions = {
    columnDefs,
    defaultColDef: { sortable: true, filter: true, resizable: true, minWidth: 100, flex: 1 },
    rowModelType: 'serverSide',
    cacheBlockSize: 100,
    maxBlocksInCache: 10,
    sideBar: { toolPanels: ['columns', 'filters'] /* ... */ },
    components: {
      appIDCellRenderer: AppIDCellRendererComponent,
      supportEmailCellRenderer: AppSupportCellRendererComponent,
      executionOrderButtonRenderer: ExecutionOrderButtonComponent,
      // ... future renderers
    },
    // ...
  };
}
```

> **🚨 Anti-pattern flag (do NOT port):** Angular `getRowId` (lines 196-222) uses `Date.now() + Math.random()` — this is a known anti-pattern that breaks SSRM cache identity. **For React:** if `getRowId` is needed at all, derive it from a stable composite of row fields (e.g., `${data.recon}|${data.load_job}|${data.file_name_pattern}`). The researcher flagged this in CONTEXT.md `<code_context>` and RESEARCH.md. If Phase 3 doesn't need explicit row IDs (SSRM works without one), omit `getRowId` entirely — that is the safest default.

**Angular datasource pattern (for SSRM body shape parity)** — `search-v5-grid.component.ts` lines 324-394:
```ts
const request: SSRMRequestV4 = {
  category: this.category,
  initialFilter: {
    column: searchColumnField,
    values: this.initialFilter  // Max 1000 values from ES
  },
  rowGroupCols: params.request.rowGroupCols?.map(col => col.field || col as any) || [],
  groupKeys: params.request.groupKeys || [],
  startRow: params.request.startRow || 0,
  endRow: params.request.endRow || 100,
  sortModel: params.request.sortModel || [],
  filterModel: filterModel,
  visibleColumns: this.getVisibleColumns()
};
```

The React `getRows` body must match this shape (D-3.8 + RESEARCH.md §2).

---

### `search/renderers/ExecutionOrderCellRenderer.tsx` (component, AG-Grid cell)

**Analog:** `frontend/rectrace/src/app/custom-interactions/components/renderers/execution-order-button.component.ts` (entire file, lines 1-209).

**`jobName` resolution pattern** (Angular lines 148-166):
```ts
agInit(params: ExecutionOrderButtonParams): void {
  this.params = params;
  this.setJobNameFromData();
}

private setJobNameFromData(): void {
  const jobNameField = this.params.colDef?.cellRendererParams.jobNameField || 'load_job';
  const potentialJobName = this.params.data ? this.params.data[jobNameField] : null;
  if (potentialJobName && typeof potentialJobName === 'string' && potentialJobName.trim().length > 0) {
    this.jobName = potentialJobName;
  }
}
```

**`@if (jobName)` template guard → React early-return:**
```tsx
if (!jobName || jobName.trim().length === 0) return null
```

**Click handler pattern** (Angular lines 168-199):
```ts
showExecutionOrder(): void {
  const jobName = this.params.data.load_job;
  if (!jobName) { this.showError('Job name is undefined'); return; }
  this.isLoading = true;
  this.executionOrderService.getExecutionOrder(jobName).subscribe(
    (data) => {
      this.isLoading = false;
      this.dialog.open(ExecutionOrderModalComponent, { width: '90vw', /* ... */ });
    },
    (error) => {
      this.isLoading = false;
      this.showError('Failed to load execution order');
    }
  );
}
```

**React port** (RESEARCH.md lines 396-446):
```tsx
export function ExecutionOrderCellRenderer(params: ExecutionOrderParams) {
  const jobNameField = params.colDef?.cellRendererParams?.jobNameField ?? 'load_job'
  const jobName = params.data?.[jobNameField] as string | undefined
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [open, setOpen] = useState(false)

  if (!jobName || jobName.trim().length === 0) return null

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch(`/rectrace/api/execution-order/${encodeURIComponent(jobName)}`)
      const json = await res.json()
      setData(json)
      setOpen(true)
    } catch (err) {
      reportRequestFailure(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={handleClick} disabled={isLoading}
              className="h-6 min-w-[80px] px-2 text-primary text-[12px] font-normal hover:bg-accent">
        {isLoading
          ? <Loader2Icon className="size-3.5 animate-spin" />
          : <span className="inline-flex items-center gap-1"><GitBranchIcon className="size-3.5 opacity-70" />View</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Execution Order — {jobName}</DialogTitle></DialogHeader>
          {/* TODO(Phase 4): replace with ExecutionOrderModal (Cytoscape) */}
          <pre className="text-xs font-mono overflow-auto max-h-[60vh]">{JSON.stringify(data, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Visual measurements** — UI-SPEC §"ExecutionOrderCellRenderer" `Visual spec` table (lines 309-326): h-6 (24px), min-w-[80px], px-2 (8px), text-primary, GitBranchIcon at size-3.5 (14px). Angular source uses `padding: 0 10px` — React snaps to `px-2` per UI-SPEC (Phase 2 ESLint hex-rejection precedent; 4-multiple grid).

**Icon swap:** Angular uses Material Icon `account_tree`; React uses lucide `GitBranchIcon` (UI-SPEC explicit choice).

**Color mapping:** Angular `color: var(--google-blue, #1a73e8)` → React `text-primary` (Phase 2 D-2.8 ESLint forbids raw hex; UI-SPEC color section line 156-158 confirms the mapping).

---

### `search/renderers/AppIDCellRenderer.tsx` (component, AG-Grid cell)

**Analog:** `frontend/rectrace/src/app/custom-interactions/components/renderers/app-id-cell-renderer.component.ts` (entire file, lines 1-55).

**Behavior pattern** (Angular lines 7-18 template):
```html
@if (appId) {
<a [href]="getFileUrl()" target="_blank" class="file-link" [matTooltip]="getTooltipText()">
  {{ appId }}
</a>
} @else {
<span>{{ appId }}</span>
}
```

`getFileUrl()` returns `"https://lnkd.in/gpAtSBRj"` (hardcoded).
`getTooltipText()` returns `` `View details of ${this.appName}` `` where `appName = params.data?.app_name || ""`.

**React port** (RESEARCH.md lines 449-466):
```tsx
export function AppIDCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined
  const appName = (params.data?.app_name as string | undefined) ?? ''
  if (!value) return <span>{value}</span>
  return (
    <a href="https://lnkd.in/gpAtSBRj" target="_blank" rel="noopener noreferrer"
       title={`View details of ${appName}`}
       className="text-primary underline hover:no-underline">
      {value}
    </a>
  )
}
```

**Tooltip simplification:** UI-SPEC uses the native `title` attribute (not shadcn `<Tooltip>`) for AppID — explicit choice (UI-SPEC §"AppIDCellRenderer" lines 339-344).

**Falsy-fallback exact parity:** Angular falsy branch renders `<span>{{ appId }}</span>` (empty span). React does `<span>{value}</span>` — same.

---

### `search/renderers/SupportEmailCellRenderer.tsx` (component, AG-Grid cell)

**Analog:** `frontend/rectrace/src/app/custom-interactions/components/renderers/app-support-cell-renderer.component.ts` (entire file, lines 1-52).

**Behavior pattern** (Angular lines 7-19 template):
```html
@if (supportEmail) {
<a [href]="'mailto:' + supportEmail" target="_blank" class="file-link" [matTooltip]="getTooltipText()">
  {{ supportEmail }}
</a>
} @else {
<span>{{ supportEmail }}</span>
}
```

`getTooltipText()` returns `` `Send email to ${this.appName}` ``.

**React port** (RESEARCH.md lines 470-483):
```tsx
export function SupportEmailCellRenderer(params: ICellRendererParams) {
  const value = params.value as string | undefined
  if (!value) return <span>{value}</span>
  return (
    <a href={`mailto:${value}`}
       title={`Send email to ${(params.data?.app_name as string | undefined) ?? ''}`}
       className="text-primary underline hover:no-underline">
      {value}
    </a>
  )
}
```

> The Angular template includes `target="_blank"` on a `mailto:` anchor — harmless and matched in the React port for behavioral parity. `rel="noopener noreferrer"` is omitted since `mailto:` doesn't open a new window context.

---

### `search/renderers/registry.ts` (lib, string→component map)

**Analog:** `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` lines 181-190.

**Angular pattern:**
```ts
components: {
  appIDCellRenderer: AppIDCellRendererComponent,
  supportEmailCellRenderer: AppSupportCellRendererComponent,
  executionOrderButtonRenderer: ExecutionOrderButtonComponent,
  // ... Phase 4+ entries:
  setIdV2Renderer: SetIdV2RendererComponent,
  reconV2Renderer: ReconV2RendererComponent,
  tlmInstanceV2Renderer: TlmInstanceV2RendererComponent,
  reconIdRenderer: ReconIdRendererComponent,
  recPortalIdRenderer: RecPortalIdRendererComponent
},
```

**React port** (CONTEXT.md D-3.3 + RESEARCH.md §1 lines 241-253):
```ts
import type { ComponentType } from 'react'
import type { ICellRendererParams } from 'ag-grid-community'
import { AppIDCellRenderer } from './AppIDCellRenderer'
import { SupportEmailCellRenderer } from './SupportEmailCellRenderer'
import { ExecutionOrderCellRenderer } from './ExecutionOrderCellRenderer'

export const cellRenderers: Record<string, ComponentType<ICellRendererParams>> = {
  appIDCellRenderer: AppIDCellRenderer,
  supportEmailCellRenderer: SupportEmailCellRenderer,
  executionOrderButtonRenderer: ExecutionOrderCellRenderer,
}
```

> **Adding a column that reuses an existing renderer → JSON-only edit.** Adding a column with a NEW renderer → JSON edit + one new file + one line in this registry. This is the entire React-side surface of the config-driven principle.

---

### `search/hooks/useSearchConfig.ts` (hook, TanStack Query)

**Analog:** `frontend/rectrace/src/app/services/search-v5.service.ts:118-122` (`getConfiguration`).

**Angular pattern:**
```ts
getConfiguration(): Observable<SearchConfigurationV4> {
  return this.http.get<SearchConfigurationV4>(`${this.apiUrl}/config`, {
    headers: this.getHeaders()
  });
}
```

**React port** (RESEARCH.md §1 lines 193-210):
```ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/queryClient'
import { SearchConfigurationV4Schema, type SearchConfigurationV4 } from '../types'

export function useSearchConfig() {
  return useQuery<SearchConfigurationV4>({
    queryKey: ['search-config'],
    queryFn: async () => {
      const res = await apiFetch('/rectrace/api/v4/search/config')
      const json = await res.json()
      return SearchConfigurationV4Schema.parse(json)  // Zod-validated
    },
    staleTime: Infinity,  // SearchConfigServiceV4 @PostConstruct — only changes on restart
    gcTime: Infinity,
  })
}
```

**Why `staleTime: Infinity`:** `SearchConfigServiceV4.java` parses `search-config-v4.json` at `@PostConstruct` and holds the result in memory. Config can only change on backend restart. Verified — see CONTEXT.md `<canonical_refs>` "Backend integration surface".

**Error path:** TanStack Query's `QueryCache.onError` is wired in `queryClient.ts:53` to `reportRequestFailure` — config-fetch failures auto-surface a Sonner toast. No catch block needed in the hook.

---

### `search/hooks/useSearchState.ts` (hook, URL↔state)

**Analog:** `frontend/rectrace/src/app/search-v5/components/search-v5/search-v5.component.ts` lines 140-150 (read) + 240-256 (write).

**Angular read pattern (`initializeQueryParamsSubscription`):**
```ts
this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
  const queryFromUrl = params['q'];
  if (queryFromUrl && !this.hasSearched) {
    this.searchTerm = queryFromUrl;
    this.performSearch(true);
  }
});
```

**Angular write pattern (`updateUrlWithState`):**
```ts
private updateUrlWithState(query?: string, tabKey?: string): void {
  const params: any = {};
  if (query) params.q = query;
  if (tabKey) params.tab = tabKey;
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: params,
    replaceUrl: true
  });
}
```

**React port pattern** (thin wrapper — RESEARCH.md §4):
```ts
import { useSearch, useNavigate } from '@tanstack/react-router'

export function useSearchState() {
  const { q, cat } = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  const setQ = (next: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true })
  const setCat = (next: string) =>
    navigate({ search: (prev) => ({ ...prev, cat: next }), replace: true })
  const clear = () =>
    navigate({ search: {}, replace: true })

  return { q, cat: cat ?? 'fileName', setQ, setCat, clear }
}
```

Zod validation lives on the route (`validateSearch`), not in the hook — TanStack Router guarantees typed/validated values at `useSearch`.

---

### `search/hooks/useRecentSearches.ts` (hook, localStorage)

**Analog:** RESEARCH.md §6 lines 596-633 (no Angular analog — search-v5 has no recent-searches feature; CONTEXT.md `<code_context>` mentions Phase 2 already wrote `rectrace-theme` for `ThemeProvider`, which is a similar localStorage pattern).

**Similar Phase 2 pattern (theme persistence)** — `frontend-react/src/components/layout/theme-provider.tsx` (read structurally for localStorage idiom — JSON.parse in try/catch, defensive read).

**Phase 3 hook (RESEARCH.md §6):**
```ts
const KEY = 'rectrace-recent-searches'  // D-3.11
const MAX = 10

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>(read)

  const push = useCallback((term: string) => {
    if (!term.trim()) return
    setRecents(prev => {
      const filtered = prev.filter(t => t !== term)  // case-sensitive dedupe (D-3.11)
      const next = [term, ...filtered].slice(0, MAX)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* swallow */ }
    setRecents([])
  }, [])

  return { recents, push, clear }
}
```

**Test targets (D-3.9):** prepend, dedupe (case-sensitive), 10-cap, malformed-JSON resilience, quota-exceeded resilience.

---

### `search/lib/configToColDefs.ts` (lib, adapter)

**Analog:** `frontend/rectrace/src/app/search-v5/components/search-v5-grid/search-v5-grid.component.ts` lines 81-106 (`setupGridOptions` `columns.map(col => ({...}))`).

**Angular adapter** (lines 83-106):
```ts
const columnDefs: ColDef[] = this.columns.map(col => ({
  field: col.field,
  headerName: col.headerName,
  rowGroup: col.rowGroup || false,
  hide: col.hide || false,
  enableRowGroup: true,
  sortable: col.sortable !== false,
  filter: col.filter !== false ? 'agTextColumnFilter' : false,
  filterParams: { /* ... */ },
  resizable: col.resizable !== false,
  width: col.width,
  cellRenderer: col.cellRenderer,
  cellRendererParams: col.cellRendererParams,
  cellStyle: col.cellStyle,
  pinned: col.pinned as any,
  // ...
}));
```

**React port** (RESEARCH.md §1 lines 215-235):
```ts
import type { ColDef } from 'ag-grid-community'
import type { CategoryConfigV4, ColumnDefinitionV4 } from '../types'
import { cellRenderers } from '../renderers/registry'

export function configCategoryToColDefs(cat: CategoryConfigV4): ColDef[] {
  return cat.columns.map((c: ColumnDefinitionV4): ColDef => ({
    field: c.field,
    headerName: c.headerName,
    width: c.width,
    hide: c.hide ?? false,
    sortable: c.sortable ?? true,
    filter: c.filter !== false ? 'agTextColumnFilter' : false,
    resizable: c.resizable ?? true,
    rowGroup: c.rowGroup ?? false,
    pinned: c.pinned as ColDef['pinned'],
    cellRenderer: c.cellRenderer && cellRenderers[c.cellRenderer]
      ? cellRenderers[c.cellRenderer]
      : undefined,
    cellRendererParams: c.cellRendererParams,
    cellStyle: c.cellStyle ? toCamelCaseStyle(c.cellStyle) : undefined,
  }))
}
```

**🚨 `cellStyle` kebab-case → camelCase adapter (CRITICAL):**

The JSON config (`search-config-v4.json` line 34) uses CSS-property kebab-case keys:
```json
"cellStyle": {"display": "flex", "align-items": "center", "justify-content": "center", "padding": "0", "height": "100%"}
```

AG-Grid's `cellStyle` is a React-style object (camelCase keys). The adapter MUST convert:
```ts
function toCamelCaseStyle(style: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(style)) {
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  }
  return out
}
```

Test target (D-3.9): `configToColDefs.test.ts` must verify:
- `align-items` → `alignItems`
- `justify-content` → `justifyContent`
- existing camelCase keys pass through unchanged
- string renderer keys resolve to React components via the registry
- unknown renderer string → `undefined` (graceful fallback, not crash)
- Zod parse of the `fileName` category JSON shape passes

---

### `search/types.ts` (Zod schemas + inferred types)

**Analog:** `frontend/rectrace/src/app/services/search-v5.service.ts` lines 6-92 (TypeScript interfaces that mirror backend DTOs).

**Angular interface pattern (lines 22-35):**
```ts
export interface ColumnDefinition {
  field: string;
  headerName: string;
  rowGroup?: boolean;
  hide?: boolean;
  sortable?: boolean;
  filter?: boolean;
  resizable?: boolean;
  width?: number;
  cellRenderer?: string;
  cellRendererParams?: any;
  cellStyle?: any;
  pinned?: string;
}
```

**React Zod port** (RESEARCH.md §1 lines 263-293):
```ts
import { z } from 'zod'

export const ColumnDefinitionV4Schema = z.object({
  field: z.string(),
  headerName: z.string(),
  rowGroup: z.boolean().optional(),
  hide: z.boolean().optional(),
  sortable: z.boolean().optional(),
  filter: z.boolean().optional(),
  resizable: z.boolean().optional(),
  width: z.number().optional(),
  cellRenderer: z.string().optional(),
  cellRendererParams: z.record(z.unknown()).optional(),
  cellStyle: z.record(z.string()).optional(),
  pinned: z.enum(['left', 'right']).nullable().optional(),
})

export const CategoryConfigV4Schema = z.object({
  key: z.string(),
  label: z.string(),
  searchColumn: z.string(),
  elasticsearch: z.record(z.unknown()),
  oracle: z.record(z.unknown()),
  columns: z.array(ColumnDefinitionV4Schema),
})

export const SearchConfigurationV4Schema = z.object({
  categories: z.array(CategoryConfigV4Schema),
})

export type SearchConfigurationV4 = z.infer<typeof SearchConfigurationV4Schema>
export type CategoryConfigV4 = z.infer<typeof CategoryConfigV4Schema>
export type ColumnDefinitionV4 = z.infer<typeof ColumnDefinitionV4Schema>
```

**Also needed (mirror `SSRMRequestV4`, `InitialFilter`, `SortModel`, `FilterModel`, `CategoryResultV4`, `InitialSearchResponseV4`):** see lines 37-92 of `search-v5.service.ts` for the exact field shapes. Zod schemas one-to-one.

---

### Test files (Vitest)

**Vitest idiom analog:** `frontend-react/src/lib/queryClient.test.ts` (mock-fetch pattern) + `frontend-react/src/grid/SmokeGrid.test.tsx` (RTL render-without-throw pattern).

**Mock-fetch pattern (queryClient.test.ts lines 7-15):**
```ts
test('attaches X-Correlation-Id header to request', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal('fetch', mockFetch)
  await apiFetch('/rectrace/api/v4/search/ssrm/fileName', { method: 'POST', body: '{}' })
  const [, init] = mockFetch.mock.calls[0]
  expect((init as RequestInit).headers).toHaveProperty('X-Correlation-Id')
})
```

**RTL render pattern (SmokeGrid.test.tsx lines 1-17):**
```ts
import { render } from '@testing-library/react'
import { SmokeGrid } from './SmokeGrid'
import { describe, test } from 'vitest'

describe('SmokeGrid', () => {
  test('renders without crashing', () => {
    try { render(<SmokeGrid />) } catch (_e) { /* jsdom canvas */ }
  })
})
```

**Use these idioms for:**
- `configToColDefs.test.ts` — direct adapter calls; no DOM; test Zod parse + camelCase conversion + registry resolution
- `useRecentSearches.test.ts` — `renderHook` from `@testing-library/react`; mock `localStorage` via `vi.stubGlobal` or per-test setup; assert prepend/dedupe/cap
- `useSearchState.test.ts` — wrap in a TanStack Router test harness (`createMemoryHistory` + `createRouter`); assert URL-write + URL-read round-trip
- `ExecutionOrderCellRenderer.test.tsx` — `render` with a fake `ICellRendererParams`; mock `apiFetch`; click button; assert `setIsLoading` flow + Dialog open + falsy-empty-jobName guard
- `AppIDCellRenderer.test.tsx` / `SupportEmailCellRenderer.test.tsx` — `render` with `params.value` set vs unset; assert anchor vs span; assert `title` attribute interpolation

---

### `main.tsx` (modified — register AG-Grid modules)

**Analog:** `frontend-react/src/main.tsx` (current state, lines 1-21).

**Current pattern (lines 4-13):**
```tsx
import { LicenseManager } from 'ag-grid-enterprise'
import { ModuleRegistry } from 'ag-grid-community'
import { ServerSideRowModelModule } from 'ag-grid-enterprise'
import './index.css'
import App from './App'

// License MUST be set before any ModuleRegistry.registerModules() call (AG-Grid requirement)
LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')

// Register only the modules Phase 2 uses — no chart modules
ModuleRegistry.registerModules([ServerSideRowModelModule])
```

**Phase 3 delta (RESEARCH.md §5 lines 549-565):**
```tsx
import {
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
} from 'ag-grid-enterprise'

LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')

ModuleRegistry.registerModules([
  ServerSideRowModelModule,
  ExcelExportModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
])
```

**Load-bearing order preserved:** `LicenseManager.setLicenseKey` BEFORE `ModuleRegistry.registerModules` (per the existing comment — AG-Grid requirement).

---

### `SearchToolbar.tsx` (component, export trigger)

**Excel export call analog:** `search-v5-grid.component.ts` lines 471-535 (`exportToExcel`).

**Angular export pattern (lines 526-535):**
```ts
this.searchServiceV5.exportData(this.category, request).subscribe({
  next: (blob) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    // ... trigger download
  }
});
```

> **Divergence (D-3.10):** Angular uses **backend** `/api/v4/search/export/{category}`. React Phase 3 uses **client-side** `gridApi.exportDataAsExcel()`. CONTEXT.md/RESEARCH.md acknowledge SSRM cached-rows-only limitation; backend export deferred to Phase 4+.

**React port (RESEARCH.md §5 lines 572-583):**
```ts
function buildExportFilename(category: string, term: string): string {
  const safeTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const ymd = new Date().toISOString().slice(0,10).replace(/-/g,'')
  return `rectrace-${category}-${safeTerm}-${ymd}.xlsx`
}

// In the dropdown item onClick:
gridApi.exportDataAsExcel({
  fileName: buildExportFilename('fileName', q),
  columnKeys: allFieldsExcept('execution_order'),  // include hidden app_name, set_id, sub_acc
})
```

**Toolbar UI composition** — UI-SPEC §"Toolbar" lines 388-398:
- Left cluster: `<Badge variant="secondary">{count.toLocaleString()} results</Badge>` (hidden when not yet searched)
- Right cluster: `<DropdownMenu>` with trigger `<Button size="sm" variant="outline">Export</Button>` + `<DropdownMenuItem>Download Excel (.xlsx)</DropdownMenuItem>`
- Loading: replace icon with `Loader2Icon animate-spin`; set `disabled` during export

---

## Shared Patterns (cross-cutting — applied to multiple new files)

### Auth / Identity

**Source:** Phase 2 — none in `frontend-react/`. Phase 3 does NOT propagate `x-citiportal-loginid` (deferred to Phase 9 SEC-01 per CONTEXT.md).

**Apply to:** No new files. `apiFetch` does NOT send `x-citiportal-loginid` and Phase 3 does not change that.

### Error Handling (universal fetch path)

**Source:** `frontend-react/src/lib/queryClient.ts` (Phase 2 — do NOT modify in Phase 3).

**Apply to:** every fetch in `useSearchConfig`, `SearchPage.handleSubmit`, `SearchGrid` SSRM `getRows`, `ExecutionOrderCellRenderer.handleClick`, `SearchToolbar` Excel export.

**Pattern (from `queryClient.ts:6-30`):**
```ts
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const correlationId = crypto.randomUUID().replace(/-/g, '')
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
        'X-Correlation-Id': correlationId,
      },
    })
    if (!res.ok) {
      throw Object.assign(new Error(`HTTP ${res.status} ${path}`), { correlationId })
    }
    return res
  } catch (err) {
    if (err && typeof err === 'object' && !(err as { correlationId?: string }).correlationId) {
      ;(err as { correlationId?: string }).correlationId = correlationId
    }
    throw err
  }
}
```

**Surfacing (from `queryClient.ts:40-50`):**
```ts
export function reportRequestFailure(err: unknown): void {
  const corrId = /* extract */
  toast.error('Request failed', {
    description: corrId
      ? `Error reference: ${corrId}`
      : 'Something went wrong. Check the browser console for details.',
  })
}
```

**TanStack Query auto-wiring (`queryClient.ts:52-55`):**
```ts
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportRequestFailure }),
  // ...
})
```

`useSearchConfig` errors auto-surface via this. Manual `reportRequestFailure(err)` calls are required only on non-React-Query fetch paths (`/initial`, SSRM `getRows`, execution-order, export).

### Sonner-mount race workaround (SSRM-specific)

**Source:** `frontend-react/src/grid/SmokeGrid.tsx` lines 42-58 (the `setTimeout(0)` block — CRITICAL).

**Apply to:** `SearchGrid.tsx` SSRM `getRows` catch block ONLY. Do NOT apply to other catches — they're outside the AG-Grid first-render commit cascade.

**Pattern:**
```ts
} catch (err) {
  if ((err as { name?: string }).name !== 'AbortError') {
    // The deferral via setTimeout(0) prevents a Sonner 2.x race: AG-Grid's
    // initial getRows fires inside the same commit/effect cascade as the
    // Toaster's own mount, and Sonner silently drops toasts dispatched
    // before its subscriber attaches.
    setTimeout(() => reportRequestFailure(err), 0)  // D-3.6 — DO NOT REMOVE
    params.fail()
  }
}
```

**Also load-bearing — Toaster mount order** (`routes/__root.tsx:31-39`):
```tsx
<QueryClientProvider client={queryClient}>
  <Toaster richColors position="bottom-right" />  {/* MUST mount before Outlet */}
  <Outlet />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

Phase 3 does NOT modify `__root.tsx` — the mount order is already correct. Do not touch it.

### URL state (TanStack Router + Zod)

**Source:** `frontend-react/src/routes/index.tsx` (file-based route idiom) + Phase 2 `routes/__root.tsx`.

**Apply to:** `routes/search.tsx` (`validateSearch` schema), `search/SearchPage.tsx` (`useSearch`/`useNavigate`), `search/hooks/useSearchState.ts`.

**Pattern:**
- Route file declares `validateSearch: z.object({...})`.
- Components read via `Route.useSearch()` (typed).
- Components write via `Route.useNavigate()` (`navigate({ search: { ... }, replace: true })`).
- URL is the SINGLE source of truth — no Zustand, no separate React state for `q`/`cat` (D-3.1).

### Config-driven principle (memory-locked)

**Source:** Memory file `~/.claude/projects/.../memory/feedback_config_driven_principle.md`; CONTEXT.md D-3.3 / D-3.4; CLAUDE.md "Important Patterns".

**Apply to:** `search/SearchGrid.tsx`, `search/lib/configToColDefs.ts`, `search/renderers/registry.ts`, and EVERY future grid/search file.

**Rule:** Columns, renderer keys, `cellStyle`, `cellRendererParams`, `pinned`, `hide`, `sortable`, `filter`, `width` come from `/api/v4/search/config`. React owns only the renderer registry (string→component map). Adding a column = JSON edit + restart, not a React change.

**Forbidden pattern (regression):**
```ts
// ❌ NEVER do this in Phase 3+
const columnDefs: ColDef[] = [
  { field: 'app_id', cellRenderer: AppIDCellRenderer },  // hardcoded — REJECTED
]
```

**Required pattern:**
```ts
// ✅ Config-driven
const colDefs = configCategoryToColDefs(config.categories.find(c => c.key === cat))
<AgGridReact columnDefs={colDefs} components={cellRenderers} ... />
```

### shadcn vendoring

**Source:** Phase 2 `frontend-react/src/components/ui/{button,card,sonner}.tsx` — pinned to shadcn CLI 3.8.5.

**Apply to:** Phase 3 adds via `pnpm dlx shadcn@3.8.5 add {component}` — `input`, `badge`, `separator`, `command`, `popover`, `tooltip`, `dropdown-menu`, `skeleton`. **Do not** use `shadcn@latest` (4.x has different init flow per CONTEXT.md `<canonical_refs>` "Registry Safety").

### Tailwind tokens / ESLint hex-rejection

**Source:** Phase 2 D-2.7 / D-2.8; `frontend-react/eslint.config.js` rule.

**Apply to:** ALL renderer files and components. No raw hex (`#1a73e8`) or OKLCH literals in JSX/className. Use `text-primary`, `bg-accent`, `text-muted-foreground`, etc.

**Mapping for the renderers** (UI-SPEC §"Color"):
- Angular `color: var(--google-blue, #1a73e8)` → React `text-primary`
- Angular `background: var(--bg-hover, rgba(26, 115, 232, 0.04))` → React `bg-accent`
- Angular disabled `color: var(--text-secondary, #5f6368)` → React `text-muted-foreground`
- Angular disabled state → React `opacity-50 cursor-not-allowed disabled:text-muted-foreground`

---

## No Analog Found

All Phase 3 files have at least a partial analog. The closest-to-no-analog files are:

| File | Reason | Fallback |
|------|--------|----------|
| `search/hooks/useRecentSearches.ts` | Angular search-v5 has NO recent-searches; it uses rotating placeholder + live `/suggest` API. Phase 3 specifies localStorage-backed recent-searches via UI-SPEC + D-3.11. | RESEARCH.md §6 (lines 596-633) is the source of truth; Phase 2 `ThemeProvider` localStorage pattern is the closest idiom analog. |
| `search/SearchToolbar.tsx` | New shadcn composition (Badge + DropdownMenu) with no Angular toolbar equivalent. Angular `SearchV5GridComponent` exposes toolbar actions via grid-internal buttons in the template. | UI-SPEC §"Toolbar" is the design source; export-call shape borrows from Angular `exportToExcel` lines 471-535. |
| `search/CategoryTabBar.tsx` | Phase 3 has one tab; the pattern is the Phase 4+ seed. | Read Angular `search-v5.component.html` `mat-tab-group` structurally; ignore Angular's tab-switching state (Phase 3 has no switching). |

---

## Pitfalls to Flag for Planner

1. **`getRowId` anti-pattern (CRITICAL).** Do NOT port Angular's `Date.now() + Math.random()` row ID (`search-v5-grid.component.ts` lines 196-222). It breaks SSRM cache identity and causes phantom re-renders. Either omit `getRowId` (default SSRM behavior is correct) or derive from a stable composite of row fields.

2. **`cellStyle` kebab-case keys.** The JSON config uses CSS-property kebab-case (`align-items`, `justify-content`). AG-Grid `cellStyle` expects React-style camelCase. The adapter (`configToColDefs.ts`) MUST convert. Test coverage required.

3. **`setTimeout(0)` workaround is load-bearing.** D-3.6 explicit: do NOT "clean up" the `setTimeout(0) reportRequestFailure` wrapper in the SSRM catch. It exists because Sonner 2.x drops toasts dispatched before the Toaster subscriber mounts, and AG-Grid's first `getRows` fires inside the same commit cascade.

4. **`/initial` is GET, not POST.** UI-SPEC says POST; backend is GET `?keyword=` per `SearchControllerV4.java` and `search-v5.service.ts:103`. RESEARCH.md §2 confirms GET. Use `apiFetch(\`/rectrace/api/v4/search/initial?keyword=${encodeURIComponent(term)}\`)` (no body).

5. **Excel export divergence from Angular.** Angular uses backend `/api/v4/search/export/{category}` returning a Blob; React Phase 3 uses client-side `gridApi.exportDataAsExcel()` (D-3.10). SSRM cached-rows-only limitation is accepted. Parity matrix row says `port` but the implementation diverges — surface in plan if needed.

6. **Renderer registry must handle unknown keys gracefully.** If `search-config-v4.json` references a `cellRenderer` string that isn't in the React registry yet (Phase 4+ keys: `setIdV2Renderer`, `reconV2Renderer`, etc.), the adapter must fall back to `undefined` (default text renderer), not throw. Test coverage required.

7. **`__root.tsx` Toaster mount order is load-bearing.** Phase 2 comment in `__root.tsx:32-37` explains the ordering. Do not reorder children inside `QueryClientProvider`. Do not modify `__root.tsx` in Phase 3.

8. **Delete `SmokeGrid` AFTER `SearchGrid` is wired and passing UAT.** The deletion is on the critical path of "no two grid implementations live at once" hygiene, but premature deletion means losing the working SSRM reference. Plan the deletion in the same wave as `SearchGrid` final wiring, not before.

9. **AG-Grid modules: register ALL Phase 3 modules in `main.tsx`** (Claude's-discretion → choose this over lazy registration). Order: License → Modules. Adding `ExcelExportModule` is necessary for `exportDataAsExcel()` to work (will throw "module not registered" otherwise per AG-Grid v35).

---

## Metadata

**Analog search scope:**
- `frontend-react/src/**` (Phase 2 React scaffolding) — 100% read
- `frontend/rectrace/src/app/search-v5/**` (Angular search-v5) — read structurally
- `frontend/rectrace/src/app/services/search-v5.service.ts` — read in full
- `frontend/rectrace/src/app/custom-interactions/components/renderers/{execution-order-button,app-id-cell-renderer,app-support-cell-renderer}.component.ts` — read in full
- `backend/rectrace/src/main/resources/search-config-v4.json` — read `fileName` entry

**Files scanned:** 14 source files (full read) + 4 directory listings + 3 grep passes

**Pattern extraction date:** 2026-05-17

## PATTERN MAPPING COMPLETE
