---
phase: 03-react-search-vertical-slice
plan: 03
subsystem: frontend-react/search
tags: [react, ag-grid, cell-renderer, shadcn, lucide, sonner]
dependency_graph:
  requires:
    - "03-01: types.ts (Zod schemas + ICellRendererParams shape via ag-grid-community)"
    - "Phase 2: apiFetch + reportRequestFailure (queryClient.ts)"
    - "Phase 2: shadcn Button primitive + Tailwind tokens (text-primary, bg-accent, text-muted-foreground)"
  provides:
    - "frontend-react/src/search/renderers/registry.ts — cellRenderers string→component map"
    - "frontend-react/src/search/renderers/AppIDCellRenderer.tsx — external-link renderer"
    - "frontend-react/src/search/renderers/SupportEmailCellRenderer.tsx — mailto: renderer"
    - "frontend-react/src/search/renderers/ExecutionOrderCellRenderer.tsx — placeholder Dialog renderer (TODO Phase 4 swap)"
    - "frontend-react/src/components/ui/dialog.tsx — vendored shadcn Dialog (3.8.5)"
  affects:
    - "Plan 04 (configToColDefs) consumes cellRenderers to resolve cellRenderer string keys"
    - "Plan 05 (SearchGrid) passes cellRenderers to AgGridReact `components` prop"
    - "Phase 4 (Cytoscape ExecutionOrderModal) replaces the placeholder <pre>{json}</pre> body — grep for 'TODO(Phase 4)'"
tech_stack:
  added: [shadcn Dialog primitive, lucide-react GitBranchIcon/Loader2Icon (already in deps)]
  patterns: [string-key renderer registry, Vite ?raw import for source-marker regression test]
key_files:
  created:
    - frontend-react/src/components/ui/dialog.tsx
    - frontend-react/src/search/renderers/AppIDCellRenderer.tsx
    - frontend-react/src/search/renderers/SupportEmailCellRenderer.tsx
    - frontend-react/src/search/renderers/ExecutionOrderCellRenderer.tsx
    - frontend-react/src/search/renderers/registry.ts
    - frontend-react/src/search/__tests__/AppIDCellRenderer.test.tsx
    - frontend-react/src/search/__tests__/SupportEmailCellRenderer.test.tsx
    - frontend-react/src/search/__tests__/ExecutionOrderCellRenderer.test.tsx
    - frontend-react/src/search/__tests__/registry.test.ts
  modified: []
decisions:
  - "ExecutionOrderCellRenderer ships a placeholder Dialog with <pre>{JSON.stringify(data,null,2)}</pre>; an explicit `TODO(Phase 4)` comment + vitest regression guard ensure Phase 4 finds the swap point."
  - "Renderer registry exports a single Record<string, ComponentType<ICellRendererParams>> map; unknown keys resolve to undefined so Plan 04's adapter can fall back to AG-Grid's default text renderer (Pitfall 6)."
  - "No setTimeout(0) deferral wrapping reportRequestFailure here — that workaround is SmokeGrid-SSRM-initial-getRows-specific. In-row button clicks happen after the Toaster has mounted."
  - "URL encoding via encodeURIComponent on jobName path segment (T-03.3-05 threat-model mitigation)."
metrics:
  duration_minutes: "~10"
  completed_date: "2026-05-17"
  tasks_completed: 2
  files_created: 9
  tests_added: 31
---

# Phase 3 Plan 03: Cell Renderers + Registry + shadcn Dialog Summary

Three Angular cell renderers ported to React with behavioral parity, plus the string-key registry that SearchGrid will pass to AgGridReact's `components` prop, plus the vendored shadcn Dialog primitive.

## What Shipped

**Three renderers (functional React components, all accept `ICellRendererParams`):**

1. `AppIDCellRenderer` — Truthy `params.value` renders `<a href="https://lnkd.in/gpAtSBRj" target="_blank" rel="noopener noreferrer">` with `title="View details of {params.data.app_name}"`. Falsy → plain `<span>`.
2. `SupportEmailCellRenderer` — Truthy `params.value` renders `<a href="mailto:{value}">` with `title="Send email to {params.data.app_name}"`. Falsy → plain `<span>`.
3. `ExecutionOrderCellRenderer` — Renders `null` when `params.data[jobNameField]` is empty/whitespace. Otherwise a shadcn ghost Button ("View" + `GitBranchIcon`). On click: `apiFetch('/rectrace/api/execution-order/' + encodeURIComponent(jobName))` with `Loader2Icon animate-spin` during in-flight. Success opens a shadcn Dialog with `<pre>{JSON.stringify(data,null,2)}</pre>` titled `Execution Order — {jobName}`. Failure routes through `reportRequestFailure(err)` for the SEARCH-06 correlation-ID toast. `jobNameField` is read from `params.colDef.cellRendererParams.jobNameField` (default `'load_job'`).

**Registry (`registry.ts`):**

```ts
export const cellRenderers: Record<string, ComponentType<ICellRendererParams>> = {
  appIDCellRenderer: AppIDCellRenderer,
  supportEmailCellRenderer: SupportEmailCellRenderer,
  executionOrderButtonRenderer: ExecutionOrderCellRenderer,
}
```

These three string keys are the exact values referenced by `search-config-v4.json#columns[].cellRenderer`. Plan 05 (SearchGrid) imports this map and passes it directly to `<AgGridReact components={cellRenderers} ... />`.

**shadcn Dialog (`src/components/ui/dialog.tsx`):**

Vendored via `pnpm dlx shadcn@3.8.5 add dialog`. Exports `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogTrigger`, `DialogClose`, `DialogDescription`, `DialogOverlay`, `DialogPortal`. Used by ExecutionOrderCellRenderer; available for future modal needs.

## Requirements Closed

- **SEARCH-02** — At least one Angular cell renderer ported with behavioral parity. Three were ported, all with passing parity tests (anchor attributes, title strings, falsy-branch behavior all match the Angular `getTooltipText` / `getFileUrl` outputs).
- **SEARCH-06** — Renderer-action failures surface a correlation-ID toast. ExecutionOrderCellRenderer's fetch failure path calls `reportRequestFailure(err)` (Phase 2 Sonner with 32-hex `X-Correlation-Id` echoed from `apiFetch`).

## Tests (31 passing)

| File | Tests | Coverage |
|------|-------|----------|
| `AppIDCellRenderer.test.tsx` | 8 | href/target/rel, title from `app_name`, three falsy branches, token-only className, missing `app_name` fallback |
| `SupportEmailCellRenderer.test.tsx` | 7 | mailto href, title, three falsy branches, token-only className, missing `app_name` fallback |
| `ExecutionOrderCellRenderer.test.tsx` | 11 | four null-branches, default+custom jobNameField, apiFetch URL encoding, loading state (disabled + Loader2Icon), Dialog open on success with JSON `<pre>`, failure routing through `reportRequestFailure`, `TODO(Phase 4)` source-marker regression guard |
| `registry.test.ts` | 5 | three identity assertions, Object.keys length === 3, unknown-key returns undefined |

Run: `cd frontend-react && npx vitest run src/search/__tests__/{AppIDCellRenderer,SupportEmailCellRenderer,ExecutionOrderCellRenderer,registry}.test.{ts,tsx}` — all green (31/31).

## Source Assertions (acceptance criteria gates)

| File | Gate | Result |
|------|------|--------|
| `AppIDCellRenderer.tsx` | contains `https://lnkd.in/gpAtSBRj` | ✓ |
| `AppIDCellRenderer.tsx` | contains `target="_blank"` and `rel="noopener noreferrer"` | ✓ |
| `SupportEmailCellRenderer.tsx` | contains `mailto:` and `Send email to ` | ✓ |
| `ExecutionOrderCellRenderer.tsx` | contains `TODO(Phase 4)` | ✓ |
| `ExecutionOrderCellRenderer.tsx` | contains `execution-order/` and `encodeURIComponent` | ✓ |
| `ExecutionOrderCellRenderer.tsx` | contains `reportRequestFailure` | ✓ |
| `ExecutionOrderCellRenderer.tsx` | NO `setTimeout` token | ✓ (0 occurrences) |
| `registry.ts` | contains all 3 string keys | ✓ |
| All renderer files | hex-free (Phase 2 D-2.8) | ✓ (`grep -E '#[0-9a-fA-F]{3,8}'` empty) |
| All renderer + test files | `npx eslint` exits 0 | ✓ |
| All new files | `npx tsc --noEmit` adds zero new errors | ✓ (pre-existing baseline errors in `useSearchConfig.test.ts:47`, `App.tsx:2` re `routeTree.gen`, `routes/index.tsx:6` are unrelated to this plan) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — cwd drift bug] Files initially written to wrong worktree path**

- **Found during:** Task 1, immediately after writing the first two renderer files.
- **Issue:** The first batch of `Write` calls used the absolute path `/Users/aarun/Workspace/Projects/autosys-job-explorer/frontend-react/...` (the main repo) because that's the path the orchestrator passes via `pwd` capture; the actual worktree lives at `/Users/aarun/Workspace/Projects/autosys-job-explorer/.claude/worktrees/agent-adf8a034d412ed9cc/frontend-react/...`. This is the documented #3099 cwd-drift scenario.
- **Fix:** Migrated all five accidentally-misplaced files to the worktree, cleaned up the main repo (back to clean status), re-ran `pnpm install` inside the worktree, re-ran all gates. No commits landed in the wrong repo.
- **Files affected:** `frontend-react/src/components/ui/dialog.tsx`, `AppIDCellRenderer.tsx`, `SupportEmailCellRenderer.tsx`, the two test files.
- **Commits:** N/A (caught before staging).

**2. [Rule 1 — Bug] TypeScript default-parameter trap in test helper**

- **Found during:** Task 1 RED-to-GREEN transition.
- **Issue:** First version of `makeParams(value, appName = 'FOO_APP')` could not be called with `appName=undefined` to mean "missing" — TS default-parameter applies when the arg is `undefined`, so `makeParams(v, undefined)` still gave `'FOO_APP'`. The "falls back to empty appName" test failed accordingly.
- **Fix:** Introduced a `NO_APP_NAME = Symbol('no-app-name')` sentinel; helper omits `data.app_name` only when the sentinel is passed.
- **Files affected:** `AppIDCellRenderer.test.tsx`, `SupportEmailCellRenderer.test.tsx`.
- **Commit:** Included in `fd1f9b6`.

**3. [Rule 1 — Lint compliance] `@typescript-eslint/no-misused-promises` on async onClick**

- **Found during:** Task 2 verification.
- **Issue:** `<Button onClick={handleClick}>` with `handleClick` typed as `() => Promise<void>` violates the strict lint rule that forbids returning a Promise where a void-returning handler is expected.
- **Fix:** Wrapped in an arrow that discards the promise: `onClick={() => { void handleClick() }}`. Behavior identical; React onClick handler returns void as required.
- **Files affected:** `ExecutionOrderCellRenderer.tsx`.
- **Commit:** Included in `106f1c9`.

**4. [Rule 1 — Lint compliance] Async mock factory + Promise misuse in tests**

- **Found during:** Task 2 verification.
- **Issue:** (a) `{ json: async () => responsePayload }` triggered `require-await`; (b) `new Promise(() => {})` was flagged as a misused-promise because the empty arrow inferred to `() => Promise<undefined>`.
- **Fix:** Replaced `async () => x` with `() => Promise.resolve(x)` (idiomatic mock for `response.json()`); replaced anonymous never-resolving arrow with named non-async `function neverSettle() { /* never resolves */ }`.
- **Files affected:** `ExecutionOrderCellRenderer.test.tsx`.
- **Commit:** Included in `106f1c9`.

**5. [Rule 1 — Acceptance-gate compliance] `setTimeout` literal in JSDoc**

- **Found during:** Task 2 final source-grep check.
- **Issue:** The JSDoc comment explaining "NO setTimeout(0) wrapper around reportRequestFailure here" itself contained the literal word `setTimeout`, which made `grep -c setTimeout` return 1 instead of the required 0.
- **Fix:** Rephrased the comment to "NO deferred-macrotask wrapper around reportRequestFailure" — same explanatory intent, no `setTimeout` token. The grep gate now returns 0.
- **Files affected:** `ExecutionOrderCellRenderer.tsx` JSDoc only (no behavior change).
- **Commit:** Included in `106f1c9`.

### Authentication Gates

None.

### Architectural Changes Requested

None — plan executed exactly as specified.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `fd1f9b6` | feat(03-03) | port AppID + SupportEmail cell renderers, vendor shadcn Dialog |
| `106f1c9` | feat(03-03) | ExecutionOrderCellRenderer + cellRenderers registry |

## Known Stubs

**1. ExecutionOrderCellRenderer Dialog body — placeholder `<pre>{JSON.stringify(data)}</pre>`**
- **File:** `frontend-react/src/search/renderers/ExecutionOrderCellRenderer.tsx`
- **Line:** ~94 (inside `<DialogContent>`)
- **Reason:** Plan intentionally ships this as a placeholder per 03-CONTEXT.md "Phase 4 owns the Cytoscape modal." A `TODO(Phase 4)` literal comment marks the swap point and a vitest regression guard asserts the marker survives.
- **Resolved by:** Phase 4 (Cytoscape ExecutionOrderModal implementation).

No other stubs.

## Threat Flags

None — the plan's `<threat_model>` STRIDE register fully covers the surface this plan introduces (T-03.3-01 through T-03.3-05). All five mitigations are in place: `<pre>` text escaping (no `dangerouslySetInnerHTML`), static href for AppID + `rel="noopener noreferrer"`, title-attribute text content, `reportRequestFailure` shows only correlation ID (no PII), `encodeURIComponent` on the jobName path segment.

## Downstream Surface (load-bearing for Plan 04 / Plan 05)

```ts
// Plan 04 (configToColDefs) — resolve cellRenderer string key:
import { cellRenderers } from '@/search/renderers/registry'
const Component = cellRenderers[columnDef.cellRenderer ?? '']  // undefined → fallback

// Plan 05 (SearchGrid) — pass to AgGridReact:
import { cellRenderers } from '@/search/renderers/registry'
<AgGridReact components={cellRenderers} columnDefs={...} ... />
```

Adding a new renderer in any future plan requires exactly two file touches: create the component file under `src/search/renderers/`, append one line to `registry.ts`. JSON `cellRenderer: "<key>"` references then resolve transparently.

## Self-Check: PASSED

- File `frontend-react/src/components/ui/dialog.tsx` — FOUND
- File `frontend-react/src/search/renderers/AppIDCellRenderer.tsx` — FOUND
- File `frontend-react/src/search/renderers/SupportEmailCellRenderer.tsx` — FOUND
- File `frontend-react/src/search/renderers/ExecutionOrderCellRenderer.tsx` — FOUND
- File `frontend-react/src/search/renderers/registry.ts` — FOUND
- File `frontend-react/src/search/__tests__/AppIDCellRenderer.test.tsx` — FOUND
- File `frontend-react/src/search/__tests__/SupportEmailCellRenderer.test.tsx` — FOUND
- File `frontend-react/src/search/__tests__/ExecutionOrderCellRenderer.test.tsx` — FOUND
- File `frontend-react/src/search/__tests__/registry.test.ts` — FOUND
- Commit `fd1f9b6` — FOUND
- Commit `106f1c9` — FOUND
- All 31 vitest tests passing
- ESLint clean on all new files
- TSC adds zero new errors
- All source-grep acceptance gates pass
- Hex-free check passes (renderer JSX uses only Tailwind token classes)
