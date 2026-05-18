---
phase: 03-react-search-vertical-slice
plan: 04
subsystem: frontend-react
tags: [react, ag-grid, adapter, shadcn, modules, config-driven]
requires:
  - 03-01 (Zod schemas + types for SearchConfigurationV4)
  - 03-03 (cellRenderers registry + AppIDCellRenderer + SupportEmailCellRenderer + ExecutionOrderCellRenderer)
provides:
  - "configCategoryToColDefs(cat: CategoryConfigV4): ColDef[]"
  - "toCamelCaseStyle(style: Record<string, string>): Record<string, string>"
  - "AG-Grid modules: ExcelExportModule, ColumnsToolPanelModule, FiltersToolPanelModule (alongside existing ServerSideRowModelModule)"
  - "shadcn primitives: Input, Badge, Separator, Popover, Command, Tooltip, DropdownMenu, Skeleton"
affects:
  - 03-05 (SearchGrid will consume configCategoryToColDefs + 3 AG-Grid modules + Skeleton/DropdownMenu)
  - 03-06 (SearchToolbar will use gridApi.exportDataAsExcel + Tooltip + Popover)
  - 03-07 (SearchPage will compose Command/Popover/Input for the search bar)
tech-stack:
  added:
    - "cmdk ^1.1.1 (pulled by shadcn command)"
  patterns:
    - "config-driven AG-Grid column generation via single-file adapter (D-3.3)"
    - "kebab-to-camelCase CSS key conversion at trust boundary"
    - "graceful renderer-key fallback (unknown string -> undefined -> AG-Grid default text renderer)"
key-files:
  created:
    - frontend-react/src/search/lib/configToColDefs.ts
    - frontend-react/src/search/__tests__/configToColDefs.test.ts
    - frontend-react/src/components/ui/input.tsx
    - frontend-react/src/components/ui/badge.tsx
    - frontend-react/src/components/ui/separator.tsx
    - frontend-react/src/components/ui/popover.tsx
    - frontend-react/src/components/ui/command.tsx
    - frontend-react/src/components/ui/tooltip.tsx
    - frontend-react/src/components/ui/dropdown-menu.tsx
    - frontend-react/src/components/ui/skeleton.tsx
    - .planning/phases/03-react-search-vertical-slice/deferred-items.md
  modified:
    - frontend-react/src/main.tsx
    - frontend-react/package.json
    - frontend-react/pnpm-lock.yaml
decisions:
  - "Adapter exports toCamelCaseStyle for direct unit testing (not just cellStyle-path coverage)"
  - "Unknown cellRenderer keys collapse to undefined explicitly via `cellRenderers[key] ?? undefined` to document the Pitfall 6 contract"
  - "Built-in AG-Grid agTextColumnFilter is the default when filter is true or omitted; filter: false -> false (matches Angular V5 behavior)"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_created: 11
  files_modified: 3
  unit_tests: 15
  total_tests_in_suite_after: 96
  completed: 2026-05-17
---

# Phase 3 Plan 04: configToColDefs Adapter + AG-Grid Modules + shadcn Primitives Summary

Single-file adapter that translates `CategoryConfigV4` (parsed from `/api/v4/search/config`) into AG-Grid `ColDef[]`, resolving renderer string keys through Plan 03's registry and converting kebab-case `cellStyle` keys to camelCase; plus runtime infrastructure (3 new AG-Grid modules in `main.tsx`, 8 shadcn primitives vendored at CLI pin 3.8.5) that gates Plans 05/06/07 from "module not registered" runtime errors and import-not-found build errors.

## Surface Shipped

### `configCategoryToColDefs(cat: CategoryConfigV4): ColDef[]`

The sole impedance layer between the JSON config and AG-Grid. SearchGrid (Plan 05) consumes it as:

```ts
const colDefs = configCategoryToColDefs(
  config.categories.find((c) => c.key === activeCategory)!
)
```

Behavior captured in 15 unit tests:

- 15-column fileName fixture from `search-config-v4.json` round-tripped via Zod parse → adapter → asserts field names, headerNames, order
- `rowGroup` + `hide` preserved on grouping columns (`file_name_pattern`)
- Known renderer string keys (`appIDCellRenderer`, `supportEmailCellRenderer`, `executionOrderButtonRenderer`) resolve to the actual React components via the registry (identity-equality asserted with `toBe(AppIDCellRenderer)`)
- Execution-order column attributes flow through: `pinned: 'right'`, `sortable: false`, `filter: false`, `resizable: false`, `width: 100`, `cellRendererParams: { jobNameField: 'load_job' }`
- `cellStyle` kebab keys converted to camelCase: `{display, "align-items", "justify-content", padding, height}` → `{display, alignItems, justifyContent, padding, height}`
- Unknown renderer string keys gracefully resolve to `undefined` (Pitfall 6 — AG-Grid then falls back to its default text renderer rather than crashing)
- Default normalization: `sortable` defaults to `true`, `filter: true|omitted` → `'agTextColumnFilter'`, `filter: false` → `false`, `resizable` defaults to `true`, `rowGroup` defaults to `false`, `hide` defaults to `false`

### `toCamelCaseStyle(style: Record<string, string>): Record<string, string>`

Exported helper called by the adapter and unit-tested independently:

- Empty input → empty output
- Single kebab key → camelCase (`align-items` → `alignItems`)
- camelCase pass-through (`display`, `padding` unchanged)
- Multi-segment kebab (`border-top-left-radius` → `borderTopLeftRadius`)

### AG-Grid Enterprise modules registered in `main.tsx`

```ts
ModuleRegistry.registerModules([
  ServerSideRowModelModule,   // pre-existing (Phase 2)
  ExcelExportModule,          // Plan 06 — gridApi.exportDataAsExcel()
  ColumnsToolPanelModule,     // Plan 05 — sideBar.toolPanels columns
  FiltersToolPanelModule,     // Plan 05 — sideBar.toolPanels filters
])
```

License-set-before-registerModules order preserved (asserted by acceptance criterion `awk` check; License@line15 < Modules@line20).

### shadcn primitives vendored at CLI pin 3.8.5

| Component | File | Source |
|-----------|------|--------|
| Input | `src/components/ui/input.tsx` | shadcn 3.8.5 registry |
| Badge | `src/components/ui/badge.tsx` | shadcn 3.8.5 registry |
| Separator | `src/components/ui/separator.tsx` | shadcn 3.8.5 registry |
| Popover | `src/components/ui/popover.tsx` | shadcn 3.8.5 registry |
| Command | `src/components/ui/command.tsx` | shadcn 3.8.5 registry + cmdk@^1.1.1 |
| Tooltip | `src/components/ui/tooltip.tsx` | shadcn 3.8.5 registry |
| DropdownMenu | `src/components/ui/dropdown-menu.tsx` | shadcn 3.8.5 registry |
| Skeleton | `src/components/ui/skeleton.tsx` | shadcn 3.8.5 registry |

All eight imported by Plans 05 (Skeleton, DropdownMenu — sideBar UI), 06 (Tooltip, Popover, DropdownMenu — toolbar), 07 (Command, Popover, Input, Badge, Separator — search bar).

## Commits

| Commit  | Type | Summary |
|---------|------|---------|
| 2188ac1 | test | RED — failing tests for configCategoryToColDefs (TDD gate) |
| 5376b96 | feat | GREEN — configCategoryToColDefs adapter + toCamelCaseStyle helper |
| 4eb48ac | feat | Register 4 AG-Grid modules in main.tsx + vendor 8 shadcn primitives |

## Verification

- `npx vitest run src/search/__tests__/configToColDefs.test.ts` — **15/15 passing**
- `npx vitest run` (full suite) — **96/96 passing across 12 test files**
- `npx tsc --noEmit -p tsconfig.json` — clean
- `npx eslint src/main.tsx src/search/lib/` — clean
- `npx vite build` — clean (1972 modules transformed, 1.96s)
- Source grep gates (acceptance criteria):
  - `toCamelCaseStyle` appears 2 times in adapter (declaration + use) ✓
  - `cellRenderers[` appears 1 time (registry lookup only) ✓
  - `agTextColumnFilter` appears 1 time ✓
  - `field: c.field` + `headerName: c.headerName` appear 2 times (mapping shape) ✓
  - `ExcelExportModule`, `ColumnsToolPanelModule`, `FiltersToolPanelModule`, `ServerSideRowModelModule` each appear 2 times in main.tsx (import + register) ✓
  - License-before-Modules order verified by awk ✓

## Deviations from Plan

### Auto-fixed Issues

None. The adapter behavior matched the plan's `<behavior>` block exactly; the 15-test count exceeds the plan's "≥ 13 passing tests" threshold.

### Worktree-path lesson learned (procedural, not a deviation)

Initial `Write` call used the main-repo absolute path instead of the worktree-rooted path. The file was relocated to the worktree before commit; no main-repo state was modified (verified via `git status` in the main repo). All subsequent file operations used worktree-derived paths.

## Deferred Issues (Out of Scope — see deferred-items.md)

`npm run build` fails on `tsc -b` step due to **pre-existing** milestone-HEAD issues (verified by stashing Plan 04 changes and re-running):

1. Missing `src/App.tsx`'s reference to `routeTree.gen.ts` — file is auto-generated by `@tanstack/router-plugin` at `vite dev` time and is `.gitignore`d.
2. Cascading TanStack Router typed-route errors from the missing `routeTree.gen.ts`.
3. Vitest 4.x `Mock<Procedure | Constructable>` callable narrowing change in `useSearchConfig.test.ts` (test runtime is green; only `tsc -b` flags it).

**Why not fixed here:** Scope Boundary (deviation rule). Plan 04's acceptance criterion specifies `npx tsc --noEmit -p frontend-react/tsconfig.json` (which passes) and `npm run build` (which fails on the above pre-existing issues). `npx vite build` alone — the part Plan 04 must not break — passes cleanly. Fix proposed for Plan 05 or a hardening task; tracked in `.planning/phases/03-react-search-vertical-slice/deferred-items.md`.

## Known Stubs

None. The adapter is a pure transform — no placeholder data, no hardcoded empty arrays.

## Threat Flags

None. Plan 04 introduces no new network endpoints, auth paths, or trust boundaries beyond those covered by the plan's `<threat_model>` (configToColDefs unknown renderer + cellStyle kebab + shadcn CLI vendoring + AG-Grid runtime module missing — all mitigated as specified).

## Self-Check: PASSED

- `frontend-react/src/search/lib/configToColDefs.ts` — FOUND
- `frontend-react/src/search/__tests__/configToColDefs.test.ts` — FOUND
- `frontend-react/src/components/ui/input.tsx` — FOUND
- `frontend-react/src/components/ui/badge.tsx` — FOUND
- `frontend-react/src/components/ui/separator.tsx` — FOUND
- `frontend-react/src/components/ui/popover.tsx` — FOUND
- `frontend-react/src/components/ui/command.tsx` — FOUND
- `frontend-react/src/components/ui/tooltip.tsx` — FOUND
- `frontend-react/src/components/ui/dropdown-menu.tsx` — FOUND
- `frontend-react/src/components/ui/skeleton.tsx` — FOUND
- `frontend-react/src/main.tsx` — modified (4 modules registered)
- Commit `2188ac1` — FOUND in `git log`
- Commit `5376b96` — FOUND in `git log`
- Commit `4eb48ac` — FOUND in `git log`

## TDD Gate Compliance

- RED gate: `2188ac1 test(03-04): add failing tests for configCategoryToColDefs adapter` ✓
- GREEN gate: `5376b96 feat(03-04): configCategoryToColDefs adapter (kebab-to-camelCase cellStyle)` ✓
- REFACTOR gate: not required (adapter shipped at minimal/idiomatic shape)
