---
phase: 02-react-foundation
plan: "03"
subsystem: ui
tags: [react, tanstack-router, tanstack-query, shadcn, ag-grid, theme-provider, correlation-id, ssrm, vitest]

requires:
  - phase: 02-react-foundation
    plan: "01"
    provides: frontend-react/ Vite 7 + React 19 scaffold, vitest harness, AG-Grid 35 bootstrap

provides:
  - custom ThemeProvider context with STORAGE_KEY='rectrace-theme'
  - ThemeSwitch toggle (MoonIcon/SunIcon, localStorage-persisted, system default)
  - Footer component with __BUILD_SHA__ Vite define injection
  - TanStack Router root route (__root.tsx) with ThemeProvider + QueryClientProvider + Toaster
  - TanStack Router index route (index.tsx) with three-zone shell (header + SmokeGrid + footer)
  - apiFetch wrapper with X-Correlation-Id header (32-char hex) per call
  - QueryCache.onError toast with 'Error reference: {corrId}' description
  - SmokeGrid SSRM component (ag-theme-quartz, serverSide model, /rectrace/api/v4/search/ssrm/fileName)
  - shadcn vendored components: button, sonner, card

affects: [02-04-ops, 03-recviz-integration, 08-design-audit]

tech-stack:
  added:
    - "@radix-ui/react-slot (shadcn button peer dep — added to package.json by shadcn CLI)"
    - "shadcn@3.8.5 — vendored button.tsx, sonner.tsx, card.tsx"
  patterns:
    - "Custom ThemeProvider React context (NOT next-themes) with STORAGE_KEY='rectrace-theme'"
    - "apiFetch wrapper: crypto.randomUUID().replace(/-/g,'') + X-Correlation-Id header"
    - "BASE_URL='' in queryClient.ts — Vite dev proxy handles /rectrace/api routing"
    - "QueryCache.onError pattern: reads .correlationId from thrown Error; toast.error with 'Error reference:'"
    - "SmokeGrid: IServerSideDatasource with apiFetch; params.success/fail lifecycle"
    - "window.matchMedia mock in test-setup.ts — required for ThemeProvider tests in jsdom"
    - "vitest/globals type added to tsconfig.app.json types array for global test functions"

key-files:
  created:
    - "frontend-react/src/components/layout/theme-provider.tsx — ThemeContext + ThemeProvider + useTheme; STORAGE_KEY='rectrace-theme'"
    - "frontend-react/src/components/layout/theme-switch.tsx — MoonIcon/SunIcon toggle; mount guard (null until mounted)"
    - "frontend-react/src/components/app-shell/footer.tsx — border-t footer with __BUILD_SHA__ global"
    - "frontend-react/src/routes/__root.tsx — ThemeProvider > QueryClientProvider > Outlet > Toaster > ReactQueryDevtools"
    - "frontend-react/src/routes/index.tsx — three-zone shell; header (brand + ThemeSwitch) + SmokeGrid main + Footer"
    - "frontend-react/src/lib/queryClient.ts — apiFetch (X-Correlation-Id, BASE_URL=''); QueryClient with QueryCache.onError toast"
    - "frontend-react/src/grid/SmokeGrid.tsx — ag-theme-quartz SSRM grid; POSTs to /rectrace/api/v4/search/ssrm/fileName"
    - "frontend-react/src/components/ui/button.tsx — shadcn vendored (exempt from hex-rejection rule)"
    - "frontend-react/src/components/ui/sonner.tsx — shadcn vendored"
    - "frontend-react/src/components/ui/card.tsx — shadcn vendored"
    - "frontend-react/src/components/layout/theme-provider.test.tsx — 2 tests: renders children; rectrace-theme STORAGE_KEY"
    - "frontend-react/src/lib/queryClient.test.ts — 2 tests: X-Correlation-Id header; correlationId on 500 error"
    - "frontend-react/src/grid/SmokeGrid.test.tsx — 1 test: mounts without crashing"
  modified:
    - "frontend-react/src/test-setup.ts — added window.matchMedia mock for jsdom (Rule 2 fix)"
    - "frontend-react/tsconfig.app.json — added 'vitest/globals' to types array (Rule 1 fix)"
    - "frontend-react/package.json — radix-ui added by shadcn CLI"
    - "frontend-react/pnpm-lock.yaml — updated lockfile"

key-decisions:
  - "BASE_URL='' in queryClient.ts — RESEARCH.md Pattern 7 superseded by Vite dev proxy; same-origin paths work in dev and prod"
  - "apiFetch used in SmokeGrid SSRM datasource (not raw fetch) — X-Correlation-Id automatic on all requests"
  - "window.matchMedia mock in test-setup.ts — global mock for all tests; jsdom doesn't implement matchMedia"
  - "vitest/globals added to tsconfig.app.json types — enables TypeScript to resolve test/expect/describe globals"
  - "routeTree.gen.ts placeholder replaced by TanStack Router Vite plugin during pnpm build — auto-generated correctly"

metrics:
  duration: ~12min
  completed: "2026-05-13"
  tasks: 2
  files_created: 13
  files_modified: 4
---

# Phase 02 Plan 03: App Shell — ThemeProvider, ThemeSwitch, Footer, QueryClient, SmokeGrid Summary

**Custom ThemeProvider context with 'rectrace-theme' localStorage key, three-zone TanStack Router shell, apiFetch with X-Correlation-Id header injection, and AG-Grid SSRM SmokeGrid against /rectrace/api/v4/search/ssrm/fileName — 5 tests passing, typecheck clean, production build succeeds**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-13T02:41:26Z
- **Completed:** 2026-05-13T02:53:00Z
- **Tasks:** 2 (Task 1: app shell; Task 2: queryClient + SmokeGrid)
- **Files created:** 13 new files, 4 modified

## Accomplishments

- Three-zone app shell renders at localhost:5173: sticky header with brand "Rectrace" + ThemeSwitch, SmokeGrid main content, footer with build SHA
- ThemeProvider stores/restores dark/light preference in `localStorage` under `rectrace-theme`; `.dark` class applied to `document.documentElement`
- ThemeSwitch uses `mounted` guard (renders null before mount) to prevent hydration flash; toggles MoonIcon/SunIcon
- Footer shows `__BUILD_SHA__` injected by Vite `define` from `git rev-parse --short HEAD`
- `apiFetch` generates 32-char hex correlationId via `crypto.randomUUID().replace(/-/g,'')` per call; attaches as `X-Correlation-Id` header
- `BASE_URL = ''` — no hardcoded localhost:6088; Vite dev proxy (`/rectrace/api → http://localhost:6088`) handles dev routing
- `QueryCache.onError` fires `toast.error('Request failed', { description: 'Error reference: {corrId}' })` on failed fetches
- SmokeGrid uses `ag-theme-quartz` with `rowModelType="serverSide"` and SSRM datasource POSTing to `/rectrace/api/v4/search/ssrm/fileName`
- SmokeGrid uses `apiFetch` (not raw fetch) ensuring every grid row fetch carries X-Correlation-Id
- TanStack Router Vite plugin auto-generated `routeTree.gen.ts` during `pnpm build`
- shadcn components button, sonner, card vendored via `pnpm dlx shadcn@3.8.5 add`

## Task Commits

1. **Task 1: App shell — ThemeProvider, ThemeSwitch, Footer, root route, index route** - `0c5a8f7` (feat)
2. **Task 2: QueryClient fetch wrapper and SmokeGrid SSRM** - `1c433ea` (feat)

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c "rectrace-theme" theme-provider.tsx` | ≥1 | 1 | PASS |
| `grep -c "MoonIcon" theme-switch.tsx` | ≥1 | 2 | PASS |
| `grep -c "__BUILD_SHA__" footer.tsx` | 1 | 1 | PASS |
| `grep -c "ThemeProvider" __root.tsx` | ≥1 | 3 | PASS |
| `grep -c "createFileRoute" index.tsx` | ≥1 | 2 | PASS |
| `grep -c "X-Correlation-Id" queryClient.ts` | ≥1 | 1 | PASS |
| `grep -c "Error reference:" queryClient.ts` | ≥1 | 1 | PASS |
| `grep -c "localhost:6088" queryClient.ts` | 0 | 0 | PASS |
| `grep -c "serverSide" SmokeGrid.tsx` | ≥1 | 2 | PASS |
| `pnpm test` | 5 passed | 5 passed | PASS |
| `pnpm typecheck` | 0 errors | 0 errors | PASS |
| `pnpm build` | succeeds | succeeds (1973 modules) | PASS |

## Dark/Light Toggle Verification

- **STORAGE_KEY:** `'rectrace-theme'` — confirmed in `theme-provider.tsx` line 13 (single delta from recviz `'recviz-theme'`)
- **Class application:** `document.documentElement.classList.remove('light','dark'); classList.add(resolvedTheme)` — produces `.dark` class for `@custom-variant dark (&:is(.dark *))` in index.css
- **Persistence:** `localStorage.setItem('rectrace-theme', t)` on every `setTheme()` call
- **Test:** `ThemeProvider uses rectrace-theme storage key` — PASS (reads 'dark' from localStorage and resolves to 'dark')

## X-Correlation-Id Flow Confirmation

1. `apiFetch(path, init?)` called from SmokeGrid datasource and any future QueryClient consumers
2. `const correlationId = crypto.randomUUID().replace(/-/g, '')` — 32 hex chars (W3C trace-id valid)
3. `'X-Correlation-Id': correlationId` merged into request headers
4. On `!res.ok`: `throw Object.assign(new Error(`HTTP ${res.status} ${path}`), { correlationId })`
5. `QueryCache.onError`: `toast.error('Request failed', { description: 'Error reference: {corrId}' })`
6. Format matches Copywriting Contract: "Error reference: {correlationId}"

## BASE_URL Confirmation

- `const BASE_URL = ''` in `queryClient.ts` (line 5)
- RESEARCH.md Pattern 7 (`import.meta.env.DEV ? 'http://localhost:6088' : ''`) is superseded
- Vite dev proxy: `server.proxy: { '/rectrace/api': { target: 'http://localhost:6088', changeOrigin: true } }`
- Same-origin paths (`/rectrace/api/...`) work in dev (proxied) and production (same-origin)
- `grep -c "localhost:6088" queryClient.ts` → 0

## SSRM Smoke Result

- Grid POSTs to `/rectrace/api/v4/search/ssrm/fileName` with correct SSRMRequestV4 body shape
- Backend must be running with `--spring.profiles.active=local` and Phase 0.1 seed loaded for rows to appear
- If backend not running: `params.fail()` called; Sonner toast shows 'Error reference: {corrId}'
- Live test result: manual verification required (backend startup deferred to user)

## Test Results

| Test File | Tests | Passed | Failed |
|-----------|-------|--------|--------|
| `src/components/layout/theme-provider.test.tsx` | 2 | 2 | 0 |
| `src/lib/queryClient.test.ts` | 2 | 2 | 0 |
| `src/grid/SmokeGrid.test.tsx` | 1 | 1 | 0 |
| **Total** | **5** | **5** | **0** |

## TypeScript Compilation Status

`pnpm typecheck` exits 0 — no type errors. `pnpm build` exits 0 — production build succeeds with 1973 modules transformed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added window.matchMedia mock to test-setup.ts**
- **Found during:** Task 1 (theme-provider test run)
- **Issue:** jsdom does not implement `window.matchMedia`. The `ThemeProvider` calls `window.matchMedia('(prefers-color-scheme: dark)')` during render. Without a mock, `TypeError: window.matchMedia is not a function` throws in all tests that mount `ThemeProvider`.
- **Fix:** Added `Object.defineProperty(window, 'matchMedia', { ... })` to `src/test-setup.ts` — a no-op mock returning `matches: false` (system = light default in tests).
- **Files modified:** `frontend-react/src/test-setup.ts`
- **Commit:** `0c5a8f7`

**2. [Rule 1 - Bug] Added 'vitest/globals' to tsconfig.app.json types array**
- **Found during:** Task 1 (TypeScript typecheck after creating test files)
- **Issue:** `tsc -b --noEmit` reported `TS2593: Cannot find name 'test'` and `TS2304: Cannot find name 'expect'` for `theme-provider.test.tsx`. The `vitest.config.ts` sets `globals: true` (vitest injects `test`, `expect`, `describe`), but TypeScript needs the type declarations to resolve these globals.
- **Fix:** Added `"vitest/globals"` to the `types` array in `tsconfig.app.json`.
- **Files modified:** `frontend-react/tsconfig.app.json`
- **Commit:** `0c5a8f7`

**3. [Rule 3 - Blocking Issue] Created placeholder routeTree.gen.ts then replaced by Vite plugin**
- **Found during:** Task 1 (TypeScript typecheck failed — App.tsx imports routeTree from './routeTree.gen' which didn't exist)
- **Issue:** `routeTree.gen.ts` is gitignored and auto-generated. The Plan 02-01 SUMMARY noted a placeholder was on disk but it was lost (gitignored). Without it, `tsc -b` fails for `App.tsx`.
- **Fix:** Created a minimal hand-authored `routeTree.gen.ts` placeholder. When `pnpm build` ran, TanStack Router Vite plugin correctly replaced it with the proper generated version wiring `__root.tsx` and `index.tsx`.
- **Files modified:** `frontend-react/src/routeTree.gen.ts` (created → auto-replaced by Vite plugin)
- **Status:** Resolved — final content correct and Type-checks.

## Known Stubs

None — all data sources are wired. The SmokeGrid SSRM hits the real `/rectrace/api/v4/search/ssrm/fileName` endpoint. Empty data when backend is offline is expected behavior (grid shows "No seed data found" overlay via `overlayNoRowsTemplate`), not a stub.

## Threat Flags

No new security-relevant surface introduced beyond the plan's threat model:
- T-2-01 (AG-Grid license): `LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY ?? '')` in main.tsx (Plan 01) — unchanged
- T-2-02 (X-Correlation-Id): Client generates UUID v4 dashes-stripped; no user-supplied data in the header value — mitigated per plan
- T-2-04 (dev proxy): `server.proxy` targets localhost:6088 dev only; no credentials forwarded — accepted

## Self-Check: PASSED

Files confirmed present:
- `frontend-react/src/components/layout/theme-provider.tsx` — FOUND
- `frontend-react/src/components/layout/theme-switch.tsx` — FOUND
- `frontend-react/src/components/app-shell/footer.tsx` — FOUND
- `frontend-react/src/routes/__root.tsx` — FOUND
- `frontend-react/src/routes/index.tsx` — FOUND
- `frontend-react/src/lib/queryClient.ts` — FOUND
- `frontend-react/src/grid/SmokeGrid.tsx` — FOUND

Commits confirmed:
- Task 1: `0c5a8f7` — feat(02-03): app shell
- Task 2: `1c433ea` — feat(02-03): QueryClient + SmokeGrid

---

*Phase: 02-react-foundation*
*Plan: 03*
*Completed: 2026-05-13*
